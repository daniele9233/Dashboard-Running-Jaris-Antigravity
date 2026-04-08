"""
Altrove Backend – FastAPI server for running training dashboard.
Handles Strava OAuth, run sync, profile, training plan, analytics, etc.
"""

import os, math, hashlib, datetime as dt, asyncio, re
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse

import httpx
import json
from anthropic import AsyncAnthropic
import motor.motor_asyncio as motor
import fitdecode
import io
import base64

load_dotenv()

# ── ENV ──────────────────────────────────────────────────────────────────────
MONGO_URL          = os.environ.get("MONGO_URL", "")
DB_NAME            = os.environ.get("DB_NAME", "DANIDB")
STRAVA_CLIENT_ID   = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
FRONTEND_URL       = os.environ.get("FRONTEND_URL", "http://localhost:5173")
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY     = os.environ.get("GEMINI_API_KEY", "")
JARVIS_GEMINI_KEY  = os.environ.get("JARVIS_GEMINI_KEY", "") or GEMINI_API_KEY
FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
GARMIN_EMAIL       = os.environ.get("GARMIN_EMAIL", "")
GARMIN_PASSWORD    = os.environ.get("GARMIN_PASSWORD", "")

# Build the callback URL from the current host (set via Render env or default)
BACKEND_URL        = os.environ.get("BACKEND_URL", "https://dani-backend-ea0s.onrender.com")
STRAVA_REDIRECT_URI = f"{BACKEND_URL}/api/strava/callback"
STRAVA_SCOPE       = "read,activity:read_all"

# ── DB ───────────────────────────────────────────────────────────────────────
client: motor.AsyncIOMotorClient = None  # type: ignore
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db
    client = motor.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    yield
    client.close()

app = FastAPI(title="Altrove", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── HELPERS ──────────────────────────────────────────────────────────────────

def oid(doc):
    """Convert MongoDB _id to string 'id' field."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

def oids(docs):
    return [oid(d) for d in docs]


async def _get_athlete_id() -> Optional[int]:
    """Get the current athlete_id from the latest Strava token."""
    tok = await db.strava_tokens.find_one(sort=[("_id", -1)])
    return tok.get("athlete_id") if tok else None

# ── HEALTH ───────────────────────────────────────────────────────────────────

@app.get("/")
async def health():
    return {"status": "ok", "app": "Altrove"}

# ═══════════════════════════════════════════════════════════════════════════════
#  STRAVA OAUTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/strava/auth-url")
async def strava_auth_url():
    url = (
        f"https://www.strava.com/oauth/authorize"
        f"?client_id={STRAVA_CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={STRAVA_REDIRECT_URI}"
        f"&approval_prompt=force"
        f"&scope={STRAVA_SCOPE}"
    )
    return {"url": url, "redirect_uri": STRAVA_REDIRECT_URI}


@app.get("/api/strava/callback")
async def strava_callback(code: str = Query(None), error: str = Query(None)):
    """
    Strava redirects here after user authorizes.
    We redirect to the frontend with the code so the SPA can exchange it.
    """
    if error:
        return RedirectResponse(f"{FRONTEND_URL}?strava_error={error}")
    if not code:
        return RedirectResponse(f"{FRONTEND_URL}?strava_error=no_code")
    return RedirectResponse(f"{FRONTEND_URL}?strava_code={code}")


@app.post("/api/strava/exchange-code")
async def strava_exchange_code(request: Request):
    """Exchange the authorization code for access + refresh tokens."""
    body = await request.json()
    code = body.get("code", "")

    async with httpx.AsyncClient() as http:
        resp = await http.post("https://www.strava.com/oauth/token", data={
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        })

    if resp.status_code != 200:
        return JSONResponse({"error": "exchange_failed", "detail": resp.text}, status_code=400)

    data = resp.json()
    tokens = {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_at": data.get("expires_at"),
        "athlete_id": data.get("athlete", {}).get("id"),
    }

    # Upsert tokens in DB
    await db.strava_tokens.update_one(
        {"athlete_id": tokens["athlete_id"]},
        {"$set": tokens},
        upsert=True,
    )

    # Create / update profile from Strava athlete data
    athlete = data.get("athlete", {})
    athlete_id = tokens["athlete_id"]
    profile_patch = {
        "athlete_id": athlete_id,
        "name": f"{athlete.get('firstname', '')} {athlete.get('lastname', '')}".strip() or "Runner",
        "strava_profile_pic": athlete.get("profile"),
        "strava_city": athlete.get("city"),
        "strava_country": athlete.get("country"),
    }
    # Only set defaults — don't overwrite user-edited fields
    existing = await db.profile.find_one({"athlete_id": athlete_id})
    if not existing:
        profile_patch.update({
            "age": 0, "weight_kg": 0, "height_cm": 0, "max_hr": 190,
            "sex": "", "profile_pic": athlete.get("profile", ""),
            "started_running": "", "total_km": 0, "race_goal": "",
            "race_date": "", "target_pace": None, "target_time": "",
            "level": "", "max_weekly_km": None, "injury": None,
            "pbs": {}, "medals": {},
        })
        await db.profile.insert_one(profile_patch)
    else:
        await db.profile.update_one(
            {"athlete_id": athlete_id},
            {"$set": {"name": profile_patch["name"], "strava_profile_pic": profile_patch["strava_profile_pic"],
                      "strava_city": profile_patch["strava_city"], "strava_country": profile_patch["strava_country"]}},
        )

    return {"ok": True, "athlete_id": athlete_id}


async def _refresh_token_if_needed(tokens: dict) -> dict:
    """Refresh the Strava access token if expired."""
    import time
    if tokens.get("expires_at", 0) > time.time() + 60:
        return tokens

    async with httpx.AsyncClient() as http:
        resp = await http.post("https://www.strava.com/oauth/token", data={
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "refresh_token": tokens["refresh_token"],
            "grant_type": "refresh_token",
        })

    if resp.status_code != 200:
        return tokens

    data = resp.json()
    tokens["access_token"] = data["access_token"]
    tokens["refresh_token"] = data["refresh_token"]
    tokens["expires_at"] = data["expires_at"]

    await db.strava_tokens.update_one(
        {"athlete_id": tokens["athlete_id"]},
        {"$set": tokens},
    )
    return tokens


async def _compute_fitness_freshness(athlete_id: str, max_hr_profile: int = 190, resting_hr: int = 50):
    """Calcola CTL/ATL/TSB da tutte le corse usando TRIMP metodo Lucia (2003).

    trimp = duration_min × hr_reserve × (0.64 × e^(1.92 × hr_reserve))
    CTL = EMA 42 giorni, ATL = EMA 7 giorni, TSB = CTL − ATL
    """
    from datetime import date, timedelta

    q = {"athlete_id": athlete_id} if athlete_id else {}
    runs = await db.runs.find(q, {"date": 1, "duration_minutes": 1, "avg_hr": 1}).sort("date", 1).to_list(None)
    if not runs:
        return

    # ── TRIMP giornaliero ──────────────────────────────────────────────────────
    daily_trimp: dict[str, float] = {}
    safe_max = max_hr_profile if max_hr_profile > resting_hr else 190
    safe_rest = resting_hr if resting_hr > 0 else 50

    for run in runs:
        date_str = str(run.get("date", ""))[:10]
        if not date_str:
            continue
        duration_min = float(run.get("duration_minutes") or 0)
        avg_hr = run.get("avg_hr")

        if avg_hr and avg_hr > 0:
            hr_res = (avg_hr - safe_rest) / (safe_max - safe_rest)
            hr_res = max(0.0, min(1.0, hr_res))
        else:
            hr_res = 0.55  # fallback senza HR

        trimp = duration_min * hr_res * (0.64 * math.exp(1.92 * hr_res))
        daily_trimp[date_str] = daily_trimp.get(date_str, 0.0) + trimp

    if not daily_trimp:
        return

    # ── EMA giornaliera: CTL (42gg) / ATL (7gg) ───────────────────────────────
    ALPHA_CTL = 2.0 / (42 + 1)
    ALPHA_ATL = 2.0 / (7 + 1)

    first_date = date.fromisoformat(min(daily_trimp.keys()))
    today = date.today()

    ctl = 0.0
    atl = 0.0
    docs = []
    current = first_date

    while current <= today:
        ds = current.isoformat()
        trimp_today = daily_trimp.get(ds, 0.0)
        ctl = ctl + ALPHA_CTL * (trimp_today - ctl)
        atl = atl + ALPHA_ATL * (trimp_today - atl)
        tsb = ctl - atl

        # Salva: giorni con corse + snapshot settimanali (ogni lunedì)
        if trimp_today > 0 or current.weekday() == 0:
            docs.append({
                "athlete_id": athlete_id,
                "date": ds,
                "trimp": round(trimp_today, 2),
                "ctl": round(ctl, 2),
                "atl": round(atl, 2),
                "tsb": round(tsb, 2),
            })
        current += timedelta(days=1)

    # ── Scrivi in MongoDB (sostituisci tutto) ──────────────────────────────────
    await db.fitness_freshness.delete_many(q)
    if docs:
        await db.fitness_freshness.insert_many(docs)


def _classify_run(run_data: dict) -> str:
    """Simple run-type classifier based on pace and duration."""
    distance = run_data.get("distance_km", 0)
    pace_parts = run_data.get("avg_pace", "6:00").split(":")
    try:
        pace_sec = int(pace_parts[0]) * 60 + int(pace_parts[1])
    except (ValueError, IndexError):
        pace_sec = 360

    if distance >= 18:
        return "long"
    if pace_sec < 270:  # faster than 4:30/km
        return "intervals"
    if pace_sec < 310:  # faster than 5:10/km
        return "tempo"
    if distance < 6 and pace_sec > 380:
        return "recovery"
    return "easy"


def _format_pace(speed_ms: float) -> str:
    """Convert m/s to min:sec/km pace string."""
    if speed_ms <= 0:
        return "0:00"
    pace_sec = 1000 / speed_ms
    m = int(pace_sec // 60)
    s = int(pace_sec % 60)
    return f"{m}:{s:02d}"


@app.post("/api/strava/sync")
async def strava_sync():
    """Fetch ALL activities from Strava (paginated) and upsert into DB."""
    tokens = await db.strava_tokens.find_one(sort=[("_id", -1)])
    if not tokens:
        return JSONResponse({"error": "not_connected"}, status_code=400)

    tokens = await _refresh_token_if_needed(tokens)
    athlete_id = tokens.get("athlete_id")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    synced = 0

    async with httpx.AsyncClient(timeout=30.0) as http:
        # 1) Paginate through ALL activities
        all_activities = []
        page = 1
        while True:
            resp = await http.get(
                "https://www.strava.com/api/v3/athlete/activities",
                headers=headers,
                params={"per_page": 200, "page": page},
            )
            if resp.status_code != 200:
                break
            batch = resp.json()
            if not batch:
                break
            all_activities.extend(batch)
            page += 1

        # Get profile for HR % calculation
        prof_q = {"athlete_id": athlete_id} if athlete_id else {}
        profile = await db.profile.find_one(prof_q)
        max_hr_profile = profile.get("max_hr", 200) if profile else 200

        # 2) Process each run
        for act in all_activities:
            if act.get("type") != "Run":
                continue

            strava_id = act["id"]
            distance_km = round(act.get("distance", 0) / 1000, 2)
            duration_min = round(act.get("moving_time", 0) / 60, 2)
            avg_speed = act.get("average_speed", 0)
            avg_pace = _format_pace(avg_speed)
            avg_hr = act.get("average_heartrate")
            max_hr = act.get("max_heartrate")
            date_str = act.get("start_date_local", "")[:10]

            # Get summary polyline from the activity list data
            summary_polyline = act.get("map", {}).get("summary_polyline", "")
            start_latlng = act.get("start_latlng", [])

            # Fetch detailed activity for splits + full polyline + streams
            splits = []
            full_polyline = ""
            streams_data = None  # per-point streams for detailed chart
            detail: dict = {}  # populated below if detail fetch succeeds

            try:
                detail_resp = await http.get(
                    f"https://www.strava.com/api/v3/activities/{strava_id}",
                    headers=headers,
                )
                if detail_resp.status_code == 200:
                    detail = detail_resp.json()
                    full_polyline = detail.get("map", {}).get("polyline", "") or summary_polyline

                    # Fetch full streams (per-point data)
                    try:
                        streams_resp = await http.get(
                            f"https://www.strava.com/api/v3/activities/{strava_id}/streams",
                            headers=headers,
                            params={
                                "keys": "distance,heartrate,cadence,altitude,velocity_smooth,latlng",
                                "key_type": "stream",
                            },
                        )
                        if streams_resp.status_code == 200:
                            raw = {s["type"]: s["data"] for s in streams_resp.json()}
                            dist = raw.get("distance", [])
                            hr = raw.get("heartrate", [])
                            cad = raw.get("cadence", [])
                            alt = raw.get("altitude", [])
                            vel = raw.get("velocity_smooth", [])
                            latlng = raw.get("latlng", [])
                            n = len(dist)

                            # Downsample to ~500 points for charts + best-effort precision
                            step = max(1, n // 500)
                            streams_data = []
                            for j in range(0, n, step):
                                pt = {"d": round(dist[j], 1)}
                                if j < len(hr): pt["hr"] = hr[j]
                                if j < len(cad): pt["cad"] = round(cad[j] * 2)  # spm
                                if j < len(alt): pt["alt"] = round(alt[j], 1)
                                if j < len(vel) and vel[j] > 0:
                                    pace_s = 1000 / vel[j]
                                    pt["pace"] = round(pace_s, 1)  # sec/km
                                if j < len(latlng): pt["ll"] = latlng[j]  # [lat, lng]
                                streams_data.append(pt)
                    except Exception:
                        pass

                    # Build cadence lookup from streams for splits
                    cadence_per_km: dict = {}
                    if streams_data:
                        km_cads: dict = {}
                        for pt in streams_data:
                            if "cad" in pt and "d" in pt:
                                km_idx = int(pt["d"] / 1000) + 1
                                km_cads.setdefault(km_idx, []).append(pt["cad"])
                        for km_idx, cads in km_cads.items():
                            cadence_per_km[km_idx] = round(sum(cads) / len(cads))

                    for i, sp in enumerate(detail.get("splits_metric", []), 1):
                        splits.append({
                            "km": i,
                            "pace": _format_pace(sp.get("average_speed", 0)),
                            "hr": sp.get("average_heartrate"),
                            "cadence": cadence_per_km.get(i) or (round(sp.get("average_cadence", 0) * 2) if sp.get("average_cadence") else None),
                            "distance": sp.get("distance", 0),
                            "elapsed_time": sp.get("elapsed_time", 0),
                            "elevation_difference": sp.get("elevation_difference", 0),
                        })
            except Exception:
                full_polyline = summary_polyline

            # NEW: FIT Dynamics Extraction
            fit_dynamics = {}
            try:
                # Use GET /activities/{id}/export as per senior instruction
                fit_resp = await http.get(
                    f"https://www.strava.com/api/v3/activities/{strava_id}/export",
                    headers=headers
                )
                if fit_resp.status_code == 200:
                    fit_dynamics = _extract_fit_dynamics(fit_resp.content)
            except Exception as e:
                print(f"[FIT-Download] Error for {strava_id}: {e}")

            # Detect treadmill: Strava sets trainer=True for indoor/treadmill activities
            is_treadmill = bool(act.get("trainer", False))

            run_doc = {
                "athlete_id": athlete_id,
                "strava_id": strava_id,
                "name": act.get("name", ""),
                "date": date_str,
                "distance_km": distance_km,
                "duration_minutes": duration_min,
                "avg_pace": avg_pace,
                "avg_hr": round(avg_hr) if avg_hr else None,
                "max_hr": round(max_hr) if max_hr else None,
                "avg_hr_pct": round((avg_hr / max_hr_profile) * 100) if avg_hr else None,
                "max_hr_pct": round((max_hr / max_hr_profile) * 100) if max_hr else None,
                "run_type": _classify_run({"distance_km": distance_km, "avg_pace": avg_pace}),
                "is_treadmill": is_treadmill,
                "notes": f"Importata da Strava: {act.get('name', '')}",
                "location": act.get("location_city") or act.get("timezone", "").split("/")[-1],
                "avg_cadence": act.get("average_cadence"),
                "elevation_gain": round(act.get("total_elevation_gain", 0), 1),
                "splits": splits,
                "streams": streams_data,  # per-point data: d, hr, cad, alt, pace, ll
                "polyline": full_polyline or summary_polyline,
                "start_latlng": start_latlng,
                "plan_feedback": None,
                # Running dynamics - Prefer processed FIT data over Strava summary
                "avg_vertical_oscillation": fit_dynamics.get("avg_vertical_oscillation") or detail.get("average_vertical_oscillation"),
                "avg_vertical_ratio":       fit_dynamics.get("avg_vertical_ratio") or detail.get("average_vertical_ratio"),
                "avg_ground_contact_time":  fit_dynamics.get("avg_ground_contact_time") or detail.get("average_ground_contact_time"),
                "avg_stride_length":        fit_dynamics.get("avg_stride_length") or detail.get("average_stride_length"),
            }

            await db.runs.update_one(
                {"strava_id": strava_id},
                {"$set": run_doc},
                upsert=True,
            )
            synced += 1

    # Update total_km on the athlete's profile
    if athlete_id:
        pipeline = [
            {"$match": {"athlete_id": athlete_id}},
            {"$group": {"_id": None, "total": {"$sum": "$distance_km"}}},
        ]
        agg = await db.runs.aggregate(pipeline).to_list(1)
        total = round(agg[0]["total"], 1) if agg else 0
        await db.profile.update_one({"athlete_id": athlete_id}, {"$set": {"total_km": total}})

    # ── Ricalcola CTL/ATL/TSB dopo ogni sync ──────────────────────────────────
    if athlete_id:
        profile_doc = await db.profile.find_one({"athlete_id": athlete_id})
        max_hr_p = int(profile_doc.get("max_hr", 190)) if profile_doc else 190
        resting_hr_p = int(profile_doc.get("resting_hr", 50)) if profile_doc else 50
        await _compute_fitness_freshness(athlete_id, max_hr_p, resting_hr_p)

    # ── Auto-adapt training plan on every sync ───────────────────────────────
    # Recalculate VDOT from latest runs and update future weeks if paces drifted
    adapt_result = None
    if athlete_id and synced > 0:
        try:
            adapt_result = await _auto_adapt_on_sync(athlete_id)
        except Exception:
            pass  # never fail the sync because of adapt

    return {"ok": True, "synced": synced, "auto_adapt": adapt_result}


# ═══════════════════════════════════════════════════════════════════════════════
#  PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/profile")
async def get_profile():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    doc = await db.profile.find_one(q)
    if not doc:
        return JSONResponse({"error": "no_profile"}, status_code=404)
    return oid(doc)


@app.patch("/api/profile")
async def update_profile(request: Request):
    body = await request.json()
    body.pop("id", None)
    body.pop("_id", None)
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    await db.profile.update_one(q, {"$set": body}, upsert=True)
    doc = await db.profile.find_one(q)
    return oid(doc)


# ═══════════════════════════════════════════════════════════════════════════════
#  RUNS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/runs")
async def get_runs():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # Exclude heavy fields (streams) from list endpoint to save memory
    projection = {"streams": 0}
    cursor = db.runs.find(q, projection).sort("date", -1)
    runs = await cursor.to_list(length=500)
    return {"runs": oids(runs)}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    from bson import ObjectId
    try:
        doc = await db.runs.find_one({"_id": ObjectId(run_id)})
    except Exception:
        doc = await db.runs.find_one({"strava_id": int(run_id)}) if run_id.isdigit() else None
    if not doc:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return oid(doc)


@app.get("/api/runs/{run_id}/splits")
async def get_run_splits(run_id: str):
    from bson import ObjectId
    try:
        doc = await db.runs.find_one({"_id": ObjectId(run_id)}, {"splits": 1})
    except Exception:
        doc = await db.runs.find_one({"strava_id": int(run_id)}, {"splits": 1}) if run_id.isdigit() else None
    if not doc:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return {"splits": doc.get("splits", [])}


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
async def get_dashboard():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    profile = await db.profile.find_one(q)
    if not profile:
        profile = {}

    # Last run
    last_run = await db.runs.find_one(q, sort=[("date", -1)])

    # Current training week
    today = dt.date.today().isoformat()
    current_week = await db.training_plan.find_one(
        {"week_start": {"$lte": today}, "week_end": {"$gte": today}}
    )

    next_session = None
    week_progress = None
    if current_week:
        sessions = current_week.get("sessions", [])
        for s in sessions:
            if not s.get("completed"):
                next_session = s
                break
        done_km = sum(s.get("target_distance_km", 0) for s in sessions if s.get("completed"))
        target_km = current_week.get("target_km", 0)
        week_progress = {
            "done_km": round(done_km, 1),
            "target_km": target_km,
            "pct": round((done_km / target_km) * 100) if target_km > 0 else 0,
        }

    # Fitness / Freshness
    ff_docs = await db.fitness_freshness.find(q).sort("date", -1).to_list(90)
    current_ff = None
    if ff_docs:
        latest = ff_docs[0]
        current_ff = {
            "ctl": latest.get("ctl", 0),
            "atl": latest.get("atl", 0),
            "tsb": latest.get("tsb", 0),
            "status": "Fresh" if latest.get("tsb", 0) > 5 else "Tired" if latest.get("tsb", 0) < -10 else "Neutral",
        }

    # Recovery score
    checkin = await db.recovery_checkins.find_one(sort=[("_id", -1)])
    recovery_score = None
    if checkin:
        factors = [checkin.get(k, 3) for k in ["energy", "sleep_quality", "muscle_soreness", "mood"]]
        recovery_score = round(sum(factors) / len(factors) * 20)

    return {
        "profile": oid(profile) if profile.get("_id") else profile,
        "next_session": next_session,
        "week_progress": week_progress,
        "fitness_freshness": oids(list(reversed(ff_docs))),
        "current_ff": current_ff,
        "last_run": oid(last_run) if last_run else None,
        "recovery_score": recovery_score,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  TRAINING PLAN
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/training-plan")
async def get_training_plan():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    cursor = db.training_plan.find(q).sort("week_number", 1)
    weeks = await cursor.to_list(length=100)
    return {"weeks": oids(weeks)}


@app.get("/api/training-plan/current")
async def get_current_week():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    today = dt.date.today().isoformat()
    doc = await db.training_plan.find_one(
        {**q, "week_start": {"$lte": today}, "week_end": {"$gte": today}}
    )
    if not doc:
        candidates = await db.training_plan.find(q).sort("week_number", -1).to_list(1)
        doc = candidates[0] if candidates else None
    if not doc:
        return JSONResponse({"error": "no_plan"}, status_code=404)
    return oid(doc)


@app.patch("/api/training-plan/session/complete")
async def toggle_session_complete(request: Request):
    body = await request.json()
    week_id = body.get("week_id")
    session_index = body.get("session_index")
    completed = body.get("completed", False)

    from bson import ObjectId
    try:
        filter_q = {"_id": ObjectId(week_id)}
    except Exception:
        filter_q = {"id": week_id}

    doc = await db.training_plan.find_one(filter_q)
    if not doc:
        return JSONResponse({"error": "week_not_found"}, status_code=404)

    sessions = doc.get("sessions", [])
    if 0 <= session_index < len(sessions):
        sessions[session_index]["completed"] = completed
        await db.training_plan.update_one(filter_q, {"$set": {"sessions": sessions}})

    return {"ok": True}


# ─── Training Plan — generation helpers ──────────────────────────────────────
# All formulas from Jack Daniels' "Running Formula" 3rd ed. (2013)
# VO2 = -4.60 + 0.182258·v + 0.000104·v²   (v in m/min)
# %max = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)  (t in min)
# VDOT = VO2 / %max
# ─────────────────────────────────────────────────────────────────────────────

RACE_DISTANCES = {"5K": 5.0, "10K": 10.0, "Half Marathon": 21.0975, "Marathon": 42.195}

def _tp_daniels_paces(vdot: float) -> dict:
    """Compute Daniels 5-zone training paces from VDOT."""
    def pace_at_pct(pct: float) -> Optional[str]:
        vo2 = vdot * pct
        disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
        if disc < 0:
            return None
        v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)  # m/min
        return _format_pace(v / 60) if v > 0 else None
    return {
        "easy":       pace_at_pct(0.65),
        "marathon":   pace_at_pct(0.80),
        "threshold":  pace_at_pct(0.88),
        "interval":   pace_at_pct(0.98),
        "repetition": pace_at_pct(1.10),
    }


def _time_to_vdot(dist_km: float, time_minutes: float) -> Optional[float]:
    """Inverse Daniels: given a race distance + finish time → VDOT.

    Uses the same iterative Newton approach as _vdot_to_race_time but in reverse:
    for a known time t and distance d, compute VO2 from speed, then VDOT = VO2 / %max.
    """
    if dist_km <= 0 or time_minutes <= 0:
        return None
    v = (dist_km * 1000) / time_minutes  # m/min
    vo2 = -4.60 + 0.182258 * v + 0.000104 * v ** 2
    pct = 0.8 + 0.1894393 * math.exp(-0.012778 * time_minutes) + 0.2989558 * math.exp(-0.1932605 * time_minutes)
    if pct <= 0:
        return None
    return round(vo2 / pct, 2)


def _parse_time_str(ts: str) -> Optional[float]:
    """Parse 'mm:ss' or 'h:mm:ss' into total minutes."""
    if not ts:
        return None
    parts = ts.strip().split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) + int(parts[1]) / 60.0
        elif len(parts) == 3:
            return int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 60.0
    except (ValueError, IndexError):
        return None
    return None


def _assess_feasibility(current_vdot: float, target_vdot: float, weeks: int,
                         peak_vdot: float = None, dist_km: float = 5.0) -> dict:
    """Assess feasibility with history-aware progression rates.

    Scientific basis:
    - Daniels (2013): 0.3–0.8 VDOT/mesocycle for new gains in trained amateurs
    - Mujika & Padilla (2000): VO2max detraining reversal is 1.5–2× faster
      than initial gains due to preserved capillarization and mitochondrial
      density ("muscle memory", Staron et al. 1991)
    - Pfitzinger (2015): diminishing returns above VDOT ~50

    Recovery vs New Territory:
      If target ≤ athlete's historical peak, faster rates apply because the
      cardiovascular and neuromuscular adaptations were previously achieved.
      - Recovery conservative: 0.8 VDOT/mesocycle
      - Recovery optimistic:  1.2 VDOT/mesocycle
      - New-gains conservative: 0.5 VDOT/mesocycle
      - New-gains optimistic:   0.8 VDOT/mesocycle
    """
    gap = target_vdot - current_vdot
    mesocycles = weeks / 3.5

    # Determine if athlete is recovering to a previous level
    is_recovery = (peak_vdot is not None
                   and target_vdot <= peak_vdot
                   and peak_vdot > current_vdot)

    if is_recovery:
        conservative_rate = 0.8
        optimistic_rate = 1.2
    else:
        conservative_rate = 0.5
        optimistic_rate = 0.8

    max_conservative = mesocycles * conservative_rate
    max_optimistic = mesocycles * optimistic_rate

    # Always compute both paths so the frontend can offer a choice
    conservative_vdot = round(min(target_vdot, current_vdot + max_conservative), 2)
    optimistic_vdot = round(min(target_vdot, current_vdot + max_optimistic), 2)
    conservative_time = _vdot_to_race_time(conservative_vdot, dist_km)
    optimistic_time = _vdot_to_race_time(optimistic_vdot, dist_km)
    original_time = _vdot_to_race_time(target_vdot, dist_km)

    base = {
        "conservative_vdot": conservative_vdot,
        "conservative_time": conservative_time,
        "conservative_rate": conservative_rate,
        "optimistic_vdot": optimistic_vdot,
        "optimistic_time": optimistic_time,
        "optimistic_rate": optimistic_rate,
        "original_target_time": original_time,
        "is_recovery": is_recovery,
    }

    if gap <= 0:
        return {**base, "feasible": True, "difficulty": "already_there",
                "message": f"Il tuo VDOT attuale ({current_vdot}) è già sufficiente per l'obiettivo ({target_vdot}). Piano di mantenimento.",
                "confidence_pct": 95}
    elif gap <= max_conservative:
        msg = (f"Obiettivo realistico: +{gap:.1f} VDOT in {weeks} settimane "
               f"({gap/mesocycles:.1f}/mesociclo). ")
        msg += ("Recupero verso livello precedente — progressione accelerata."
                if is_recovery else "Progressione standard Daniels.")
        return {**base, "feasible": True, "difficulty": "realistic",
                "message": msg, "confidence_pct": 80}
    elif gap <= max_optimistic:
        msg = (f"Obiettivo ambizioso: +{gap:.1f} VDOT in {weeks} settimane "
               f"({gap/mesocycles:.1f}/mesociclo). ")
        msg += ("Recupero aggressivo — richiede costanza e disciplina."
                if is_recovery else "Richiede costanza totale e zero interruzioni.")
        return {**base, "feasible": True, "difficulty": "challenging",
                "message": msg, "confidence_pct": 55}
    else:
        suggested_weeks = int(math.ceil(gap / conservative_rate * 3.5))
        msg = (f"Gap di +{gap:.1f} VDOT in {weeks} settimane. "
               f"Scegli tra piano conservativo o aggressivo.")
        return {**base, "feasible": False, "difficulty": "unrealistic",
                "message": msg, "confidence_pct": 20,
                "suggested_weeks": suggested_weeks}


def _build_vdot_progression(current: float, target: float, weeks_total: int,
                             phase_alloc: list) -> list[float]:
    """Build per-week VDOT targets with periodized progression.

    Daniels principle: VDOT improvements are NOT linear.
    - Base: slow gains (+0.05/week)    — aerobic foundation
    - Sviluppo: moderate (+0.15/week)  — threshold work kicks in
    - Intensità: fastest (+0.25/week)  — VO2max stimulus
    - Specifico: moderate (+0.15/week) — race-specific consolidation
    - Taper: maintain (0)              — supercompensation
    - Gara: maintain (0)               — peak
    """
    gap = target - current
    if gap <= 0:
        return [current] * weeks_total

    # Phase gain rates (relative weight of VDOT gain per week)
    phase_rates = {
        "Base Aerobica": 0.10,
        "Sviluppo":      0.20,
        "Intensità":     0.35,
        "Specifico":     0.20,
        "Taper":         0.00,
        "Gara":          0.00,
    }

    # Calculate total weighted weeks to distribute the gap
    total_weight = sum(phase_rates.get(name, 0) * n for name, n in phase_alloc)
    if total_weight <= 0:
        return [current] * weeks_total

    progression = []
    running_vdot = current
    for phase_name, phase_len in phase_alloc:
        rate = phase_rates.get(phase_name, 0)
        for _ in range(phase_len):
            if total_weight > 0 and rate > 0:
                week_gain = (gap * rate) / total_weight
                running_vdot += week_gain
            # Cap at target
            running_vdot = min(running_vdot, target)
            progression.append(round(running_vdot, 2))

    return progression


def _tp_quality_session(phase: str, goal: str, dist_km: float,
                         paces: dict, week_vdot: float) -> tuple:
    """Return (type, title, description, pace) for the weekly quality session.

    Sessions are designed per Daniels' phase philosophy:
    - Base: only easy running, build aerobic enzymes + capillaries
    - Sviluppo: tempo/threshold work, raise lactate turnpoint
    - Intensità: VO2max intervals, raise aerobic ceiling
    - Specifico: race-pace practice, neuromuscular + psychological
    - Taper/Gara: reduced volume, maintain sharpness
    """
    ep = paces.get("easy") or "6:00"
    mp = paces.get("marathon") or "5:20"
    tp = paces.get("threshold") or "5:00"
    ip = paces.get("interval") or "4:30"
    rp = paces.get("repetition") or "4:10"
    race_pace = _vdot_to_race_time(week_vdot, RACE_DISTANCES.get(goal, 5.0))

    if phase == "Base Aerobica":
        if int(dist_km * 10) % 3 == 0:
            return ("easy", "Fartlek Collinare",
                    f"Corsa facile {round(dist_km, 1)} km @ {ep}/km su percorso ondulato. "
                    f"Aumenta leggermente lo sforzo sulle salite (passo {mp}/km) e recupera in discesa. "
                    f"Obiettivo: forza muscolare e condizionamento aerobico.", ep)
        return ("easy", "Corsa Aerobica Progressiva",
                f"Corsa a ritmo conversazionale con ultimi 2 km leggermente più veloci. "
                f"Passo {ep}/km → chiudi a passo {mp}/km. Sforzo 4–5/10. "
                f"Obiettivo: costruire base mitocondriale e capillare.", ep)

    if phase == "Sviluppo":
        if goal in ("Marathon", "Half Marathon"):
            return ("tempo", "Corsa a Soglia Continua",
                    f"15 min warm-up @ {ep}/km · 25 min continui @ {tp}/km (soglia lattacida ~88% VO₂max) · "
                    f"10 min defaticamento. VDOT settimana: {week_vdot}.", tp)
        
        # 5K e 10K includono corse in salita per la potenza
        if int(dist_km * 10) % 2 == 0:
            return ("intervals", "Ripetute Medie in Salita",
                    f"2 km warm-up · 8×60 s in salita (pendenza 6–8%) a sforzo equivalente a {ip}/km · "
                    f"Recupero passo gara in discesa · 2 km defaticamento. Potenzia la forza specifica.", ip)
        
        return ("tempo", "Tempo Run",
                f"2 km warm-up · 20 min continui @ {tp}/km (soglia ~88% VO₂max) · "
                f"2 km defaticamento. VDOT settimana: {week_vdot}.", tp)

    if phase == "Intensità":
        if goal == "5K":
            return ("intervals", "VO₂max 400 m",
                    f"2 km warm-up · 12×400 m @ {ip}/km (95–100% VO₂max) con 90 s jog recupero · "
                    f"2 km defaticamento. VDOT target: {week_vdot}.", ip)
        if goal == "10K":
            return ("intervals", "VO₂max 800 m",
                    f"2 km warm-up · 6×800 m @ {ip}/km (95–100% VO₂max) con 2 min jog · "
                    f"2 km defaticamento. VDOT target: {week_vdot}.", ip)
        if goal == "Half Marathon":
            return ("intervals", "Cruise Intervals",
                    f"2 km warm-up · 4×1600 m @ {tp}/km (~88% VO₂max) con 60 s recupero · "
                    f"2 km defaticamento. VDOT target: {week_vdot}.", tp)
        return ("intervals", "Marathon VO₂max",
                f"2 km warm-up · 5×1000 m @ {ip}/km con 3 min jog · "
                f"2 km defaticamento. VDOT target: {week_vdot}.", ip)

    if phase == "Specifico":
        rp_str = race_pace or tp
        if goal == "5K":
            return ("intervals", "Race Pace 5K",
                    f"2 km warm-up · 3×1600 m a ritmo gara 5K (target {rp_str}) con 2 min recupero · "
                    f"2 km defaticamento. Simulazione dello sforzo gara.", ip)
        if goal == "10K":
            return ("intervals", "Race Pace 10K",
                    f"2 km warm-up · 4×2000 m a ritmo gara 10K (target {rp_str}) con 90 s recupero · "
                    f"2 km defaticamento. Abituarsi al ritmo gara.", ip)
        if goal == "Half Marathon":
            km_spec = round(min(dist_km, 14), 1)
            return ("tempo", "Race Pace HM",
                    f"2 km warm-up · {km_spec} km continui @ {tp}/km (ritmo gara HM, target {rp_str}) · "
                    f"2 km defaticamento.", tp)
        mp_km = round(min(dist_km, 25), 1)
        return ("tempo", "Simulazione Maratona",
                f"2 km warm-up · {mp_km} km @ {mp}/km (passo maratona, target {rp_str}) · "
                f"2 km defaticamento.", mp)

    if phase == "Taper":
        return ("easy", "Easy + Strides",
                f"Corsa facile {round(dist_km, 1)} km @ {ep}/km con 4×100 m progressivi finale. "
                f"Mantieni le gambe reattive, VDOT = {week_vdot}.", ep)

    # Gara
    return ("easy", "Attivazione Pre-Gara",
            f"Corsa leggera {round(dist_km, 1)} km @ {ep}/km. Gambe fresche per la gara.", ep)


def _tp_secondary_quality_session(phase: str, goal: str, dist_km: float,
                                   paces: dict, week_vdot: float) -> tuple:
    """Return (type, title, description, pace) for a SECONDARY quality session (Thursday).

    This session complements the main quality session (Tuesday) without overloading.
    Daniels' principle: never two hard days in a row, keep it lighter than main session.
    """
    ep = paces.get("easy") or "6:00"
    mp = paces.get("marathon") or "5:20"
    tp = paces.get("threshold") or "5:00"
    ip = paces.get("interval") or "4:30"
    rp = paces.get("repetition") or "4:10"

    if phase == "Base Aerobica":
        # Base phase: progressive run with some pickups, not truly "quality"
        return ("easy", "Corsa Progressiva + Allunghi",
                f"Corsa facile {round(dist_km, 1)} km @ {ep}/km. Ultimi 3 km più veloci (passo {mp}/km) "
                f"+ 4×80 m progressivi finali. Obiettivo: mantenere reattività delle gambe senza stress.", ep)

    if phase == "Sviluppo":
        # Short tempo intervals at slightly above threshold — builds speed endurance
        return ("tempo", "Tempo Intervals Corti",
                f"2 km warm-up @ {ep}/km · 3×6 min @ {tp}/km (soglia) con 2 min recupero jog · "
                f"2 km defaticamento. Totale 20 min di lavoro di soglia. VDOT: {week_vdot}.", tp)

    if phase == "Intensità":
        # Short VO2max intervals — quick, sharp, not exhausting
        return ("intervals", "Ripetute Brevi VO₂max",
                f"2 km warm-up @ {ep}/km · 8×400 m @ {ip}/km con 60 s jog recupero · "
                f"2 km defaticamento. Obiettivo: stimolare il massimo consumo d'ossigeno. VDOT: {week_vdot}.", ip)

    if phase == "Specifico":
        # Race pace intervals — shorter than main session, focus on form
        race_pace = _vdot_to_race_time(week_vdot, RACE_DISTANCES.get(goal, 5.0))
        rp_str = race_pace or tp
        return ("intervals", "Race Pace Intervals",
                f"2 km warm-up @ {ep}/km · 4×800 m a ritmo gara (target {rp_str}) con 90 s recupero · "
                f"2 km defaticamento. Lavoro sulla tecnica e memoria del ritmo gara. VDOT: {week_vdot}.", ip)

    if phase == "Taper":
        # Light strides only — keep legs sharp, no fatigue
        return ("easy", "Easy + 4×100 m Strides",
                f"Corsa facile {round(dist_km, 1)} km @ {ep}/km con 4×100 m progressivi. "
                f"Gambe fresche in vista della gara. VDOT = {week_vdot}.", ep)

    # Gara week: minimal activation
    return ("easy", "Activazione Leggera",
            f"Corsa leggera {round(dist_km, 1)} km @ {ep}/km. No allunghi — conserva energie per la gara.", ep)


def _tp_strength_exercises(phase: str, day_type: str, week_in_phase: int = 0) -> list:
    """Generate phase-appropriate strength, prehab, and plyometric exercises.

    Scientific basis:
    - Beattie et al. (2017): heavy resistance training improves running economy
    - Lauersen et al. (2014): strength training reduces injury risk by 68%
    - Saunders et al. (2006): plyometrics improve 3K running economy by 4.1%
    - Fredericson & Moore (2005): hip abductor weakness linked to ITBS/knee injury
    """
    # Core exercises — every phase, always useful
    prehab = [
        {"name": "Clamshell", "sets": 3, "reps": "15/lato", "note": "Banda elastica sopra ginocchia. Previene ITBS."},
        {"name": "Single-Leg Glute Bridge", "sets": 3, "reps": "12/lato", "note": "Attivazione gluteo medio. Stabilità bacino."},
        {"name": "Eccentric Heel Drop", "sets": 3, "reps": "15/lato", "note": "Prevenzione tendinopatia achillea (Alfredson protocol)."},
        {"name": "Dead Bug", "sets": 3, "reps": "10/lato", "note": "Core anti-estensione. Stabilità lombare."},
    ]

    strength_base = [
        {"name": "Squat a corpo libero", "sets": 3, "reps": 15, "note": "Forza base quadricipite e glutei."},
        {"name": "Affondo camminato", "sets": 3, "reps": "10/lato", "note": "Forza unilaterale + equilibrio."},
        {"name": "Calf Raise (tallone rialzato)", "sets": 3, "reps": 20, "note": "Rinforzo tricipite surale. Previene fascite."},
        {"name": "Step-Up su rialzo", "sets": 3, "reps": "10/lato", "note": "Simula fase di spinta della corsa."},
    ]

    strength_heavy = [
        {"name": "Bulgarian Split Squat", "sets": 3, "reps": "8/lato", "note": "Forza massima unilaterale (Beattie 2017)."},
        {"name": "Single-Leg Deadlift", "sets": 3, "reps": "10/lato", "note": "Catena posteriore + propriocezione."},
        {"name": "Calf Raise Eccentrico", "sets": 3, "reps": "12/lato", "note": "Carico eccentrico, previene lesioni Achille."},
        {"name": "Nordic Hamstring Curl", "sets": 3, "reps": 6, "note": "Prevenzione infortuni ischio-crurali (van der Horst 2015)."},
    ]

    plyo = [
        {"name": "A-Skip", "sets": 3, "reps": "20 m", "note": "Coordinazione neuromuscolare + elasticità tendine."},
        {"name": "Single-Leg Hop (avanti)", "sets": 3, "reps": "8/lato", "note": "Potenza specifica per la corsa."},
        {"name": "Drop Jump (gradino 20 cm)", "sets": 3, "reps": 8, "note": "Ciclo stiramento-accorciamento (Saunders 2006)."},
        {"name": "Bounding", "sets": 3, "reps": "30 m", "note": "Forza reattiva + ampiezza falcata."},
    ]

    if day_type == "rest":
        # Rest day: full strength session (prehab + strength)
        if phase == "Base Aerobica":
            return prehab + strength_base
        elif phase in ("Sviluppo", "Intensità"):
            return prehab + strength_heavy
        elif phase == "Specifico":
            return prehab[:2] + strength_heavy[:2] + plyo[:2]
        else:  # Taper / Gara
            return prehab[:2]  # minimal maintenance

    elif day_type == "easy":
        # Easy run day: light prehab post-run
        if phase in ("Base Aerobica", "Sviluppo"):
            return prehab[:2] + [{"name": "Calf Raise", "sets": 2, "reps": 15, "note": "Post-corsa, rinforzo base."}]
        elif phase == "Intensità":
            return prehab[:2] + plyo[:1]  # light plyo
        else:
            return prehab[:1]  # minimal

    elif day_type == "long":
        # Long run day: mobility only
        return [
            {"name": "Foam Rolling (IT band + polpacci)", "sets": 1, "reps": "60 s/lato", "note": "Recupero post-lungo."},
            {"name": "Pigeon Stretch", "sets": 1, "reps": "45 s/lato", "note": "Mobilità anca."},
        ]

    # Quality session days: no strength (focus on running)
    return []


def _tp_build_sessions(week_start, week_km: float, phase: str, goal: str,
                       paces: dict, week_vdot: float) -> list:
    """Build 7-day session list for a training week."""
    from datetime import timedelta
    day_names = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    ep = paces.get("easy") or "6:00"

    # Day layout depends on goal distance (more sessions for longer races)
    if goal == "5K":
        dist_map = {0: 0.20, 1: 0.25, 3: 0.20, 5: 0.35}
    elif goal == "10K":
        dist_map = {0: 0.20, 1: 0.22, 2: 0.13, 3: 0.18, 5: 0.27}
    elif goal == "Half Marathon":
        dist_map = {0: 0.18, 1: 0.18, 2: 0.12, 3: 0.17, 5: 0.35}
    else:  # Marathon
        dist_map = {0: 0.16, 1: 0.14, 2: 0.12, 3: 0.14, 4: 0.10, 5: 0.34}

    sessions = []
    for day_offset in range(7):
        session_date = week_start + timedelta(days=day_offset)

        if day_offset not in dist_map:
            exercises = _tp_strength_exercises(phase, "rest")
            rest_desc = "Giorno di riposo. Recupero attivo: stretching, foam rolling o camminata."
            if exercises:
                rest_desc += " Sessione di forza/prehab consigliata."
            sessions.append({
                "day": day_names[day_offset],
                "date": session_date.isoformat(),
                "type": "rest",
                "title": "Riposo + Forza" if exercises else "Riposo",
                "description": rest_desc,
                "target_distance_km": 0,
                "target_pace": None,
                "target_duration_min": None,
                "completed": False,
                "run_id": None,
                "strength_exercises": exercises,
            })
            continue

        dist_km = round(week_km * dist_map[day_offset], 1)

        if day_offset == 1:  # Tuesday = MAIN quality session
            s_type, title, desc, pace = _tp_quality_session(phase, goal, dist_km, paces, week_vdot)
        elif day_offset == 3:  # Thursday = SECONDARY quality session (shorter intervals/tempo)
            s_type, title, desc, pace = _tp_secondary_quality_session(phase, goal, dist_km, paces, week_vdot)
        elif day_offset == 5:  # Saturday = long run
            s_type, title, pace = "long", "Corsa Lunga", ep
            desc = (f"Corsa lunga {dist_km} km a passo {ep}/km. Sforzo 5–6/10. "
                    f"Costruisci resistenza aerobica e fibre lente (tipo I). Idratazione costante.")
        else:
            s_type, title, pace = "easy", "Corsa Facile", ep
            desc = (f"Corsa facile {dist_km} km a passo {ep}/km. "
                    f"Sforzo percepito 3–4/10. Frequenza cardiaca Z1–Z2.")

        try:
            pp = pace.split(":")
            dur: Optional[int] = round(dist_km * (int(pp[0]) * 60 + int(pp[1])) / 60)
        except Exception:
            dur = None

        # Assign strength exercises based on session type
        if s_type == "long":
            exercises = _tp_strength_exercises(phase, "long")
        elif s_type == "easy":
            exercises = _tp_strength_exercises(phase, "easy")
        else:
            exercises = []  # quality days: focus on running

        sessions.append({
            "day": day_names[day_offset],
            "date": session_date.isoformat(),
            "type": s_type,
            "title": title,
            "description": desc,
            "target_distance_km": dist_km,
            "target_pace": pace,
            "target_duration_min": dur,
            "completed": False,
            "run_id": None,
            "strength_exercises": exercises,
        })

    return sessions


def _generate_plan_weeks(goal_race: str, weeks_total: int, max_weekly_km: float,
                          current_vdot: float, target_vdot: float,
                          athlete_id, target_time_str: str) -> list:
    """Generate goal-driven periodized plan with weekly VDOT progression."""
    from datetime import date, timedelta

    weeks_total = max(8, min(int(weeks_total), 32))

    # ── Periodization: phase allocation (Daniels 4-phase model adapted) ──────
    if weeks_total <= 10:
        # For short plans (≤10 weeks), maximize quality sessions.
        # Every week should have at least 1 quality session except taper/race.
        # Base: 1-2 weeks (build aerobic foundation quickly)
        # Sviluppo: 1 week (threshold work)
        # Intensità: 3-4 weeks (VO2max intervals — most important for 5K)
        # Specifico: 1 week (race pace practice)
        # Taper: 1 week
        # Gara: 1 week
        raw_phases = [
            ("Base Aerobica", 0.15), ("Sviluppo", 0.10), ("Intensità", 0.45),
            ("Specifico", 0.15), ("Taper", 0.10), ("Gara", 0.05),
        ]
    elif weeks_total <= 16:
        raw_phases = [
            ("Base Aerobica", 0.25), ("Sviluppo", 0.20), ("Intensità", 0.25),
            ("Specifico", 0.10), ("Taper", 0.12), ("Gara", 0.08),
        ]
    else:
        raw_phases = [
            ("Base Aerobica", 0.22), ("Sviluppo", 0.18), ("Intensità", 0.22),
            ("Specifico", 0.18), ("Taper", 0.12), ("Gara", 0.08),
        ]

    phase_alloc = []
    remaining = weeks_total
    for i, (name, frac) in enumerate(raw_phases):
        n = max(1, round(frac * weeks_total)) if i < len(raw_phases) - 1 else max(1, remaining)
        remaining -= n
        phase_alloc.append((name, n))

    # ── VDOT progression per week ────────────────────────────────────────────
    vdot_progression = _build_vdot_progression(current_vdot, target_vdot, weeks_total, phase_alloc)

    # ── Volume progression with 3:1 loading pattern ──────────────────────────
    # Start at ~60% of max, build to max by end of Intensità, then taper
    start_km = max(15.0, max_weekly_km * 0.55)
    current_km = start_km

    today = date.today()
    days_ahead = (7 - today.weekday()) % 7 or 7
    start_date = today + timedelta(days=days_ahead)

    phase_descs = {
        "Base Aerobica": "Costruzione della base aerobica. Corse facili e progressive per sviluppare capillari e mitocondri.",
        "Sviluppo":      "Sviluppo soglia anaerobica con lavori al ritmo T (88% VO₂max). Obiettivo: alzare il turnpoint del lattato.",
        "Intensità":     "Stimolo VO₂max con intervalli I-pace (95–100% VO₂max). Massima crescita del VDOT in questa fase.",
        "Specifico":     "Lavoro a ritmo gara per adattamento neuromuscolare e psicologico alla velocità target.",
        "Taper":         "Riduzione progressiva del volume (−40/60%) mantenendo l'intensità. Supercompensazione.",
        "Gara":          "Settimana della gara. Volume minimo, attivazioni leggere, gambe fresche.",
    }

    weeks = []
    week_number = 1
    current_date = start_date
    week_idx = 0

    for phase_name, phase_len in phase_alloc:
        for week_in_phase in range(phase_len):
            is_recovery = (
                phase_name not in ("Taper", "Gara") and
                phase_len >= 3 and
                (week_in_phase + 1) % 4 == 0  # every 4th week = recovery
            )

            # Volume strategy
            if phase_name == "Taper":
                # Mujika & Padilla (2003): 40-60% volume reduction, maintain intensity
                taper_pct = 0.70 - 0.15 * week_in_phase
                week_km = max_weekly_km * max(0.35, taper_pct)
            elif phase_name == "Gara":
                week_km = max_weekly_km * 0.25
            elif is_recovery:
                week_km = current_km * 0.65  # 35% reduction
            else:
                week_km = min(current_km, max_weekly_km)
                # Bompa periodization: ~7-10% overload per mesocycle week
                current_km = min(current_km * 1.08, max_weekly_km)

            week_km = round(max(10.0, week_km), 1)
            wv = vdot_progression[week_idx] if week_idx < len(vdot_progression) else target_vdot
            paces = _tp_daniels_paces(wv)

            week_start = current_date
            week_end = current_date + timedelta(days=6)

            sessions = _tp_build_sessions(week_start, week_km, phase_name, goal_race, paces, wv)

            weeks.append({
                "athlete_id": athlete_id,
                "week_number": week_number,
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "phase": phase_name,
                "phase_description": phase_descs.get(phase_name, ""),
                "target_km": week_km,
                "target_vdot": wv,
                "is_recovery_week": is_recovery,
                "sessions": sessions,
                "goal_race": goal_race,
                "target_time": target_time_str,
            })

            week_number += 1
            current_date += timedelta(weeks=1)
            week_idx += 1

    return weeks


@app.post("/api/training-plan/generate")
async def generate_training_plan(request: Request):
    """Generate a goal-driven training plan with history-aware calibration.

    Flow:
    1. Compute current VDOT (from recent runs or optional test input)
    2. Compute peak VDOT (all-time best — for recovery detection)
    3. Assess feasibility with history-aware rates
    4. If NOT feasible AND no plan_mode → dry_run (return assessment only)
    5. If feasible OR plan_mode chosen → generate full plan

    Optional params:
    - plan_mode: "conservative" | "aggressive" — pick path when goal is infeasible
    - test_distance_km + test_time: manual test to override auto-VDOT
    """
    body = await request.json()
    goal_race = body.get("goal_race", "Half Marathon")
    weeks_to_race = int(body.get("weeks_to_race", 16))
    target_time_str = str(body.get("target_time", ""))
    plan_mode = body.get("plan_mode")              # None | "conservative" | "aggressive"
    test_distance_km = body.get("test_distance_km") # optional test calibration
    test_time_str = body.get("test_time")            # optional test time

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    profile = await db.profile.find_one(q)
    runs = await db.runs.find(q).sort("date", -1).to_list(500)

    max_hr = int((profile or {}).get("max_hr", 190))
    defaults_km = {"5K": 40.0, "10K": 50.0, "Half Marathon": 60.0, "Marathon": 70.0}
    raw_max_km = (profile or {}).get("max_weekly_km")
    max_weekly_km = float(raw_max_km) if raw_max_km else defaults_km.get(goal_race, 55.0)

    # ── FULL history analysis — escludi tapis roulant da VDOT ─────────────────
    q_gps = {**q, "is_treadmill": {"$ne": True}}
    all_runs = await db.runs.find(q_gps).sort("date", -1).to_list(None)
    dist_km = RACE_DISTANCES.get(goal_race, 5.0)
    history = _calc_vdot_with_history(all_runs, max_hr, weeks_window=52, goal_dist_km=dist_km)
    # current_vdot is ALWAYS the same regardless of goal distance —
    # it's derived from best recent runs (all qualifying distances).
    # race_specific_vdot was causing different VDOT per distance → removed.
    current_vdot = history["current"] or 30.0
    peak_vdot = history["peak"] or current_vdot

    # ── Optional test calibration ────────────────────────────────────────────
    test_vdot = None
    if test_distance_km and test_time_str:
        test_time_min = _parse_time_str(str(test_time_str))
        if test_time_min and test_time_min > 0:
            tv = _time_to_vdot(float(test_distance_km), test_time_min)
            if tv:
                test_vdot = round(min(tv, 55.0), 1)
                current_vdot = test_vdot  # override with test result

    # ── Target VDOT from goal time ───────────────────────────────────────────
    dist_km = RACE_DISTANCES.get(goal_race, 5.0)
    target_time_min = _parse_time_str(target_time_str)

    if target_time_min and target_time_min > 0:
        target_vdot = _time_to_vdot(dist_km, target_time_min)
        if not target_vdot:
            target_vdot = current_vdot
    else:
        target_vdot = current_vdot + 2.0

    target_vdot = round(min(target_vdot, 75.0), 2)
    original_target_vdot = target_vdot

    # ── Feasibility with history context ─────────────────────────────────────
    feasibility = _assess_feasibility(
        current_vdot, target_vdot, weeks_to_race,
        peak_vdot=peak_vdot, dist_km=dist_km,
    )

    # ── ALWAYS generate the plan with the user's EXACT requested goal ────────
    # No target reduction, no plan_mode — the user's goal is ALWAYS respected
    suggested_weeks = max(8, min(weeks_to_race, 32))
    suggested_months = round(suggested_weeks / 4.345, 1)  # weeks → months

    # Use the user's target VDOT directly — never reduce it
    effective_target_vdot = target_vdot

    # ── Calculate suggested weeks/months to reach the FULL user goal ─────────
    gap = original_target_vdot - current_vdot
    if gap > 0 and feasibility.get("conservative_rate"):
        rate_opt = feasibility["conservative_rate"] if feasibility.get("is_recovery") else 0.5
        weeks_needed = int(math.ceil(gap / rate_opt * 3.5))
        months_needed = round(weeks_needed / 4.345, 1)
        feasibility["suggested_weeks"] = weeks_needed
        feasibility["suggested_months"] = months_needed

    # ── Generate the plan ────────────────────────────────────────────────────
    weeks = _generate_plan_weeks(
        goal_race, suggested_weeks, max_weekly_km,
        current_vdot, effective_target_vdot, athlete_id, target_time_str,
    )

    await db.training_plan.delete_many(q)
    if weeks:
        await db.training_plan.insert_many(weeks)

    await db.profile.update_one(q, {"$set": {
        "plan_goal_race": goal_race,
        "plan_target_time": target_time_str,
        "plan_target_vdot": effective_target_vdot,
        "plan_current_vdot": current_vdot,
        "plan_weeks": suggested_weeks,
    }})

    # Format suggested timeframe in Italian
    if feasibility.get("suggested_weeks"):
        w = feasibility["suggested_weeks"]
        m = feasibility.get("suggested_months", 0)
        if w <= 4:
            feasibility["suggested_timeframe"] = f"{w} settimane"
        elif m < 2:
            feasibility["suggested_timeframe"] = f"{w} settimane"
        else:
            feasibility["suggested_timeframe"] = f"circa {m} mesi ({w} settimane)"

    return {
        "ok": True,
        "dry_run": False,
        "weeks_generated": len(weeks),
        "current_vdot": current_vdot,
        "target_vdot": effective_target_vdot,
        "peak_vdot": peak_vdot,
        "peak_date": history["peak_date"],
        "training_months": history["training_months"],
        "weekly_volume": history["weekly_volume"],
        "test_vdot": test_vdot,
        "feasibility": feasibility,
        "race_predictions": _predict_race(effective_target_vdot),
        "suggested_weeks": feasibility.get("suggested_weeks"),
        "suggested_months": feasibility.get("suggested_months"),
        "suggested_timeframe": feasibility.get("suggested_timeframe"),
    }


@app.post("/api/training-plan/evaluate-test")
async def evaluate_test(request: Request):
    """Evaluate a performance test and recalibrate the training plan.

    The athlete runs a test (e.g., 3km time trial or 5km race pace test).
    The new VDOT from the test is compared with the current plan VDOT.
    If the test shows improvement → plan becomes more aggressive.
    If the test shows decline → plan becomes more conservative.

    Scientific basis:
    - Daniels (2013): VDOT from time trials is the most accurate fitness indicator
    - Test should be >= 3km for reliable VO2max estimation
    - Recalibration uses the same progression logic as plan generation
    """
    body = await request.json()
    test_distance_km = float(body.get("test_distance_km", 0))
    test_time_str = str(body.get("test_time", ""))
    test_date = body.get("test_date", dt.date.today().isoformat())

    if test_distance_km < 3:
        return JSONResponse({"error": "test_too_short", "message": "Il test deve essere almeno 3km per una stima VDOT affidabile."}, status_code=400)

    test_time_min = _parse_time_str(test_time_str)
    if not test_time_min or test_time_min <= 0:
        return JSONResponse({"error": "invalid_time", "message": "Formato tempo non valido. Usa mm:ss o h:mm:ss."}, status_code=400)

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    # Calculate VDOT from test
    test_vdot = _time_to_vdot(test_distance_km, test_time_min)
    if not test_vdot:
        return JSONResponse({"error": "vdot_calc_failed", "message": "Impossibile calcolare il VDOT dal test."}, status_code=400)

    test_vdot = round(min(test_vdot, 55.0), 1)

    # Get current plan info
    profile = await db.profile.find_one(q)
    current_plan_vdot = profile.get("plan_target_vdot") if profile else None
    current_plan_vdot = current_plan_vdot or 40.0

    # Determine recalibration direction
    vdot_change = round(test_vdot - current_plan_vdot, 1)
    direction = "improved" if vdot_change > 0 else "declined" if vdot_change < 0 else "unchanged"

    # Calculate new target VDOT based on test
    # If test VDOT is higher, we can be more aggressive
    # If test VDOT is lower, we should be more conservative
    if direction == "improved":
        # Test shows improvement → use test VDOT as new baseline, add small buffer
        new_target_vdot = round(min(test_vdot + 0.5, 55.0), 1)
        confidence = min(95, 70 + int(abs(vdot_change) * 10))
    elif direction == "declined":
        # Test shows decline → be conservative, use test VDOT as ceiling
        new_target_vdot = round(max(test_vdot - 0.5, 25.0), 1)
        confidence = min(90, 60 + int(abs(vdot_change) * 8))
    else:
        new_target_vdot = current_plan_vdot
        confidence = 80

    # Get current plan weeks
    all_weeks = await db.training_plan.find(q).sort("week_number", 1).to_list(100)
    weeks_remaining = len([w for w in all_weeks if w.get("week_start", "") >= dt.date.today().isoformat()])

    # Generate new plan with recalibrated VDOT
    goal_race = profile.get("plan_goal_race", "5K") if profile else "5K"
    target_time_str = profile.get("plan_target_time", "") if profile else ""
    dist_km = RACE_DISTANCES.get(goal_race, 5.0)

    # Fetch all runs for history context
    all_runs = await db.runs.find(q).sort("date", -1).to_list(None)
    max_hr = int((profile or {}).get("max_hr", 190))
    history = _calc_vdot_with_history(all_runs, max_hr, weeks_window=52, goal_dist_km=dist_km)

    # Use test VDOT as the new current VDOT for plan generation
    effective_current_vdot = test_vdot

    # Generate new plan
    defaults_km = {"5K": 40.0, "10K": 50.0, "Half Marathon": 60.0, "Marathon": 70.0}
    raw_max_km = (profile or {}).get("max_weekly_km")
    max_weekly_km = float(raw_max_km) if raw_max_km else defaults_km.get(goal_race, 55.0)

    new_weeks = _generate_plan_weeks(
        goal_race, max(8, weeks_remaining), max_weekly_km,
        effective_current_vdot, new_target_vdot, athlete_id, target_time_str,
    )

    # Update plan in DB
    await db.training_plan.delete_many(q)
    if new_weeks:
        await db.training_plan.insert_many(new_weeks)

    # Update profile
    await db.profile.update_one(q, {"$set": {
        "plan_target_vdot": new_target_vdot,
        "plan_current_vdot": effective_current_vdot,
        "last_test_vdot": test_vdot,
        "last_test_date": test_date,
        "last_test_distance_km": test_distance_km,
        "last_test_time": test_time_str,
    }})

    # Format test result
    test_pace = _format_pace((test_distance_km * 1000) / (test_time_min * 60))

    return {
        "ok": True,
        "test_vdot": test_vdot,
        "test_pace": test_pace,
        "previous_plan_vdot": current_plan_vdot,
        "new_target_vdot": new_target_vdot,
        "vdot_change": vdot_change,
        "direction": direction,
        "confidence": confidence,
        "weeks_remaining": weeks_remaining,
        "weeks_regenerated": len(new_weeks),
        "message": (
            f"Test {test_distance_km}km in {test_time_str} → VDOT {test_vdot}. "
            f"{'Miglioramento!' if direction == 'improved' else 'Leggero calo.' if direction == 'declined' else 'Stabile.'} "
            f"Piano ricalibrato: VDOT target {new_target_vdot}."
        ),
    }


@app.post("/api/training-plan/adapt")
async def adapt_training_plan():
    """Auto-adapt the plan using 5 scientific models.

    Models applied in order:
    1. ACWR  — Acute:Chronic Workload Ratio (Gabbett 2016)
    2. TSB   — Fitness-Fatigue form score (Banister 1975)
    3. VDOT  — Pace drift correction (Daniels)
    4. COMP  — Compliance / adherence tracking
    5. TAPER — Race-proximity taper enforcement
    """
    from datetime import date, timedelta

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    profile = await db.profile.find_one(q)
    max_hr = int((profile or {}).get("max_hr", 190))

    recent_runs = await db.runs.find(q).sort("date", -1).to_list(120)
    all_weeks   = await db.training_plan.find(q).sort("week_number", 1).to_list(100)
    ff_doc      = await db.fitness_freshness.find_one(q, sort=[("date", -1)])

    if not all_weeks:
        return JSONResponse({"error": "no_plan"}, status_code=404)

    today_s = date.today().isoformat()
    upcoming = [w for w in all_weeks if w.get("week_end", "") >= today_s]

    if not upcoming:
        return {
            "ok": True, "adaptations": [], "weeks_modified": 0, "sessions_modified": 0,
            "message": "Nessuna settimana futura. Genera un nuovo piano.",
        }

    # Deep-copy upcoming sessions for mutation
    for w in upcoming:
        w["_modified"] = False
        w["sessions"] = [dict(s) for s in w.get("sessions", [])]

    adaptations: list = []

    # ── Helper ────────────────────────────────────────────────────────────────
    def pace_s(p: Optional[str]) -> int:
        if not p or ":" not in p:
            return 0
        parts = p.split(":")
        try:
            return int(parts[0]) * 60 + int(parts[1])
        except ValueError:
            return 0

    # ═══════════════════════════════════════════════════════════════════════════
    #  MODEL 1 — ACWR (Acute:Chronic Workload Ratio)
    # ═══════════════════════════════════════════════════════════════════════════
    seven_ago   = (date.today() - timedelta(days=7)).isoformat()
    twentyone_ago = (date.today() - timedelta(days=28)).isoformat()

    acute_km   = sum(r.get("distance_km", 0) for r in recent_runs if r.get("date", "") >= seven_ago)
    chronic_km = sum(r.get("distance_km", 0) for r in recent_runs if r.get("date", "") >= twentyone_ago)
    chronic_w  = (chronic_km / 4) if chronic_km > 0 else 1.0
    acwr       = round(acute_km / chronic_w, 2) if chronic_w > 0 else 1.0

    if acwr > 1.5:
        nw = upcoming[0]
        nw["target_km"] = round(nw["target_km"] * 0.80, 1)
        for s in nw["sessions"]:
            if s["type"] in ("intervals", "tempo"):
                s["type"] = "easy"
                s["title"] = "Corsa Facile (ACWR)"
                s["description"] = f"Sessione qualità → corsa facile. ACWR = {acwr}: rischio infortuni. Passo {s.get('target_pace', '6:00')}/km."
            if s["type"] != "rest" and s.get("target_distance_km", 0) > 0:
                s["target_distance_km"] = round(s["target_distance_km"] * 0.80, 1)
        nw["_modified"] = True
        adaptations.append({"model": "ACWR", "model_name": "Carico Acuto/Cronico",
            "triggered": True, "severity": "critical",
            "message": f"ACWR = {acwr} — Zona rossa (>1.5). Volume −20 %, sessioni qualità → corsa facile.",
            "details": {"acwr": acwr, "acute_km": round(acute_km, 1), "chronic_weekly_km": round(chronic_w, 1)}})
    elif acwr > 1.3:
        nw = upcoming[0]
        nw["target_km"] = round(nw["target_km"] * 0.90, 1)
        for s in nw["sessions"]:
            if s["type"] != "rest" and s.get("target_distance_km", 0) > 0:
                s["target_distance_km"] = round(s["target_distance_km"] * 0.90, 1)
        nw["_modified"] = True
        adaptations.append({"model": "ACWR", "model_name": "Carico Acuto/Cronico",
            "triggered": True, "severity": "warning",
            "message": f"ACWR = {acwr} — Zona gialla (1.3–1.5). Volume prossima settimana −10 %.",
            "details": {"acwr": acwr, "acute_km": round(acute_km, 1), "chronic_weekly_km": round(chronic_w, 1)}})
    else:
        adaptations.append({"model": "ACWR", "model_name": "Carico Acuto/Cronico",
            "triggered": False, "severity": "info",
            "message": f"ACWR = {acwr} — Zona ottimale (0.8–1.3). Nessuna modifica necessaria.",
            "details": {"acwr": acwr, "acute_km": round(acute_km, 1), "chronic_weekly_km": round(chronic_w, 1)}})

    # ═══════════════════════════════════════════════════════════════════════════
    #  MODEL 2 — TSB / Fitness-Fatigue (Banister)
    # ═══════════════════════════════════════════════════════════════════════════
    tsb = float(ff_doc.get("tsb", 0)) if ff_doc else 0.0
    ctl = float(ff_doc.get("ctl", 0)) if ff_doc else 0.0

    if tsb < -15:
        # Replace first quality session in upcoming with easy recovery
        for w in upcoming[:2]:
            replaced = False
            for s in w["sessions"]:
                if s["type"] in ("intervals", "tempo") and not s.get("completed"):
                    s["type"] = "easy"
                    s["title"] = "Recupero Attivo (TSB)"
                    s["description"] = f"Fatica accumulata elevata (TSB={tsb:.1f}). Sostituita con corsa leggera a passo {s.get('target_pace','6:00')}/km."
                    w["_modified"] = True
                    replaced = True
                    break
            if replaced:
                break
        adaptations.append({"model": "TSB", "model_name": "Forma/Fatica (Banister)",
            "triggered": True, "severity": "critical",
            "message": f"TSB = {tsb:.1f} (alta fatica, <−15). Prima sessione qualità → recupero attivo.",
            "details": {"tsb": round(tsb, 1), "ctl": round(ctl, 1)}})
    elif tsb < -10:
        for s in upcoming[0]["sessions"]:
            if s["type"] in ("intervals", "tempo") and not s.get("completed") and s.get("target_distance_km", 0) > 0:
                s["target_distance_km"] = round(s["target_distance_km"] * 0.80, 1)
                upcoming[0]["_modified"] = True
        adaptations.append({"model": "TSB", "model_name": "Forma/Fatica (Banister)",
            "triggered": True, "severity": "warning",
            "message": f"TSB = {tsb:.1f} (fatica moderata, −15/−10). Sessione qualità −20 %.",
            "details": {"tsb": round(tsb, 1), "ctl": round(ctl, 1)}})
    else:
        adaptations.append({"model": "TSB", "model_name": "Forma/Fatica (Banister)",
            "triggered": False, "severity": "info",
            "message": f"TSB = {tsb:.1f} — Forma ottimale (>−10). Sessioni qualità confermate.",
            "details": {"tsb": round(tsb, 1), "ctl": round(ctl, 1)}})

    # ═══════════════════════════════════════════════════════════════════════════
    #  MODEL 3 — VDOT Drift (Daniels pace correction)
    # ═══════════════════════════════════════════════════════════════════════════
    vdot_all = _calc_vdot(recent_runs, max_hr)
    if vdot_all:
        ideal = _tp_daniels_paces(vdot_all)
        ideal_easy_s = pace_s(ideal.get("easy"))

        # Find the easy pace currently stored in the plan's first upcoming week
        plan_easy_s = 0
        for s in upcoming[0]["sessions"]:
            if s["type"] == "easy" and s.get("target_pace"):
                plan_easy_s = pace_s(s["target_pace"])
                break

        if plan_easy_s > 0 and ideal_easy_s > 0 and abs(plan_easy_s - ideal_easy_s) >= 10:
            pace_map = {"easy": ideal.get("easy"), "long": ideal.get("easy"),
                        "tempo": ideal.get("threshold"), "intervals": ideal.get("interval")}
            upd = 0
            for w in upcoming:
                for s in w["sessions"]:
                    np = pace_map.get(s["type"])
                    if np and s["type"] != "rest" and not s.get("completed"):
                        s["target_pace"] = np
                        w["_modified"] = True
                        upd += 1
            direction = "migliorata" if plan_easy_s > ideal_easy_s else "diminuita"
            sev = "info" if direction == "migliorata" else "warning"
            old_p = next((s["target_pace"] for w in all_weeks[:1] for s in w.get("sessions",[]) if s.get("type")=="easy" and s.get("target_pace")), "?")
            adaptations.append({"model": "VDOT", "model_name": "Drift VDOT (Daniels)",
                "triggered": True, "severity": sev,
                "message": f"Fitness {direction}: passo facile {old_p} → {ideal['easy']}/km (VDOT={vdot_all}). Aggiornate {upd} sessioni.",
                "details": {"vdot": vdot_all, "sessions_updated": upd, "new_easy_pace": ideal.get("easy")}})
        else:
            adaptations.append({"model": "VDOT", "model_name": "Drift VDOT (Daniels)",
                "triggered": False, "severity": "info",
                "message": f"VDOT = {vdot_all}. Passi di allenamento allineati. Nessuna modifica.",
                "details": {"vdot": vdot_all}})
    else:
        adaptations.append({"model": "VDOT", "model_name": "Drift VDOT (Daniels)",
            "triggered": False, "severity": "info",
            "message": "VDOT non calcolabile (nessuna corsa valida nelle ultime settimane).",
            "details": {}})

    # ═══════════════════════════════════════════════════════════════════════════
    #  MODEL 4 — Compliance (adherence)
    # ═══════════════════════════════════════════════════════════════════════════
    two_weeks_ago = (date.today() - timedelta(days=14)).isoformat()
    past_sessions = [
        s for w in all_weeks
        for s in w.get("sessions", [])
        if two_weeks_ago <= w.get("week_start", "") <= today_s
        and s.get("type") != "rest"
    ]
    if past_sessions:
        done  = sum(1 for s in past_sessions if s.get("completed"))
        comp  = round(done / len(past_sessions) * 100)
        if comp < 50:
            for w in upcoming[:2]:
                w["target_km"] = round(w["target_km"] * 0.85, 1)
                for s in w["sessions"]:
                    if s["type"] in ("intervals", "tempo") and not s.get("completed"):
                        s["type"] = "easy"
                        s["title"] = f"{s['title']} → Facile"
                        s["description"] = f"[Compliance {comp}%] " + s["description"]
                w["_modified"] = True
            adaptations.append({"model": "COMPLIANCE", "model_name": "Compliance Piano",
                "triggered": True, "severity": "warning",
                "message": f"Compliance {comp}% (ultimi 14 gg). Volume −15 %, qualità semplificate nelle prossime 2 settimane.",
                "details": {"compliance_pct": comp, "completed": done, "planned": len(past_sessions)}})
        else:
            adaptations.append({"model": "COMPLIANCE", "model_name": "Compliance Piano",
                "triggered": False, "severity": "info",
                "message": f"Compliance {comp}% — {'ottima, progressione confermata.' if comp >= 80 else 'buona, mantenimento.'}",
                "details": {"compliance_pct": comp, "completed": done, "planned": len(past_sessions)}})
    else:
        adaptations.append({"model": "COMPLIANCE", "model_name": "Compliance Piano",
            "triggered": False, "severity": "info",
            "message": "Nessuna sessione passata trovata (piano appena generato).",
            "details": {}})

    # ═══════════════════════════════════════════════════════════════════════════
    #  MODEL 5 — Race-Proximity Taper enforcement
    # ═══════════════════════════════════════════════════════════════════════════
    race_weeks = [w for w in all_weeks if w.get("phase") == "Gara"]
    max_km_plan = max((w.get("target_km", 0) for w in all_weeks), default=0)

    if race_weeks:
        race_start_s = race_weeks[0].get("week_start", "")
        try:
            days_to_race = (date.fromisoformat(race_start_s) - date.today()).days
        except ValueError:
            days_to_race = None

        if days_to_race is not None and 0 < days_to_race <= 14:
            taper_pct = 0.65 if days_to_race > 7 else 0.40
            target_km = round(max_km_plan * taper_pct, 1)
            for w in upcoming:
                if w.get("week_start", "") < race_start_s and w.get("target_km", 0) > target_km:
                    scale = target_km / max(w["target_km"], 1)
                    for s in w["sessions"]:
                        if s["type"] != "rest" and s.get("target_distance_km", 0) > 0:
                            s["target_distance_km"] = round(s["target_distance_km"] * scale, 1)
                    w["target_km"] = target_km
                    w["_modified"] = True
            adaptations.append({"model": "TAPER", "model_name": "Prossimità Gara (Taper)",
                "triggered": True, "severity": "info",
                "message": f"Gara tra {days_to_race} giorni. Taper attivato: volume → {int(taper_pct*100)}% del massimo ({target_km} km/sett).",
                "details": {"days_to_race": days_to_race, "taper_km": target_km}})
        elif days_to_race is not None and days_to_race <= 0:
            adaptations.append({"model": "TAPER", "model_name": "Prossimità Gara (Taper)",
                "triggered": True, "severity": "warning",
                "message": "La settimana gara è già passata. Genera un nuovo piano per il prossimo obiettivo.",
                "details": {"days_to_race": days_to_race}})
        else:
            adaptations.append({"model": "TAPER", "model_name": "Prossimità Gara (Taper)",
                "triggered": False, "severity": "info",
                "message": f"Gara tra {days_to_race} giorni — taper non ancora necessario.",
                "details": {"days_to_race": days_to_race}})
    else:
        adaptations.append({"model": "TAPER", "model_name": "Prossimità Gara (Taper)",
            "triggered": False, "severity": "info",
            "message": "Nessuna settimana gara trovata nel piano.",
            "details": {}})

    # ── Persist modified weeks ────────────────────────────────────────────────
    weeks_mod = 0
    sessions_mod = 0
    for w in upcoming:
        if w.get("_modified"):
            await db.training_plan.update_one(
                {"athlete_id": athlete_id, "week_number": w["week_number"]},
                {"$set": {"sessions": w["sessions"], "target_km": w["target_km"]}},
            )
            weeks_mod += 1
            sessions_mod += sum(1 for s in w["sessions"] if s.get("type") != "rest")

    triggered_count = sum(1 for a in adaptations if a.get("triggered"))
    return {
        "ok": True,
        "adaptations": adaptations,
        "weeks_modified": weeks_mod,
        "sessions_modified": sessions_mod,
        "triggered_count": triggered_count,
    }


async def _auto_adapt_on_sync(athlete_id) -> Optional[dict]:
    """Called automatically after each Strava sync.

    Compares actual VDOT (from latest runs) with the plan's expected VDOT
    progression and re-calibrates future weeks' paces if they diverge.

    This implements the core adaptive loop:
    1. Recalculate VDOT from ALL valid runs
    2. Find current week in plan → what was the expected VDOT?
    3. If actual VDOT > expected: runner is ahead → raise future paces
    4. If actual VDOT < expected: runner is behind → lower future paces
    5. If |delta| < 0.5: within normal variance → no change
    """
    from datetime import date, timedelta

    q = {"athlete_id": athlete_id} if athlete_id else {}
    profile = await db.profile.find_one(q)
    if not profile:
        return None

    max_hr = int(profile.get("max_hr", 190))
    runs = await db.runs.find(q).sort("date", -1).to_list(500)
    actual_vdot = _calc_vdot(runs, max_hr)
    if not actual_vdot:
        return None

    all_weeks = await db.training_plan.find(q).sort("week_number", 1).to_list(100)
    if not all_weeks:
        return None

    # ── Find current week ────────────────────────────────────────────────────
    today_s = date.today().isoformat()
    current_week = None
    for w in all_weeks:
        if w.get("week_start", "") <= today_s <= w.get("week_end", ""):
            current_week = w
            break
    if not current_week:
        return None

    expected_vdot = current_week.get("target_vdot")
    if not expected_vdot:
        return None

    delta = round(actual_vdot - expected_vdot, 2)
    result = {
        "actual_vdot": actual_vdot,
        "expected_vdot": expected_vdot,
        "delta": delta,
        "action": "none",
        "weeks_updated": 0,
    }

    # ── Threshold: only adapt if delta >= 0.5 VDOT ──────────────────────────
    if abs(delta) < 0.5:
        result["action"] = "within_tolerance"
        return result

    # ── Recalibrate future weeks ─────────────────────────────────────────────
    future_weeks = [w for w in all_weeks if w.get("week_start", "") > today_s]
    if not future_weeks:
        return result

    target_vdot_plan = profile.get("plan_target_vdot", expected_vdot)
    goal_race = current_week.get("goal_race", "Half Marathon")

    updated = 0
    for w in future_weeks:
        old_wv = w.get("target_vdot", expected_vdot)
        # Shift the weekly target by the delta (capped to not exceed plan target)
        new_wv = round(old_wv + delta, 2)
        if delta > 0:
            new_wv = min(new_wv, target_vdot_plan + 1.0)  # don't overshoot much
        else:
            new_wv = max(new_wv, actual_vdot - 1.0)  # don't undershoot much

        if abs(new_wv - old_wv) < 0.2:
            continue  # skip trivial changes

        new_paces = _tp_daniels_paces(new_wv)
        pace_map = {
            "easy": new_paces.get("easy"), "long": new_paces.get("easy"),
            "tempo": new_paces.get("threshold"), "intervals": new_paces.get("interval"),
        }

        sessions = [dict(s) for s in w.get("sessions", [])]
        for s in sessions:
            if s["type"] != "rest" and not s.get("completed"):
                np = pace_map.get(s["type"])
                if np:
                    s["target_pace"] = np

        await db.training_plan.update_one(
            {"athlete_id": athlete_id, "week_number": w["week_number"]},
            {"$set": {"target_vdot": new_wv, "sessions": sessions}},
        )
        updated += 1

    direction = "ahead" if delta > 0 else "behind"
    result["action"] = f"recalibrated_{direction}"
    result["weeks_updated"] = updated

    # Store latest actual VDOT on profile
    await db.profile.update_one(q, {"$set": {"plan_current_vdot": actual_vdot}})

    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  FITNESS & FRESHNESS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/fitness-freshness")
async def get_fitness_freshness():
    from datetime import date, timedelta
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    cursor = db.fitness_freshness.find(q).sort("date", 1)
    docs = await cursor.to_list(length=1000)

    current = None
    if docs:
        latest = docs[-1]
        ctl = round(latest.get("ctl", 0), 1)
        atl = round(latest.get("atl", 0), 1)
        tsb = round(latest.get("tsb", 0), 1)

        # Trend CTL vs 7 giorni fa
        target_date = (date.today() - timedelta(days=7)).isoformat()
        ctl_7d = ctl
        for doc in reversed(docs):
            if doc.get("date", "") <= target_date:
                ctl_7d = doc.get("ctl", ctl)
                break
        ctl_trend = round(ctl - ctl_7d, 1)

        if tsb > 10:
            form_status, form_color = "Fresco", "green"
        elif tsb > 0:
            form_status, form_color = "Neutro", "yellow"
        elif tsb > -10:
            form_status, form_color = "Affaticato", "orange"
        else:
            form_status, form_color = "Sovrallenamento", "red"

        current = {
            "ctl": ctl, "atl": atl, "tsb": tsb,
            "ctl_trend": ctl_trend,
            "form_status": form_status,
            "form_color": form_color,
        }

    return {"fitness_freshness": oids(docs), "current": current or {}}


@app.post("/api/fitness-freshness/recalculate")
async def recalculate_fitness_freshness():
    """Ricalcola CTL/ATL/TSB da zero per l'atleta corrente."""
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    profile_doc = await db.profile.find_one(q)
    max_hr_p = int(profile_doc.get("max_hr", 190)) if profile_doc else 190
    resting_hr_p = int(profile_doc.get("resting_hr", 50)) if profile_doc else 50
    await _compute_fitness_freshness(athlete_id, max_hr_p, resting_hr_p)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
#  ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

def _vdot_from_run(r: dict, max_hr: int = 190) -> Optional[float]:
    """Calculate VDOT from a single run using Daniels' VO2 formula (2013).

    Per il PRD (RF-VDOT-01):
    - Input: migliore prestazione su distanze 4-21km
    - Validazione: distanza >= 4km, FC >= 85% FCmax, passo 2:30-9:00/km
    - Cap: VDOT max 55

    VO2 = -4.60 + 0.182258·v + 0.000104·v²  (v in m/min)
    %max = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)
    VDOT = VO2 / %max
    """
    # Tapis roulant: escludi da tutte le metriche (nessun GPS, passo non affidabile)
    if r.get("is_treadmill"):
        return None
    dist = r.get("distance_km", 0)
    # PRD: distanza >= 4km (non 3km) per VDOT affidabile
    if dist < 4 or dist > 21:
        return None
    pace_str = r.get("avg_pace", "")
    if not pace_str or ":" not in pace_str:
        return None
    try:
        parts = pace_str.split(":")
        pace_s = int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None
    # PRD: passo 2:30-9:00/km (150-540 sec/km)
    if pace_s < 150 or pace_s > 540:
        return None
    duration_min = r.get("duration_minutes", 0) or 0
    # Minimo 10 minuti per VDOT affidabile (corse brevi distorcono)
    if duration_min < 10:
        return None
    avg_hr = r.get("avg_hr")
    # PRD: FC >= 85% FCmax (non 80%) — solo sforzi significativi
    if avg_hr and avg_hr < 0.85 * max_hr:
        return None
    speed_mpm = 60000 / pace_s
    vo2 = -4.60 + 0.182258 * speed_mpm + 0.000104 * speed_mpm ** 2
    pct_max = (0.8 + 0.1894393 * math.exp(-0.012778 * duration_min)
               + 0.2989558 * math.exp(-0.1932605 * duration_min))
    return vo2 / pct_max if pct_max > 0 else None


def _calc_vdot(runs: list, max_hr: int = 190, weeks_window: int = 8) -> Optional[float]:
    """Estimate current VDOT (backward compat wrapper)."""
    h = _calc_vdot_with_history(runs, max_hr, weeks_window)
    return h["current"]


def _calc_vdot_with_history(runs: list, max_hr: int = 190,
                             weeks_window: int = 8,
                             goal_dist_km: float = 0) -> dict:
    """Full athlete history analysis for training plan calibration.

    Returns:
        current  — VDOT from best recent run (8w → 16w → all-time fallback)
        peak     — All-time best VDOT
        peak_date — Date of peak performance
        training_months — Running history length in months
        weekly_volume — Avg km/week in last 8 weeks
        race_specific_vdot — VDOT from runs closest to goal distance (more reliable)
    """
    import datetime as _dt

    run_vdots = []
    for r in runs:
        v = _vdot_from_run(r, max_hr)
        if v:
            run_vdots.append((r, min(v, 55.0)))

    if not run_vdots:
        return {"current": None, "peak": None, "peak_date": None,
                "training_months": 0, "weekly_volume": 0, "race_specific_vdot": None}

    cutoff_8w = (_dt.date.today() - _dt.timedelta(weeks=weeks_window)).isoformat()
    cutoff_16w = (_dt.date.today() - _dt.timedelta(weeks=16)).isoformat()

    recent_8 = [(r, v) for r, v in run_vdots if r.get("date", "") >= cutoff_8w]
    recent_16 = [(r, v) for r, v in run_vdots if r.get("date", "") >= cutoff_16w]

    # Helper: average of top-N values (more robust than single max)
    def _top_avg(values, n=3):
        sorted_vals = sorted(values, reverse=True)
        top = sorted_vals[:n]
        return sum(top) / len(top) if top else None

    # ── Race-specific VDOT: only runs >= 70% of goal distance ────────────────
    race_specific_vdot = None
    if goal_dist_km > 0:
        min_dist = goal_dist_km * 0.70
        race_runs = [(r, v) for r, v in run_vdots if r.get("distance_km", 0) >= min_dist]
        if race_runs:
            race_recent = [(r, v) for r, v in race_runs if r.get("date", "") >= cutoff_16w]
            if race_recent and len(race_recent) >= 2:
                race_specific_vdot = round(_top_avg([v for _, v in race_recent], n=3), 1)
            elif len(race_runs) >= 2:
                race_specific_vdot = round(_top_avg([v for _, v in race_runs], n=3), 1)
            else:
                race_specific_vdot = round(max(v for _, v in race_runs), 1)

    # Current: average of top-3 recent VDOT values

    if recent_8 and len(recent_8) >= 2:
        current = _top_avg([v for _, v in recent_8], n=3)
    elif recent_16 and len(recent_16) >= 2:
        current = _top_avg([v for _, v in recent_16], n=3)
    elif run_vdots and len(run_vdots) >= 2:
        current = _top_avg([v for _, v in run_vdots], n=3)
    else:
        current = max(v for _, v in run_vdots) if run_vdots else None
    current = round(current, 1) if current else None

    # Peak: all-time best
    peak_run, peak_val = max(run_vdots, key=lambda x: x[1])
    peak = round(peak_val, 1)
    peak_date = peak_run.get("date", "")

    # Training age
    dates = sorted(r.get("date", "") for r, _ in run_vdots)
    training_months = 0
    if len(dates) >= 2:
        try:
            first = _dt.date.fromisoformat(dates[0])
            last = _dt.date.fromisoformat(dates[-1])
            training_months = max(1, (last - first).days // 30)
        except ValueError:
            pass

    # Recent weekly volume
    recent_runs = [r for r in runs if r.get("date", "") >= cutoff_8w]
    recent_km = sum(r.get("distance_km", 0) for r in recent_runs)
    weekly_volume = round(recent_km / max(1, weeks_window), 1)

    return {
        "current": current,
        "peak": peak,
        "peak_date": peak_date,
        "training_months": training_months,
        "weekly_volume": weekly_volume,
        "race_specific_vdot": race_specific_vdot,
    }


def _vdot_to_race_time(vdot: float, dist_km: float) -> Optional[str]:
    """Predict race finish time for a given distance using iterative Daniels inversion."""
    if not vdot or vdot <= 0 or dist_km <= 0:
        return None
    t = dist_km * 1000 / ((vdot / 22) * 60)  # initial estimate (minutes)
    for _ in range(30):
        pct = 0.8 + 0.1894393 * math.exp(-0.012778 * t) + 0.2989558 * math.exp(-0.1932605 * t)
        vo2 = vdot * pct
        disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
        if disc < 0:
            return None
        v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
        if v <= 0:
            return None
        t_new = (dist_km * 1000) / v
        if abs(t_new - t) < 0.001:
            break
        t = t_new
    total_s = round(t * 60)
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _predict_race(vdot: float) -> dict:
    """Race time predictions from VDOT using accurate Daniels iterative formula."""
    if not vdot:
        return {}
    result = {}
    for label, dist in [("5K", 5.0), ("10K", 10.0), ("Half Marathon", 21.0975), ("Marathon", 42.195)]:
        t = _vdot_to_race_time(vdot, dist)
        if t:
            result[label] = t
    return result


def _extract_fit_dynamics(binary_content: bytes) -> dict:
    """Extract Running Dynamics from FIT binary data using fitdecode.

    Strategy (two-pass):
    1. SESSION frame — Garmin watches (Forerunner 265, 955, Fenix, etc.) store
       pre-averaged dynamics here even without an external HRM-Pro sensor.
       Fields: avg_vertical_oscillation (mm), avg_stance_time (ms),
               avg_step_length (mm), avg_vertical_ratio (%)
    2. RECORD frame fallback — per-point data present only when an external
       Running Dynamics sensor (HRM-Pro, HRM-Run, RD Pod) is paired.
       We average those values ourselves.

    Units after conversion:
    - Vertical Oscillation: mm → cm
    - Stride Length: mm → m
    - GCT / Stance Time: ms → ms (unchanged)
    - Vertical Ratio: % (unchanged)

    Note: Garmin's download_activity(ORIGINAL) returns a ZIP archive containing
    the FIT file. We detect ZIP magic bytes (PK) and extract the .fit inside.
    """
    import zipfile

    # ── Unzip if Garmin returned a ZIP archive ───────────────────────────────
    if binary_content[:2] == b'PK':
        try:
            with zipfile.ZipFile(io.BytesIO(binary_content)) as z:
                fit_names = [n for n in z.namelist() if n.lower().endswith('.fit')]
                if not fit_names:
                    print("[FIT-Parser] ZIP contains no .fit file")
                    return {}
                binary_content = z.read(fit_names[0])
                print(f"[FIT-Parser] Extracted {fit_names[0]} from ZIP ({len(binary_content)} bytes)")
        except Exception as e:
            print(f"[FIT-Parser] ZIP extraction failed: {e}")
            return {}

    try:
        session_data = {}
        vo_values = []
        gct_values = []
        sl_values = []
        vr_values = []

        with fitdecode.FitReader(io.BytesIO(binary_content)) as fit:
            for frame in fit:
                if frame.frame_type != fitdecode.FIT_FRAME_DATA:
                    continue

                # ── Pass 1: session frame (Forerunner 265 / most Garmin watches) ──
                if frame.name == 'session':
                    def _sf(name):
                        try: return frame.get_value(name)
                        except Exception: return None

                    vo  = _sf('avg_vertical_oscillation')
                    gct = _sf('avg_stance_time') or _sf('avg_ground_contact_time')
                    sl  = _sf('avg_step_length')
                    vr  = _sf('avg_vertical_ratio')

                    if vo  is not None and vo  > 0:
                        session_data['avg_vertical_oscillation'] = round(vo / 10.0, 1)   # mm→cm
                    if gct is not None and gct > 0:
                        session_data['avg_ground_contact_time']  = int(gct)               # ms
                    if sl  is not None and sl  > 0:
                        session_data['avg_stride_length']        = round(sl / 1000.0, 2)  # mm→m
                    if vr  is not None and vr  > 0:
                        session_data['avg_vertical_ratio']       = round(vr, 2)            # %

                # ── Pass 2: record frame (HRM-Pro / external sensor) ─────────────
                if frame.name == 'record':
                    def _rf(name):
                        try: return frame.get_value(name)
                        except Exception: return None

                    vo  = _rf('enhanced_vertical_oscillation') or _rf('vertical_oscillation')
                    gct = _rf('stance_time') or _rf('ground_contact_time') or _rf('enhanced_ground_contact_time')
                    sl  = _rf('step_length') or _rf('avg_step_length') or _rf('enhanced_avg_step_length')
                    vr  = _rf('vertical_ratio') or _rf('enhanced_vertical_ratio')

                    if vo  is not None and vo  > 0: vo_values.append(vo)
                    if gct is not None and gct > 0: gct_values.append(gct)
                    if sl  is not None and sl  > 0: sl_values.append(sl)
                    if vr  is not None and vr  > 0: vr_values.append(vr)

        # Build result: session frame wins; record frame fills gaps
        res = dict(session_data)

        if 'avg_vertical_oscillation' not in res and vo_values:
            res['avg_vertical_oscillation'] = round((sum(vo_values) / len(vo_values)) / 10.0, 1)
        if 'avg_ground_contact_time' not in res and gct_values:
            res['avg_ground_contact_time']  = int(sum(gct_values) / len(gct_values))
        if 'avg_stride_length' not in res and sl_values:
            res['avg_stride_length']        = round((sum(sl_values) / len(sl_values)) / 1000.0, 2)
        if 'avg_vertical_ratio' not in res and vr_values:
            res['avg_vertical_ratio']       = round(sum(vr_values) / len(vr_values), 2)

        return res

    except Exception as e:
        print(f"[FIT-Parser] Error: {e}")
        return {}


def _vdot_from_best_efforts(efforts: list) -> Optional[float]:
    """Calculate VDOT from stored best efforts (more reliable than HR-filtered runs).

    Best efforts represent actual race-pace performance with no HR threshold filter.
    Only considers efforts >= 4km for reliable VO2max estimation.
    """
    dist_km_map = {
        "4K": 4.0, "5K": 5.0, "10K": 10.0,
        "15K": 15.0, "21K": 21.0975, "42K": 42.195,
    }
    best: Optional[float] = None
    for e in efforts:
        dist_km = dist_km_map.get(e.get("distance", ""))
        if not dist_km:
            continue
        time_str = e.get("time", "")
        if not time_str or ":" not in time_str:
            continue
        parts = time_str.split(":")
        try:
            total_s = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2]) if len(parts) == 3 else int(parts[0]) * 60 + int(parts[1])
        except (ValueError, IndexError):
            continue
        total_min = total_s / 60
        if total_min < 14:  # too short for reliable VDOT
            continue
        speed_mpm = (dist_km * 1000) / total_min
        vo2 = -4.60 + 0.182258 * speed_mpm + 0.000104 * speed_mpm ** 2
        pct_max = 0.8 + 0.1894393 * math.exp(-0.012778 * total_min) + 0.2989558 * math.exp(-0.1932605 * total_min)
        if pct_max > 0 and vo2 > 0:
            vdot = round(min(vo2 / pct_max, 55.0), 1)
            if best is None or vdot > best:
                best = vdot
    return best


@app.get("/api/analytics")
async def get_analytics():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # Escludi tapis roulant da tutte le metriche (nessun GPS, passo non calibrato)
    q_stats = {**q, "is_treadmill": {"$ne": True}}
    runs = await db.runs.find(q_stats).sort("date", -1).to_list(500)
    profile = await db.profile.find_one(q)
    max_hr = int(profile.get("max_hr", 190)) if profile else 190

    vdot = _calc_vdot(runs, max_hr)

    # Pace trend (last 20 runs)
    pace_trend = []
    for r in reversed(runs[:20]):
        pace_trend.append({"date": r.get("date"), "pace": r.get("avg_pace")})

    # Zone distribution from real HR data (last 120 runs with HR)
    zone_min = {"Z1": 0.0, "Z2": 0.0, "Z3": 0.0, "Z4": 0.0, "Z5": 0.0}
    runs_with_hr = [r for r in runs[:120] if r.get("avg_hr") and r.get("duration_minutes")]
    for r in runs_with_hr:
        hr_pct = r["avg_hr"] / max_hr * 100
        dur = r["duration_minutes"]
        if hr_pct < 65:
            zone_min["Z1"] += dur
        elif hr_pct < 77:
            zone_min["Z2"] += dur
        elif hr_pct < 84:
            zone_min["Z3"] += dur
        elif hr_pct < 91:
            zone_min["Z4"] += dur
        else:
            zone_min["Z5"] += dur
    total_min = sum(zone_min.values()) or 1
    zone_names = {"Z1": "Recovery", "Z2": "Easy", "Z3": "Tempo", "Z4": "Threshold", "Z5": "VO2max"}
    zone_dist = [
        {"zone": k, "name": zone_names[k], "pct": round(zone_min[k] / total_min * 100, 1), "minutes": round(zone_min[k], 1)}
        for k in ["Z1", "Z2", "Z3", "Z4", "Z5"]
    ]

    # Goal gap
    goal_gap = None
    if profile and profile.get("target_time") and vdot:
        goal_gap = {
            "target": profile.get("target_time"),
            "race": profile.get("race_goal"),
            "predicted": _predict_race(vdot).get(profile.get("race_goal")),
        }

    return {
        "vdot": vdot,
        "race_predictions": _predict_race(vdot) if vdot else {},
        "pace_trend": pace_trend,
        "zone_distribution": zone_dist,
        "goal_gap": goal_gap,
    }


@app.get("/api/prediction-history")
async def get_prediction_history():
    # Return stored predictions or compute from run history
    docs = await db.prediction_history.find().sort("date", 1).to_list(100)
    return {"predictions": oids(docs)}


@app.get("/api/vdot/paces")
async def get_vdot_paces():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # Escludi tapis roulant da VDOT e paces
    q_stats = {**q, "is_treadmill": {"$ne": True}}
    runs = await db.runs.find(q_stats).sort("date", -1).to_list(500)
    profile = await db.profile.find_one(q)
    max_hr = int(profile.get("max_hr", 190)) if profile else 190
    vdot = _calc_vdot(runs, max_hr)
    if not vdot:
        return {"vdot": None, "paces": {}, "race_predictions": {}}

    def pace_at_vo2_pct(pct: float) -> Optional[str]:
        """Calculate training pace (sec/km) at a given % of VO2max."""
        vo2 = vdot * pct
        disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
        if disc < 0:
            return None
        v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)  # m/min
        return _format_pace(v / 60) if v > 0 else None  # convert m/min → m/s for _format_pace

    return {
        "vdot": vdot,
        "paces": {
            "easy":       pace_at_vo2_pct(0.65),  # E: 59–74% VO2max
            "marathon":   pace_at_vo2_pct(0.80),  # M: 75–84% VO2max
            "threshold":  pace_at_vo2_pct(0.88),  # T: 83–88% VO2max
            "interval":   pace_at_vo2_pct(0.98),  # I: 95–100% VO2max
            "repetition": pace_at_vo2_pct(1.10),  # R: 105–120% VO2max
        },
        "race_predictions": _predict_race(vdot),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  RECOVERY & INJURY RISK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/recovery-score")
async def get_recovery_score():
    checkin = await db.recovery_checkins.find_one(sort=[("_id", -1)])
    if not checkin:
        return {"score": 75, "label": "Good", "factors": {}, "checkin": None}

    factors = {
        "energy": checkin.get("energy", 3),
        "sleep_quality": checkin.get("sleep_quality", 3),
        "muscle_soreness": checkin.get("muscle_soreness", 3),
        "mood": checkin.get("mood", 3),
    }
    score = round(sum(factors.values()) / len(factors) * 20)
    label = "Excellent" if score >= 85 else "Good" if score >= 65 else "Fair" if score >= 45 else "Poor"
    return {"score": score, "label": label, "factors": factors, "checkin": oid(checkin)}


@app.get("/api/injury-risk")
async def get_injury_risk():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # ACWR = acute load / chronic load
    runs = await db.runs.find(q).sort("date", -1).to_list(60)
    today = dt.date.today()

    acute_km = 0
    chronic_km = 0
    for r in runs:
        try:
            rd = dt.date.fromisoformat(r.get("date", "2000-01-01"))
        except ValueError:
            continue
        days_ago = (today - rd).days
        km = r.get("distance_km", 0)
        if days_ago <= 7:
            acute_km += km
        if days_ago <= 28:
            chronic_km += km

    chronic_weekly = chronic_km / 4 if chronic_km > 0 else 1
    acwr = round(acute_km / chronic_weekly, 2) if chronic_weekly > 0 else 1.0

    if acwr > 1.5:
        risk_score, risk_label = 80, "High"
    elif acwr > 1.3:
        risk_score, risk_label = 55, "Moderate"
    elif acwr > 0.8:
        risk_score, risk_label = 25, "Low"
    else:
        risk_score, risk_label = 40, "Detraining"

    return {
        "risk_score": risk_score,
        "risk_label": risk_label,
        "acwr": acwr,
        "factors": {
            "acute_load_km": round(acute_km, 1),
            "chronic_load_km": round(chronic_km, 1),
            "acwr": acwr,
        },
    }


@app.post("/api/recovery-checkin")
async def post_recovery_checkin(request: Request):
    body = await request.json()
    body["date"] = dt.date.today().isoformat()
    await db.recovery_checkins.insert_one(body)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
#  SUPERCOMPENSATION
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/supercompensation")
async def get_supercompensation():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    runs = await db.runs.find(q).sort("date", -1).to_list(30)

    investments = []
    for r in runs[:10]:
        investments.append({
            "date": r.get("date"),
            "load": round(r.get("distance_km", 0) * r.get("duration_minutes", 0) / 10, 1),
            "type": r.get("run_type"),
        })

    # Simple projection
    today = dt.date.today()
    projection = []
    base_fitness = 50
    for i in range(14):
        d = today + dt.timedelta(days=i)
        # Fitness decays slowly, supercompensation peaks 2-3 days after hard effort
        fitness = base_fitness + 5 * math.sin(i * 0.5) * math.exp(-i * 0.05)
        projection.append({"date": d.isoformat(), "fitness": round(fitness, 1)})

    golden_day = (today + dt.timedelta(days=3)).isoformat() if runs else None

    return {
        "investments": investments,
        "golden_day": golden_day,
        "days_to_golden": 3 if runs else None,
        "projection": projection,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  BADGES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/badges")
async def get_badges():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    docs = await db.badges.find(q).to_list(100)
    if docs:
        return {"badges": oids(docs)}

    # Compute badges from run data
    runs = await db.runs.find(q).to_list(500)
    total_km = sum(r.get("distance_km", 0) for r in runs)
    total_runs = len(runs)

    badges = [
        {"id": "first_run", "cat": "milestones", "cat_label": "Milestones", "name": "First Steps",
         "desc": "Complete your first run", "icon": "footprints",
         "progress": min(total_runs, 1), "target": 1, "unlocked": total_runs >= 1, "unlocked_date": runs[-1].get("date") if runs else None},
        {"id": "km_100", "cat": "distance", "cat_label": "Distance", "name": "Centurion",
         "desc": "Run 100 km total", "icon": "map",
         "progress": round(min(total_km, 100), 1), "target": 100, "unlocked": total_km >= 100, "unlocked_date": None},
        {"id": "km_500", "cat": "distance", "cat_label": "Distance", "name": "Road Warrior",
         "desc": "Run 500 km total", "icon": "trophy",
         "progress": round(min(total_km, 500), 1), "target": 500, "unlocked": total_km >= 500, "unlocked_date": None},
        {"id": "runs_10", "cat": "consistency", "cat_label": "Consistency", "name": "Getting Hooked",
         "desc": "Complete 10 runs", "icon": "repeat",
         "progress": min(total_runs, 10), "target": 10, "unlocked": total_runs >= 10, "unlocked_date": None},
        {"id": "runs_50", "cat": "consistency", "cat_label": "Consistency", "name": "Dedicated",
         "desc": "Complete 50 runs", "icon": "flame",
         "progress": min(total_runs, 50), "target": 50, "unlocked": total_runs >= 50, "unlocked_date": None},
    ]
    return {"badges": badges}


# ═══════════════════════════════════════════════════════════════════════════════
#  WEEKLY REPORT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/weekly-report")
async def get_weekly_report():
    athlete_id = await _get_athlete_id()
    today = dt.date.today()
    week_start = today - dt.timedelta(days=today.weekday())
    week_end = week_start + dt.timedelta(days=6)

    q: dict = {"date": {"$gte": week_start.isoformat(), "$lte": week_end.isoformat()}}
    if athlete_id:
        q["athlete_id"] = athlete_id
    runs = await db.runs.find(q).to_list(20)

    total_km = sum(r.get("distance_km", 0) for r in runs)
    total_min = sum(r.get("duration_minutes", 0) for r in runs)

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_runs": len(runs),
        "total_km": round(total_km, 1),
        "total_minutes": round(total_min, 1),
        "avg_pace": _format_pace(1000 / (total_km * 1000 / (total_min * 60))) if total_km > 0 and total_min > 0 else None,
    }


@app.get("/api/weekly-history")
async def get_weekly_history():
    docs = await db.weekly_reports.find().sort("week_start", -1).to_list(52)
    return {"reports": oids(docs)}


# ═══════════════════════════════════════════════════════════════════════════════
#  BEST EFFORTS & HEATMAP
# ═══════════════════════════════════════════════════════════════════════════════

def _secs_to_time(total_s: float) -> str:
    """Format seconds into H:MM:SS or M:SS string."""
    total_s = int(round(total_s))
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _best_effort_from_streams(streams: list, target_m: float, actual_duration_s: float = 0) -> Optional[dict]:
    """
    Find the fastest contiguous segment of exactly `target_m` meters.
    Calibrates cumulative time against actual run duration to fix
    gaps from points with pace=None.
    """
    if not streams or len(streams) < 3:
        return None

    n = len(streams)
    dists = [s.get("d", 0) for s in streams]

    # Total distance must cover the target
    if dists[-1] - dists[0] < target_m * 0.95:
        return None

    # Build cumulative time from per-point pace
    cum_t = [0.0] * n
    for i in range(1, n):
        d_diff = dists[i] - dists[i - 1]
        p = streams[i].get("pace")  # sec/km
        if p and p > 0 and d_diff > 0:
            cum_t[i] = cum_t[i - 1] + (d_diff / 1000.0) * p
        else:
            cum_t[i] = cum_t[i - 1]

    # Calibrate: scale cumulative time so total matches actual run duration.
    # This fixes "missing time" from points where pace was None.
    if actual_duration_s > 0 and cum_t[-1] > 0:
        scale = actual_duration_s / cum_t[-1]
        cum_t = [t * scale for t in cum_t]

    best_time = None
    j = 0
    for i in range(n):
        while j < n - 1 and (dists[j] - dists[i]) < target_m:
            j += 1

        actual_dist = dists[j] - dists[i]
        if actual_dist < target_m * 0.95:
            break

        seg_time = cum_t[j] - cum_t[i]

        # Interpolate: subtract overshoot time proportionally
        if actual_dist > target_m and j > 0:
            overshoot = actual_dist - target_m
            d_last = dists[j] - dists[j - 1]
            t_last = cum_t[j] - cum_t[j - 1]
            if d_last > 0 and t_last > 0:
                seg_time -= overshoot * (t_last / d_last)

        if seg_time > 0 and (best_time is None or seg_time < best_time):
            best_time = seg_time

    if best_time is None:
        return None

    pace_s = best_time / (target_m / 1000.0)
    return {"time_s": best_time, "pace_s": pace_s}


def _best_effort_from_splits(splits: list, target_km: int) -> Optional[dict]:
    """
    Sliding window over per-km splits. Only considers full-distance
    splits (ignores the last partial-km split).
    """
    # Filter out partial splits (last split often < 1km)
    full_splits = [s for s in splits if s.get("distance", 0) > 900]
    if not full_splits or len(full_splits) < target_km:
        return None

    best_time = None
    for i in range(len(full_splits) - target_km + 1):
        window = full_splits[i : i + target_km]
        seg_time = sum(s.get("elapsed_time", 0) for s in window)
        if seg_time > 0 and (best_time is None or seg_time < best_time):
            best_time = seg_time

    if best_time is None:
        return None
    pace_s = best_time / target_km
    return {"time_s": best_time, "pace_s": pace_s}


@app.get("/api/best-efforts")
async def get_best_efforts():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    # Target distances: (label, meters, min_run_km, splits_km or None)
    targets = [
        ("400m",            400,   0.3, None),
        ("1 km",           1000,   0.9,  1),
        ("4 km",           4000,   3.5,  4),
        ("5 km",           5000,   4.5,  5),
        ("10 km",         10000,   9.5, 10),
        ("15 km",         15000,  14.5, 15),
        ("Mezza Maratona",21097,  20.0, 21),
        ("Maratona",      42195,  40.0, 42),
    ]

    MIN_PACE_S = 175  # 2:55/km — anything faster is GPS glitch

    bests: dict = {t[0]: None for t in targets}

    # MEMORY FIX: do NOT load streams — only splits + metadata
    runs = await db.runs.find(
        q, {"_id": 1, "distance_km": 1, "duration_minutes": 1, "date": 1,
            "splits": 1}
    ).to_list(1000)

    for r in runs:
        km = r.get("distance_km", 0)
        splits = r.get("splits") or []
        date = r.get("date", "")
        run_id = str(r["_id"])
        actual_s = r.get("duration_minutes", 0) * 60

        for label, target_m, min_km, splits_km in targets:
            if km < min_km:
                continue

            effort = None

            # 1) Splits for whole-km distances (most reliable — times from Strava)
            if splits_km and len(splits) >= splits_km:
                effort = _best_effort_from_splits(splits, splits_km)

            # 2) Fallback: run distance within 10% of target → use total time
            if not effort and abs(km * 1000 - target_m) <= target_m * 0.10:
                if actual_s > 0:
                    pace_s = actual_s / km
                    effort = {"time_s": actual_s, "pace_s": pace_s}

            # Discard GPS glitch results (faster than 2:55/km is not human)
            if effort and effort["pace_s"] < MIN_PACE_S:
                effort = None

            if effort and (bests[label] is None or effort["pace_s"] < bests[label]["pace_s"]):
                bests[label] = {
                    "distance": label,
                    "time": _secs_to_time(effort["time_s"]),
                    "pace": _secs_to_time(effort["pace_s"]) + "/km",
                    "pace_s": effort["pace_s"],
                    "date": date,
                    "run_id": run_id,
                }

    result = [v for v in bests.values() if v is not None]
    order = [t[0] for t in targets]
    result.sort(key=lambda x: order.index(x["distance"]) if x["distance"] in order else 99)
    return {"efforts": [{k: v[k] for k in ("distance", "time", "pace", "date", "run_id")} for v in result]}


@app.get("/api/heatmap")
async def get_heatmap():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    runs = await db.runs.find(q, {"date": 1, "distance_km": 1}).to_list(1000)
    heatmap = {}
    for r in runs:
        d = r.get("date", "")
        if d:
            heatmap[d] = heatmap.get(d, 0) + r.get("distance_km", 0)
    return {"heatmap": [{"date": k, "km": round(v, 1)} for k, v in sorted(heatmap.items())]}


# ═══════════════════════════════════════════════════════════════════════════════
#  AI ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/ai/analyze-run")
async def analyze_run(request: Request):
    body = await request.json()
    run_id = body.get("run_id", "")

    from bson import ObjectId
    try:
        run = await db.runs.find_one({"_id": ObjectId(run_id)})
    except Exception:
        run = None

    if not run:
        return JSONResponse({"error": "not_found"}, status_code=404)

    # Simple rule-based analysis (no external AI call needed)
    km = run.get("distance_km", 0)
    pace = run.get("avg_pace", "")
    hr = run.get("avg_hr")
    run_type = run.get("run_type", "easy")
    splits = run.get("splits", [])

    lines = [f"**{run_type.title()} Run** — {km:.1f} km at {pace}/km"]

    if hr:
        if hr > 170:
            lines.append(f"Heart rate was quite high ({hr} bpm). Consider slowing down on easy days.")
        elif hr < 140 and run_type == "easy":
            lines.append(f"Good heart rate control ({hr} bpm) for an easy run.")

    if splits and len(splits) > 2:
        first_pace = splits[0].get("elapsed_time", 0)
        last_pace = splits[-1].get("elapsed_time", 0)
        if first_pace and last_pace:
            if last_pace < first_pace * 0.95:
                lines.append("Nice negative split! You finished stronger than you started.")
            elif last_pace > first_pace * 1.1:
                lines.append("You slowed down significantly. Try starting more conservatively.")

    if km >= 18:
        lines.append("Great long run! This builds aerobic endurance for race day.")
    elif run_type == "intervals":
        lines.append("Interval sessions boost VO2max. Make sure to recover well before the next hard effort.")

    return {"analysis": "\n\n".join(lines)}

# ═══════════════════════════════════════════════════════════════════════════════
#  AI HELPERS — 3-level fallback: Claude Haiku → Gemini Flash → Algorithmic
# ═══════════════════════════════════════════════════════════════════════════════

async def _call_ai_async(prompt: str, max_tokens: int = 900) -> str:
    """Try Claude Haiku 4.5, then Gemini 2.0 Flash, then raise."""
    # Level 1: Claude Haiku
    if ANTHROPIC_API_KEY:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=max_tokens,
                temperature=0.8,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
        except Exception as e:
            print(f"[AI-L1] Claude failed: {type(e).__name__}: {e}")

    # Level 2: Gemini (free tier)
    if GEMINI_API_KEY:
        try:
            from google import genai as ggenai
            gclient2 = ggenai.Client(api_key=GEMINI_API_KEY)
            gresp2 = await gclient2.aio.models.generate_content(
                model="gemini-2.0-flash", contents=prompt
            )
            return gresp2.text.strip()
        except Exception as e:
            print(f"[AI-L2] Gemini failed: {type(e).__name__}: {e}")

    raise RuntimeError("All AI providers unavailable")


def _algorithmic_dna(
    vdot: float, consistency_score: float, eff_score: int,
    ctl: float, tsb: float, zone_dist: dict, freq: float, age: int,
) -> dict:
    """Level-3 fallback: generate all DNA fields algorithmically from raw metrics."""
    # Profile level
    if vdot >= 52:   level = "Sub-Elite"
    elif vdot >= 47: level = "Amatore Avanzato"
    elif vdot >= 42: level = "Amatore Evoluto"
    elif vdot >= 37: level = "Amatore Base"
    else:            level = "Principiante"

    # Profile type from zones
    z1z2 = zone_dist.get("z1", 0) + zone_dist.get("z2", 0)
    z4   = zone_dist.get("z4", 0)
    z5   = zone_dist.get("z5", 0)
    if z5 > 15:       ptype = "Speed-Power"
    elif z4 > 25:     ptype = "Threshold Specialist"
    elif z1z2 >= 80:  ptype = "Endurance Puro"
    else:             ptype = "Aerobico Versatile"

    # Trend
    if consistency_score > 75 and ctl > 40: trend = "In Crescita"
    elif consistency_score < 35 or ctl < 15: trend = "In Calo"
    else:                                    trend = "Stabile"

    # Form
    if   tsb > 10:  form = "Picco di Forma"
    elif tsb > 0:   form = "Forma Ottimale"
    elif tsb > -10: form = "Leggero Affaticamento"
    else:           form = "Sovraccarico Funzionale"

    # Ideal distance
    if z1z2 >= 80:  ideal = "Maratona"
    elif z1z2 >= 65: ideal = "Mezza Maratona"
    elif z5 > 15:   ideal = "5K"
    else:           ideal = "10K"

    pol_ok = z1z2 >= 75
    arch = (
        f"Runner classificato {level} con VDOT {vdot:.1f}. "
        + ("Distribuzione delle zone coerente con un approccio polarizzato 80/20 — segnale di disciplina aerobica. " if pol_ok
           else "Distribuzione delle zone sbilanciata verso le intensità medie — fenomeno del 'grey zone' tipico di chi non rallenta abbastanza nelle uscite facili. ")
        + f"Il profilo biomeccanico-metabolico indica un archetipo {ptype}."
    )

    verdict = (
        f"VDOT {vdot:.1f}: " +
        ("capacità aerobica ben costruita. " if vdot >= 42 else "ancora margine significativo da esprimere. ") +
        ("La frequenza di allenamento è il tuo punto di forza. " if consistency_score >= 70
         else "La costanza è il limite principale: senza regolarità non si costruisce base aerobica. ") +
        ("Forma attuale ottimale." if tsb > 0 else "Attenzione: carico accumulato elevato, valuta una settimana di recupero.")
    )

    strengths: list = []
    if vdot >= 42:            strengths.append(f"VDOT {vdot:.1f} — solida capacità aerobica di base")
    if consistency_score >= 70: strengths.append(f"Costanza: {freq:.1f} run/settimana mantenute regolarmente")
    if pol_ok:                strengths.append("Polarizzazione 80/20 rispettata — metodo di allenamento corretto")
    if eff_score >= 70:       strengths.append("Efficienza aerobica elevata — ottimo rapporto passo/FC")
    if ctl >= 40:             strengths.append(f"CTL {ctl:.0f} — buon carico cronico adattativo")
    while len(strengths) < 3: strengths.append("Continua a costruire sulla base aerobica attuale")

    gaps: list = []
    if consistency_score < 60: gaps.append(f"Costanza insufficiente ({freq:.1f} run/w) — target minimo 3-4 uscite/settimana")
    if not pol_ok:             gaps.append(f"Solo {z1z2}% del tempo in Z1/Z2 — rallenta le corse facili")
    if eff_score < 60:         gaps.append("Efficienza biomeccanica da migliorare — lavora su cadenza e tecnica")
    if ctl < 25:               gaps.append("Volume cronico troppo basso — stimolo adattativo insufficiente")
    if vdot < 40:              gaps.append("Base aerobica in costruzione — priorità assoluta alle corse lente")
    while len(gaps) < 3:      gaps.append("Aumenta progressivamente il volume (+8% a settimana)")

    age_penalty = max(0.0, (age - 35) * 0.15)  # -0.15 VDOT per year over 35
    ceiling = round(min(55.0, vdot + max(3.0, (80 - consistency_score) / 15 + (50 - min(50, ctl)) / 15) - age_penalty), 1)

    actions = []
    if consistency_score < 75: actions.append("portare la frequenza a 4 run/settimana")
    if not pol_ok:             actions.append("rallentare le corse facili sotto il 75% FCmax")
    if ctl < 40:               actions.append("aumentare il volume del 8% a settimana")
    if not actions:            actions = ["mantenere la costanza e aggiungere una sessione di qualità a settimana"]
    unlock = "Per raggiungere il tuo ceiling: " + ", ".join(actions[:2]) + "."

    return {
        "profile_level":         level,
        "profile_type":          ptype,
        "archetype_description": arch,
        "trend_status":          trend,
        "trend_detail":          "Analisi algoritmica — connetti un provider AI per insight personalizzati.",
        "consistency_label":     f"{'Solida' if consistency_score >= 70 else 'Da migliorare'} — {freq:.1f} run/settimana",
        "efficiency_label":      f"{'Elevata' if eff_score >= 70 else 'Migliorabile'} — score {eff_score}/100",
        "form_label":            form,
        "vdot_ceiling":          ceiling,
        "ideal_distance":        ideal,
        "coach_verdict":         verdict,
        "strengths":             strengths[:3],
        "gaps":                  gaps[:3],
        "unlock_message":        unlock,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  RUNNER DNA — OLYMPIC COACH AI IDENTITY ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/runner-dna")
async def get_runner_dna():
    """Full physiological identity profile — Claude Haiku → Gemini → Algorithmic."""
    import json
    from datetime import date, timedelta

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    runs      = await db.runs.find(q).sort("date", 1).to_list(1000)
    profile   = await db.profile.find_one(q) or {}
    ff_docs   = await db.fitness_freshness.find(q).sort("date", -1).to_list(30)
    be_doc    = await db.best_efforts.find_one(q) or {}

    if len(runs) < 5:
        return JSONResponse({"error": "not_enough_data"}, status_code=400)

    # ── Cache check ────────────────────────────────────────────────────────────
    last_run_date = runs[-1].get("date")
    cached = await db.runner_dna_cache.find_one({"athlete_id": athlete_id})
    if cached and cached.get("last_run_date") == last_run_date:
        cached_data = cached.get("dna_data", {})
        if cached_data.get("profile", {}).get("level") != "Analisi AI Non Disponibile":
            return {"dna": cached_data}

    # ── Base metrics ───────────────────────────────────────────────────────────
    total_runs = len(runs)
    total_km   = sum(r.get("distance_km", 0) for r in runs)
    max_hr     = profile.get("max_hr", 190)
    age        = profile.get("age", 30)
    sex        = profile.get("sex", "M")

    hr_runs  = [r for r in runs if (r.get("avg_hr") or 0) > 0]
    cad_runs = [r for r in runs if (r.get("avg_cadence") or 0) > 0]

    avg_hr_all  = sum(r["avg_hr"] for r in hr_runs) / len(hr_runs) if hr_runs else 0
    avg_cad_all = (sum(r["avg_cadence"] for r in cad_runs) / len(cad_runs)) * 2 if cad_runs else 0

    total_sec        = sum(r.get("duration_minutes", 0) * 60 for r in runs)
    avg_pace_sec_km  = total_sec / total_km if total_km > 0 else 0  # sec/km

    # Zone distribution (time-based)
    zones = {"z1": 0.0, "z2": 0.0, "z3": 0.0, "z4": 0.0, "z5": 0.0}
    for r in hr_runs:
        pct = (r["avg_hr"] / max_hr) * 100
        dur = r.get("duration_minutes", 0)
        if   pct < 65: zones["z1"] += dur
        elif pct < 77: zones["z2"] += dur
        elif pct < 84: zones["z3"] += dur
        elif pct < 91: zones["z4"] += dur
        else:          zones["z5"] += dur
    tot_z = sum(zones.values()) or 1
    zone_dist = {k: round(v / tot_z * 100) for k, v in zones.items()}

    # ── VDOT — use best of: window-based (current form) vs best-efforts (true peak) ──
    be_efforts = be_doc.get("efforts", [])
    vdot_from_runs   = _calc_vdot(runs, max_hr, weeks_window=8)
    vdot_from_be     = _vdot_from_best_efforts(be_efforts)
    vdot_current     = max(vdot_from_runs or 28.0, vdot_from_be or 28.0)

    cutoff_old   = (date.today() - timedelta(weeks=24)).isoformat()
    older_runs   = [r for r in runs if r.get("date", "") < cutoff_old]
    older_vdot   = _calc_vdot(older_runs, max_hr, weeks_window=16) if len(older_runs) >= 3 else None
    vdot_delta   = round(vdot_current - older_vdot, 1) if older_vdot else None

    # Frequency / weeks active
    try:
        first_run_d  = date.fromisoformat(runs[0]["date"][:10])
        last_run_d   = date.fromisoformat(runs[-1]["date"][:10])
        weeks_active = max(1.0, (last_run_d - first_run_d).days / 7)
        freq         = total_runs / weeks_active
    except Exception:
        freq, weeks_active = 0.0, 1.0

    consistency_score = min(100, (freq / 4) * 100)

    # Aerobic efficiency (m/min per bpm)
    eff_score    = 0
    eff_index_val = 0.0
    if avg_hr_all > 0 and avg_pace_sec_km > 0:
        speed_mpm     = 1000 / avg_pace_sec_km * 60
        eff_index_val = speed_mpm / avg_hr_all
        if   eff_index_val > 1.6: eff_score = 90
        elif eff_index_val > 1.3: eff_score = 75
        elif eff_index_val > 1.0: eff_score = 55
        else:                     eff_score = 35

    ctl = ff_docs[0].get("ctl", 0.0) if ff_docs else 0.0
    atl = ff_docs[0].get("atl", 0.0) if ff_docs else 0.0
    tsb = ff_docs[0].get("tsb", 0.0) if ff_docs else 0.0

    cadence_score = 0
    if avg_cad_all > 0:
        cadence_score = min(100, max(0, round((avg_cad_all - 148) / (186 - 148) * 100)))

    # ── 4 DNA scores (0–100) ──────────────────────────────────────────────────
    aerobic_score = min(100, max(0, round((vdot_current - 28) / (55 - 28) * 100)))
    biomech_score = round(eff_score * 0.6 + cadence_score * 0.4)
    load_score    = min(100, round(ctl / 80 * 100))

    # ── Running dynamics (Garmin) ─────────────────────────────────────────────
    dyn_runs = [r for r in runs if r.get("avg_vertical_oscillation")]
    avg_vert_osc   = round(sum(r["avg_vertical_oscillation"] for r in dyn_runs) / len(dyn_runs), 1) if dyn_runs else None
    dyn_runs_r     = [r for r in runs if r.get("avg_vertical_ratio")]
    avg_vert_ratio = round(sum(r["avg_vertical_ratio"] for r in dyn_runs_r) / len(dyn_runs_r), 1) if dyn_runs_r else None
    dyn_runs_g     = [r for r in runs if r.get("avg_ground_contact_time")]
    avg_gct        = round(sum(r["avg_ground_contact_time"] for r in dyn_runs_g) / len(dyn_runs_g)) if dyn_runs_g else None
    dyn_runs_s     = [r for r in runs if r.get("avg_stride_length")]
    avg_stride     = round(sum(r["avg_stride_length"] for r in dyn_runs_s) / len(dyn_runs_s), 2) if dyn_runs_s else None

    # ── Comparison data ───────────────────────────────────────────────────────
    today = date.today()
    lm_start = (today - timedelta(days=60)).isoformat()
    lm_end   = (today - timedelta(days=30)).isoformat()
    lm_runs  = [r for r in runs if lm_start <= r.get("date", "") <= lm_end]
    lm_km    = sum(r.get("distance_km", 0) for r in lm_runs)
    lm_sec   = sum(r.get("duration_minutes", 0) * 60 for r in lm_runs)
    lm_pace_sec = lm_sec / lm_km if lm_km > 0 else 0
    lm_pace_str = f"{int(lm_pace_sec // 60)}:{int(lm_pace_sec % 60):02d}" if lm_pace_sec > 0 else None
    lm_hr_runs  = [r for r in lm_runs if (r.get("avg_hr") or 0) > 0]
    lm_avg_hr   = round(sum(r["avg_hr"] for r in lm_hr_runs) / len(lm_hr_runs)) if lm_hr_runs else None
    lm_vdot     = _calc_vdot(lm_runs, max_hr, weeks_window=4) if len(lm_runs) >= 2 else None
    lm_freq     = round(len(lm_runs) / 4, 1)  # runs per week over ~4 weeks

    # Level benchmarks (avg runner at same level and next level)
    _BENCHMARKS = {
        "Principiante":     {"vdot": 30, "pace_sec": 450, "hr": 160, "freq": 2.0},
        "Amatore Base":     {"vdot": 35, "pace_sec": 390, "hr": 156, "freq": 2.5},
        "Amatore Evoluto":  {"vdot": 40, "pace_sec": 345, "hr": 152, "freq": 3.0},
        "Amatore Avanzato": {"vdot": 45, "pace_sec": 310, "hr": 150, "freq": 3.5},
        "Sub-Elite":        {"vdot": 50, "pace_sec": 280, "hr": 147, "freq": 4.5},
        "Elite":            {"vdot": 55, "pace_sec": 250, "hr": 144, "freq": 6.0},
    }
    _LEVELS = list(_BENCHMARKS.keys())

    # Weeks to race
    weeks_to_race = None
    race_date_str = profile.get("race_date", "")
    if race_date_str:
        try:
            race_d        = date.fromisoformat(race_date_str[:10])
            weeks_to_race = max(0, (race_d - today).days // 7)
        except Exception:
            pass

    pace_str = (
        f"{int(avg_pace_sec_km // 60)}:{int(avg_pace_sec_km % 60):02d}/km"
        if avg_pace_sec_km > 0 else "N/D"
    )
    delta_str = (
        f"+{vdot_delta}" if vdot_delta and vdot_delta > 0
        else str(vdot_delta) if vdot_delta is not None
        else "N/D"
    )
    polarization_ok = zone_dist.get("z1", 0) + zone_dist.get("z2", 0) >= 75
    be_summary = {e["distance"]: e["time"] for e in be_efforts[:6]} if be_efforts else {}

    # ── AI Prompt (Haiku 4.5 — cost-effective) ────────────────────────────────
    prompt = f"""Sei l'Head Coach dell'Accademia Olimpica di Atletica. Analizza i dati di questo atleta in modo brutalmente onesto, tecnico, appassionato — come un vero coach olimpico che guarda l'atleta negli occhi.

SCHEDA FISIOLOGICA:
• Età: {age} anni | Sesso: {sex}
• Storico: {round(weeks_active)} settimane | {total_runs} corse | {total_km:.1f} km
• VDOT: {vdot_current:.1f} (trend 6 mesi: {delta_str})
• Frequenza: {freq:.1f} run/week | Passo medio: {pace_str}
• FC media: {round(avg_hr_all) if avg_hr_all else 'N/D'} bpm | FCmax: {max_hr} bpm
• Cadenza: {round(avg_cad_all) if avg_cad_all else 'N/D'} spm
• Efficienza aero: {round(eff_index_val, 3) if eff_index_val else 'N/D'} m/min÷bpm
• CTL:{ctl:.1f} ATL:{atl:.1f} TSB:{tsb:.1f}
• Zone: Z1={zone_dist['z1']}% Z2={zone_dist['z2']}% Z3={zone_dist['z3']}% Z4={zone_dist['z4']}% Z5={zone_dist['z5']}%
• 80/20: {'OK' if polarization_ok else 'NON rispettata'}
• PB: {json.dumps(be_summary) if be_summary else 'N/D'}
• Goal: {profile.get('race_goal','N/D')} | Settimane gara: {weeks_to_race if weeks_to_race is not None else 'N/D'}

Rispondi SOLO JSON puro (no markdown):
{{
  "profile_level": "<Principiante|Amatore Base|Amatore Evoluto|Amatore Avanzato|Sub-Elite|Elite>",
  "profile_type": "<Endurance Puro|Speed-Power|Aerobico Versatile|Threshold Specialist|Ultra Endurance|Velocista Distanza>",
  "archetype_description": "<2-3 frasi fenotipo fisiologico>",
  "trend_status": "<In Forte Crescita|In Crescita|Stabile|In Calo|In Forte Regressione>",
  "trend_detail": "<1 frase causa trend>",
  "consistency_label": "<diagnosi costanza 6-10 parole>",
  "efficiency_label": "<diagnosi biomeccanica 6-10 parole>",
  "form_label": "<stato CTL/TSB 4-6 parole>",
  "vdot_ceiling": <float >= {vdot_current:.1f}, realistico per età {age}>,
  "ideal_distance": "<5K|10K|Mezza Maratona|Maratona|Ultra>",
  "coach_verdict": "<2-3 frasi oneste e motivanti>",
  "strengths": ["<forza 1>","<forza 2>","<forza 3>"],
  "gaps": ["<lacuna 1>","<lacuna 2>","<lacuna 3>"],
  "unlock_message": "<1-2 frasi azioni concrete per raggiungere il ceiling>"
}}"""

    ai_data = None
    try:
        ai_text = await _call_ai_async(prompt, max_tokens=900)
        if ai_text.startswith("```"):
            ai_text = ai_text.split("```")[1]
            if ai_text.lower().startswith("json"):
                ai_text = ai_text[4:]
            ai_text = ai_text.strip()
        ai_data = json.loads(ai_text)
        print("[DNA] AI analysis OK")
    except Exception as e:
        print(f"[DNA] All AI providers failed: {e} — using algorithmic fallback")

    if ai_data is None:
        ai_data = _algorithmic_dna(
            vdot=vdot_current, consistency_score=consistency_score,
            eff_score=eff_score, ctl=ctl, tsb=tsb, zone_dist=zone_dist,
            freq=freq, age=age,
        )

    vdot_ceiling  = round(float(ai_data.get("vdot_ceiling", vdot_current + 5)), 1)
    # Ensure ceiling is always > current
    if vdot_ceiling <= vdot_current:
        vdot_ceiling = round(vdot_current + 3, 1)
    potential_pct = min(99, round((vdot_current / vdot_ceiling) * 100))

    # Resolve level for comparison benchmarks
    detected_level = ai_data.get("profile_level", "Amatore Evoluto")
    level_idx = next(
        (i for i, l in enumerate(_LEVELS) if l in detected_level),
        2  # default Amatore Evoluto
    )
    bench_avg    = _BENCHMARKS[_LEVELS[level_idx]]
    bench_target = _BENCHMARKS[_LEVELS[min(len(_LEVELS) - 1, level_idx + 1)]]

    def _pace_sec_to_str(s: float) -> str:
        return f"{int(s//60)}:{int(s%60):02d}" if s > 0 else "N/D"

    dna = {
        "profile": {
            "level":                 ai_data.get("profile_level", ""),
            "type":                  ai_data.get("profile_type", ""),
            "archetype_description": ai_data.get("archetype_description", ""),
            "vdot_current":          round(vdot_current, 1),
            "vdot_delta":            vdot_delta,
        },
        "stats": {
            "avg_pace":          pace_str,
            "avg_hr":            round(avg_hr_all) if avg_hr_all else 0,
            "avg_cadence":       round(avg_cad_all) if avg_cad_all else 0,
            "zone_distribution": zone_dist,
            "total_runs":        total_runs,
            "total_km":          round(total_km, 1),
            "weeks_active":      round(weeks_active),
        },
        "performance": {
            "trend_status": ai_data.get("trend_status", ""),
            "trend_detail": ai_data.get("trend_detail", ""),
            "total_km":     round(total_km, 1),
        },
        "consistency": {
            "score_pct":     int(consistency_score),
            "label":         ai_data.get("consistency_label", ""),
            "runs_per_week": round(freq, 1),
        },
        "efficiency": {
            "score_pct": int(eff_score),
            "label":     ai_data.get("efficiency_label", ""),
            "cadence":   round(avg_cad_all) if avg_cad_all else 0,
        },
        "current_state": {
            "form_label":  ai_data.get("form_label", ""),
            "fitness_ctl": round(ctl, 1),
            "atl":         round(atl, 1),
            "tsb":         round(tsb, 1),
        },
        "potential": {
            "vdot_ceiling":        vdot_ceiling,
            "potential_pct":       potential_pct,
            "ideal_distance":      ai_data.get("ideal_distance", ""),
            "predictions":         _predict_race(vdot_ceiling),
            "current_predictions": _predict_race(vdot_current),
        },
        "ai_coach": {
            "coach_verdict":  ai_data.get("coach_verdict", ""),
            "strengths":      ai_data.get("strengths", []),
            "gaps":           ai_data.get("gaps", []),
            "unlock_message": ai_data.get("unlock_message", ""),
        },
        "dna_scores": {
            "aerobic_engine": aerobic_score,
            "biomechanics":   biomech_score,
            "consistency":    int(consistency_score),
            "load_capacity":  load_score,
        },
        # Running dynamics (Garmin watches only — null if not available)
        "running_dynamics": {
            "vertical_oscillation_cm": avg_vert_osc,
            "vertical_ratio_pct":      avg_vert_ratio,
            "ground_contact_ms":       avg_gct,
            "stride_length_m":         avg_stride,
        },
        # Comparison benchmarks
        "comparison": {
            "last_month": {
                "vdot":         round(lm_vdot, 1) if lm_vdot else None,
                "pace_str":     lm_pace_str,
                "avg_hr":       lm_avg_hr,
                "runs_per_week": lm_freq,
            },
            "avg_runner": {
                "vdot":         bench_avg["vdot"],
                "pace_str":     _pace_sec_to_str(bench_avg["pace_sec"]),
                "avg_hr":       bench_avg["hr"],
                "runs_per_week": bench_avg["freq"],
            },
            "target": {
                "vdot":         bench_target["vdot"],
                "pace_str":     _pace_sec_to_str(bench_target["pace_sec"]),
                "avg_hr":       bench_target["hr"],
                "runs_per_week": bench_target["freq"],
            },
        },
    }

    # Cache — only on real AI success
    if dna["profile"]["level"] != "Analisi AI Non Disponibile":
        await db.runner_dna_cache.update_one(
            {"athlete_id": athlete_id},
            {"$set": {"last_run_date": last_run_date, "dna_data": dna}},
            upsert=True,
        )

    return {"dna": dna}


@app.delete("/api/runner-dna/cache")
async def clear_runner_dna_cache():
    """Clear Runner DNA cache to force full AI re-analysis."""
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    await db.runner_dna_cache.delete_many(q)
    return {"ok": True, "message": "Cache cleared — next request will re-analyse."}


@app.get("/api/test-ai")
async def test_ai_connection():
    """Diagnostic: test Claude + Gemini connectivity."""
    results = {}

    # Test Claude
    if ANTHROPIC_API_KEY:
        try:
            from anthropic import AsyncAnthropic
            c = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            r = await c.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=10,
                messages=[{"role": "user", "content": "Reply: OK"}],
            )
            results["claude"] = {"ok": True, "reply": r.content[0].text.strip()}
        except Exception as e:
            results["claude"] = {"ok": False, "error": str(e), "type": type(e).__name__}
    else:
        results["claude"] = {"ok": False, "error": "ANTHROPIC_API_KEY non impostata"}

    # Test Gemini
    if GEMINI_API_KEY:
        try:
            from google import genai as ggenai
            gtc = ggenai.Client(api_key=GEMINI_API_KEY)
            r2 = await gtc.aio.models.generate_content(model="gemini-2.0-flash", contents="Reply: OK")
            results["gemini"] = {"ok": True, "reply": r2.text.strip()}
        except Exception as e:
            results["gemini"] = {"ok": False, "error": str(e), "type": type(e).__name__}
    else:
        results["gemini"] = {"ok": False, "error": "GEMINI_API_KEY non impostata"}

    active = [k for k, v in results.items() if v.get("ok")]
    return {"providers": results, "active": active, "will_use": active[0] if active else "algorithmic"}


@app.post("/api/admin/backfill-dynamics")
async def backfill_dynamics(limit: int = 20):
    """Retroactively download and parse FIT files for existing runs in DB.
    
    Limited to 20 runs per call to avoid Strava rate limits.
    """
    tokens = await db.strava_tokens.find_one(sort=[("_id", -1)])
    if not tokens:
        return JSONResponse({"error": "not_connected"}, status_code=400)
    
    tokens = await _refresh_token_if_needed(tokens)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    
    athlete_id = tokens.get("athlete_id")
    q = {"athlete_id": athlete_id, "avg_vertical_oscillation": None}
    runs_to_fix = await db.runs.find(q).sort("date", -1).to_list(limit)
    
    updated = 0
    errors = []
    
    async with httpx.AsyncClient(timeout=30.0) as http:
        for run in runs_to_fix:
            strava_id = run.get("strava_id")
            if not strava_id: continue
            
            try:
                # 1. Download FIT
                fit_resp = await http.get(
                    f"https://www.strava.com/api/v3/activities/{strava_id}/export",
                    headers=headers
                )
                if fit_resp.status_code == 200:
                    # 2. Parse
                    dynamics = _extract_fit_dynamics(fit_resp.content)
                    if dynamics:
                        # 3. Update DB
                        await db.runs.update_one(
                            {"_id": run["_id"]},
                            {"$set": dynamics}
                        )
                        updated += 1
                else:
                    errors.append(f"ID {strava_id}: HTTP {fit_resp.status_code}")
            except Exception as e:
                errors.append(f"ID {strava_id}: {str(e)}")
                
    return {
        "ok": True,
        "updated": updated,
        "total_attempted": len(runs_to_fix),
        "errors": errors
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  GARMIN CONNECT — Running Dynamics via FIT download
# ═══════════════════════════════════════════════════════════════════════════════

async def _garmin_login(timeout: float = 30.0):
    """Login to Garmin Connect e restituisce un client autenticato.

    Strategia (python-garminconnect):
    1. Prova token salvato in MongoDB (garth auto-refresh se scaduto)
    2. Se fallisce → login diretto con email/password (niente SSO popup!)
    3. Salva il nuovo token in MongoDB per riuso futuro

    Timeout: secondi massimi per ogni operazione (default 30s).
    """
    from garminconnect import Garmin
    import garth

    if not GARMIN_EMAIL or not GARMIN_PASSWORD:
        raise ValueError("GARMIN_EMAIL / GARMIN_PASSWORD non impostati in .env")

    # ── 1) Prova token salvato ────────────────────────────────────────────────
    print("[GARMIN] Controllo token salvato...")
    saved = await db.garmin_tokens.find_one({"email": GARMIN_EMAIL})
    if saved and saved.get("token_dump"):
        print("[GARMIN] Token trovato, provo smoke test...")
        try:
            garth_client = garth.Client()
            garth_client.loads(saved["token_dump"])
            client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
            client.garth = garth_client

            # Smoke test con timeout
            async def _smoke_test():
                return await asyncio.to_thread(client.get_activities, 0, 1)

            try:
                await asyncio.wait_for(_smoke_test(), timeout=timeout)
                print("[GARMIN] Smoke test OK con token salvato")
            except asyncio.TimeoutError:
                raise ValueError(f"Garmin smoke test timeout dopo {timeout}s — connessione lenta o down")
            except Exception as smoke_err:
                err_str = str(smoke_err)
                if "429" in err_str or "Too Many Requests" in err_str:
                    print("[GARMIN] Smoke test 429, token comunque valido")
                    return client
                if "timeout" in err_str.lower() or "timed out" in err_str.lower():
                    raise ValueError(f"Garmin smoke test timeout: {smoke_err}")
                raise

            # Salva token aggiornato
            try:
                new_dump = client.garth.dumps()
                if new_dump != saved.get("token_dump"):
                    await db.garmin_tokens.update_one(
                        {"email": GARMIN_EMAIL},
                        {"$set": {"token_dump": new_dump}},
                    )
                    print("[GARMIN] Token refreshed e salvato")
            except Exception:
                pass
            print("[GARMIN] Login via token salvato OK")
            return client
        except asyncio.TimeoutError:
            raise ValueError(f"Garmin operazione timeout dopo {timeout}s")
        except ValueError:
            raise  # Re-raise ValueError (già formattato)
        except Exception as e:
            print(f"[GARMIN] Token salvato non valido: {e} → login con credenziali")

    # ── 2) Login diretto con email/password (garminconnect) ───────────────────
    print(f"[GARMIN] Login diretto con {GARMIN_EMAIL}...")
    client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)

    async def _do_login():
        return await asyncio.to_thread(client.login)

    try:
        await asyncio.wait_for(_do_login(), timeout=timeout)
        print("[GARMIN] Login diretto OK")
    except asyncio.TimeoutError:
        raise ValueError(
            f"Garmin login timeout dopo {timeout}s. "
            f"Provare tra 15-30 minuti o usare lo script garth_generate_token.py"
        )
    except Exception as login_err:
        err_str = str(login_err)
        if "429" in err_str or "Too Many Requests" in err_str:
            raise ValueError(
                "Garmin rate-limit — troppi tentativi di login. "
                "Aspetta 15-30 minuti e riprova, oppure usa garth_generate_token.py"
            )
        if "timeout" in err_str.lower() or "timed out" in err_str.lower():
            raise ValueError(f"Garmin login timeout: {login_err}")
        raise ValueError(f"Login Garmin fallito: {login_err}")

    # Salva token per riuso futuro
    try:
        token_dump = client.garth.dumps()
        await db.garmin_tokens.update_one(
            {"email": GARMIN_EMAIL},
            {"$set": {"email": GARMIN_EMAIL, "token_dump": token_dump}},
            upsert=True,
        )
        print("[GARMIN] Token salvato in MongoDB")
    except Exception as save_err:
        print(f"[GARMIN] Token login OK ma salvataggio fallito: {save_err}")

    return client


@app.get("/api/garmin/status")
async def garmin_status():
    """Return whether Garmin credentials are configured and if tokens are cached."""
    saved = await db.garmin_tokens.find_one({"email": GARMIN_EMAIL}) if GARMIN_EMAIL else None
    return {
        "configured": bool(GARMIN_EMAIL and GARMIN_PASSWORD),
        "email": GARMIN_EMAIL if GARMIN_EMAIL else None,
        "token_cached": bool(saved and saved.get("token_dump")),
    }


@app.post("/api/garmin/save-token")
async def garmin_save_token(request: Request):
    """Save a garth token dump manually — use when Garmin rate-limits fresh logins.

    Body: { "token_dump": "<output of garth_generate_token.py>" }
    Once saved, all subsequent syncs reuse this token (auto-refreshed by garth).
    """
    body = await request.json()
    token_dump = body.get("token_dump", "").strip()
    if not token_dump:
        return JSONResponse({"error": "missing token_dump"}, status_code=400)

    # Validate the token works before saving
    try:
        import garth
        from garminconnect import Garmin
        garth_client = garth.Client()
        garth_client.loads(token_dump)
        client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        client.garth = garth_client
        client.get_activities(0, 1)  # smoke test
    except Exception as e:
        return JSONResponse({"error": "invalid_token", "detail": str(e)}, status_code=400)

    await db.garmin_tokens.update_one(
        {"email": GARMIN_EMAIL},
        {"$set": {"email": GARMIN_EMAIL, "token_dump": token_dump}},
        upsert=True,
    )
    return {"ok": True, "message": "Token salvato — Garmin Sync ora funzionerà senza login."}


@app.post("/api/garmin/login")
async def garmin_login_direct():
    """Direct login to Garmin Connect without downloading any activities.
    
    Use this when you need to authenticate but can't use the SSO popup.
    This uses the same _garmin_login() function as sync, but without fetching data.
    If you're rate-limited, use garth_generate_token.py instead.
    """
    try:
        await _garmin_login()
        return {"ok": True, "message": "Login effettuato — puoi usare Garmin Sync ora"}
    except Exception as e:
        err_str = str(e)
        if "rate-limit" in err_str or "429" in err_str:
            return JSONResponse({
                "error": "rate_limited",
                "detail": err_str,
            }, status_code=429)
        return JSONResponse({
            "error": "login_failed",
            "detail": err_str,
        }, status_code=400)


@app.get("/api/garmin/auth-start")
async def garmin_auth_start(frontend_origin: str = Query(...)):
    """Return the Garmin SSO URL the frontend should open in a popup.

    Garmin only redirects back to whitelisted service URLs, so we use
    service=<frontend_origin>/garmin-auth (same origin as parent window).
    The parent can then read popup.location.href (same-origin, no restriction)
    and extract the ticket without any cross-origin issues.
    """
    from urllib.parse import quote
    # Use /garmin-auth.html — a static file served by Vite/CDN that bypasses
    # React Router (which would strip ?ticket= query param on unknown routes).
    service = f"{frontend_origin}/garmin-auth.html"
    sso_url = (
        f"https://sso.garmin.com/sso/signin"
        f"?service={quote(service)}"
        f"&redirectAfterAccountLoginUrl={quote(service)}"
        f"&redirectAfterAccountCreationUrl={quote(service)}"
        f"&gauthHost={quote('https://sso.garmin.com/sso')}"
    )
    return {"auth_url": sso_url, "service": service}


@app.post("/api/garmin/exchange-ticket")
async def garmin_exchange_ticket(request: Request):
    """Exchange a raw Garmin SSO ticket for OAuth2 tokens and save to MongoDB.

    Body: { "ticket": "ST-XXXXX", "service": "https://frontend/garmin-auth" }
    The service must match what was passed as service= during SSO login,
    and is used as login-url in the Garmin preauthorized endpoint.
    """
    body = await request.json()
    ticket  = body.get("ticket", "").strip()
    service = body.get("service", "").strip()

    if not ticket or not service:
        return JSONResponse({"error": "missing ticket or service"}, status_code=400)

    try:
        import garth
        import httpx as _httpx
        from garminconnect import Garmin

        async with _httpx.AsyncClient(timeout=15) as hc:
            cr = (await hc.get("https://thegarth.s3.amazonaws.com/oauth_consumer.json")).json()
        consumer_key    = cr["consumer_key"]
        consumer_secret = cr["consumer_secret"]

        from urllib.parse import quote as _q
        preauth_url = (
            f"https://connectapi.garmin.com/oauth-service/oauth/preauthorized"
            f"?ticket={_q(ticket)}"
            f"&login-url={_q(service)}"
            f"&accepts-mfa-tokens=true"
        )

        # Run synchronous OAuth1 request in a thread to avoid blocking the event loop
        def _do_oauth1():
            from requests_oauthlib import OAuth1Session
            sess = OAuth1Session(consumer_key, client_secret=consumer_secret)
            return sess.get(preauth_url, timeout=30)
        
        resp = await asyncio.to_thread(_do_oauth1)
        if resp.status_code == 429:
            return JSONResponse({
                "error": "garmin_rate_limited",
                "detail": "Garmin OAuth rate limit — aspetta 15 minuti e riprova"
            }, status_code=429)
        resp.raise_for_status()

        from urllib.parse import parse_qs
        params = parse_qs(resp.text)
        oauth1_token  = params["oauth_token"][0]
        oauth1_secret = params["oauth_token_secret"][0]

        garth_client = garth.Client()
        garth_client.configure(domain="garmin.com")
        from garth.auth_tokens import OAuth1Token
        oauth1 = OAuth1Token(
            oauth_token=oauth1_token,
            oauth_token_secret=oauth1_secret,
            mfa_token=None,
            mfa_expiration_timestamp=None,
            domain="garmin.com",
        )
        oauth2 = garth.exchange(oauth1, garth_client)
        garth_client.oauth2_token = oauth2

        g_client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        g_client.garth = garth_client
        g_client.get_activities(0, 1)
        token_dump = garth_client.dumps()

        await db.garmin_tokens.update_one(
            {"email": GARMIN_EMAIL},
            {"$set": {"email": GARMIN_EMAIL, "token_dump": token_dump}},
            upsert=True,
        )
        print("[GARMIN AUTH] OAuth2 token saved via exchange-ticket endpoint")
        return {"ok": True}

    except Exception as e:
        print(f"[GARMIN AUTH] exchange-ticket error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)




@app.post("/api/garmin/sync")
async def garmin_sync(
    limit: int = Query(50, ge=1, le=200),
    force: bool = Query(False, description="Forza ri-sincronizzazione anche se i dati esistono"),
):
    """Download FIT files from Garmin Connect e arricchisce le corse con Running Dynamics + HR.

    Due fasi per ogni corsa:
    1. FAST PATH: sincronizza HR (averageHR, maxHR, hr%) direttamente dall'activity JSON Garmin.
       Questo aggiorna sempre i dati HR senza scaricare il FIT.
    2. FIT DOWNLOAD: scarica il file FIT originale per Running Dynamics (VO, GCT, SL, VR).
       Viene saltato se TUTTI e 4 i campi dynamics sono già presenti (a meno che force=True).
    """
    if not GARMIN_EMAIL or not GARMIN_PASSWORD:
        return JSONResponse({"error": "garmin_not_configured"}, status_code=400)

    print(f"[GARMIN] Starting sync (limit={limit}, force={force})")
    try:
        client = await _garmin_login()
    except Exception as e:
        return JSONResponse({"error": "garmin_login_failed", "detail": str(e)}, status_code=400)

    athlete_id = await _get_athlete_id()

    # Fetch max_hr dal profilo per calcolare HR%
    profile_doc = await db.profiles.find_one({"athlete_id": athlete_id} if athlete_id else {})
    profile_max_hr = int(profile_doc.get("max_hr", 0)) if profile_doc else 0

    # Fetch Garmin running activities
    try:
        activities = client.get_activities(0, limit)
    except Exception as e:
        return JSONResponse({"error": "garmin_fetch_failed", "detail": str(e)}, status_code=500)

    # Filtra solo corsa
    running = [
        a for a in activities
        if (a.get("activityType", {}).get("typeKey", "") in
            ("running", "trail_running", "treadmill_running"))
    ]
    print(f"[GARMIN] Found {len(running)} running activities on Garmin")

    hr_updated = 0
    dynamics_updated = 0
    skipped_no_match = 0
    skipped_complete = 0
    errors = []

    for act in running:
        garmin_id = act.get("activityId")
        if not garmin_id:
            continue

        # Data e distanza dall'activity JSON Garmin
        start_time = act.get("startTimeLocal", "")   # "2024-03-15 08:30:00"
        date_str = start_time[:10] if start_time else ""
        garmin_dist_km = round((act.get("distance") or 0) / 1000, 2)

        if not date_str or garmin_dist_km < 1:
            continue

        # Trova corsa nel DB: stessa data, distanza entro 15%
        q = {"date": date_str}
        if athlete_id:
            q["athlete_id"] = athlete_id

        candidates = await db.runs.find(q).to_list(10)
        matched_run = None
        for run in candidates:
            db_dist = run.get("distance_km", 0) or 0
            if garmin_dist_km > 0 and abs(db_dist - garmin_dist_km) / garmin_dist_km < 0.15:
                matched_run = run
                break

        if not matched_run:
            print(f"[GARMIN] No match: {date_str} {garmin_dist_km}km")
            skipped_no_match += 1
            continue

        # ── FASE 1: Sincronizza HR dall'activity JSON (sempre, senza scaricare FIT) ──
        hr_fields: dict = {"garmin_activity_id": garmin_id}
        garmin_avg_hr = act.get("averageHR") or act.get("avgHr")
        garmin_max_hr = act.get("maxHR") or act.get("maxHr")

        if garmin_avg_hr and int(garmin_avg_hr) > 0:
            hr_fields["avg_hr"] = int(garmin_avg_hr)
            if profile_max_hr > 0:
                hr_fields["avg_hr_pct"] = round(int(garmin_avg_hr) / profile_max_hr * 100, 1)
        if garmin_max_hr and int(garmin_max_hr) > 0:
            hr_fields["max_hr"] = int(garmin_max_hr)
            if profile_max_hr > 0:
                hr_fields["max_hr_pct"] = round(int(garmin_max_hr) / profile_max_hr * 100, 1)

        # Salva HR subito (anche se la cadenza/dynamics fallirà)
        await db.runs.update_one({"_id": matched_run["_id"]}, {"$set": hr_fields})
        if garmin_avg_hr:
            hr_updated += 1
            print(f"[GARMIN] HR synced: {date_str} avg={garmin_avg_hr} max={garmin_max_hr}")

        # ── FASE 2: Scarica FIT per Running Dynamics ──
        # Salta se tutti e 4 i campi dynamics sono già presenti E non force
        has_all_dynamics = all([
            matched_run.get("avg_vertical_oscillation"),
            matched_run.get("avg_ground_contact_time"),
            matched_run.get("avg_stride_length"),
            matched_run.get("avg_vertical_ratio"),
        ])
        if has_all_dynamics and not force:
            skipped_complete += 1
            print(f"[GARMIN] Dynamics complete, skip FIT: {date_str}")
            continue

        # Pausa 5s tra download per evitare blocchi IP
        if dynamics_updated > 0:
            await asyncio.sleep(5)

        try:
            fit_bytes = client.download_activity(
                garmin_id,
                dl_fmt=client.ActivityDownloadFormat.ORIGINAL
            )
        except Exception as e:
            errors.append(f"{date_str} {garmin_dist_km}km: download FIT fallito — {e}")
            print(f"[GARMIN] FIT download error: {e}")
            continue

        dynamics = _extract_fit_dynamics(fit_bytes)
        if not dynamics:
            errors.append(f"{date_str} {garmin_dist_km}km: nessuna dynamics nel FIT (orologio non supportato?)")
            print(f"[GARMIN] No dynamics extracted from FIT for {date_str}")
            continue

        await db.runs.update_one(
            {"_id": matched_run["_id"]},
            {"$set": dynamics}
        )
        dynamics_updated += 1
        print(f"[GARMIN] Dynamics synced: {date_str} → {dynamics}")

    return {
        "ok": True,
        "hr_updated": hr_updated,
        "dynamics_updated": dynamics_updated,
        "updated": hr_updated,          # compatibilità frontend
        "skipped": skipped_no_match + skipped_complete,
        "skipped_no_match": skipped_no_match,
        "skipped_complete": skipped_complete,
        "total_garmin_runs": len(running),
        "errors": errors,
    }


@app.post("/api/garmin/sync-all")
async def garmin_sync_all(force: bool = Query(False)):
    """Sync tutti gli allenamenti Garmin storici (fino a 200 più recenti).

    Usa force=True per forzare ri-download dei FIT anche se dynamics già presenti.
    """
    return await garmin_sync(limit=200, force=force)


# ═══════════════════════════════════════════════════════════════════════════════
#  JARVIS — AI Voice Assistant
# ═══════════════════════════════════════════════════════════════════════════════

_JARVIS_SYSTEM_PROMPT = """Sei JARVIS, l'assistente AI integrato in METIC LAB, una dashboard professionale per l'allenamento di corsa.
Parli come JARVIS di Marvel — calmo, conciso, leggermente formale ma cordiale. Niente emoji. Massimo 2 frasi nel campo text. Rispondi SEMPRE in italiano.

Devi rispondere ESCLUSIVAMENTE con un singolo oggetto JSON valido. Nessun markdown, nessuna spiegazione fuori dal JSON.

Schema:
{
  "text": "<risposta parlata — max 2 frasi, 30 parole max, in italiano>",
  "action": {
    "type": "<uno di: navigate | speak_only | show_data | sync_strava | sync_garmin | regenerate_dna>",
    "route": "<solo per navigate: uno di /, /training, /activities, /statistics, /runner-dna, /profile>",
    "data_key": "<solo per show_data: uno di fitness_freshness, best_efforts, training_plan, vdot, last_run>"
  }
}

REGOLE DI NAVIGAZIONE (usa action.type = "navigate"):
- "apri dashboard" / "vai a home" / "home" / "dashboard" → route: "/"
- "apri allenamento" / "piano di allenamento" / "allenamento" / "training" → route: "/training"
- "apri attività" / "le mie corse" / "attività" / "corse" / "activities" → route: "/activities"
- "apri statistiche" / "statistiche" / "stats" / "statistics" → route: "/statistics"
- "runner dna" / "il mio dna" / "dna" → route: "/runner-dna"
- "apri profilo" / "il mio profilo" / "profilo" / "profile" → route: "/profile"

REGOLE DATI (usa action.type = "speak_only" e rispondi dal contesto):
- "vo2max" / "vdot" / "livello di fitness" / "quanto sono in forma" → parla del valore VDOT
- "come mi sento" / "forma" / "fatica" / "tsb" → parla di TSB e stato
- "ultima corsa" / "ultima uscita" / "ultima run" → data, distanza, passo
- "questa settimana" / "km settimanali" / "quanti km" → km settimanali
- "migliore 10k" / "10 chilometri" / "record 10k" → best 10K
- "sono pronto per la gara" / "pronto alla gara" → valuta da TSB
- "fitness freshness" / "forma fisica" → action: show_data, data_key: fitness_freshness
- "migliori performance" / "record personali" / "pr" / "pb" → action: show_data, data_key: best_efforts
- "piano" / "piano allenamento" → action: show_data, data_key: training_plan

REGOLE AZIONI:
- "sincronizza strava" / "aggiorna strava" / "sync strava" → action: sync_strava
- "sincronizza garmin" / "aggiorna garmin" / "sync garmin" → action: sync_garmin
- "rigenera dna" / "rianalizza dna" / "nuovo dna" → action: regenerate_dna

FALLBACK: Se l'intento non è chiaro, rispondi con speak_only e chiedi di riformulare.

Il contesto dell'atleta verrà fornito prima del messaggio utente. Usalo per rispondere alle domande sui dati.
Risposte brevi e concise — è output vocale."""


@app.post("/api/jarvis/chat")
async def jarvis_chat(request: Request):
    """JARVIS AI voice assistant — processes transcript and returns spoken response + action."""
    body = await request.json()
    transcript = body.get("transcript", "").strip()

    if not transcript:
        return JSONResponse({"error": "empty_transcript"}, status_code=400)

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    # Fetch minimal athlete context in parallel
    profile_doc, ff_latest, last_run_doc, recent_runs_docs = await asyncio.gather(
        db.profile.find_one(q),
        db.fitness_freshness.find_one(q, sort=[("date", -1)]),
        db.runs.find_one(q, sort=[("date", -1)]),
        db.runs.find(q, {"date": 1, "distance_km": 1, "duration_minutes": 1, "avg_hr": 1, "avg_pace": 1})
            .sort("date", -1).to_list(100),
    )

    profile = profile_doc or {}
    ff = ff_latest or {}
    last_run = last_run_doc or {}

    # Compute VDOT
    max_hr = int(profile.get("max_hr", 190))
    vdot = _calc_vdot(recent_runs_docs, max_hr)

    # Weekly km
    week_start = (dt.date.today() - dt.timedelta(days=dt.date.today().weekday())).isoformat()
    weekly_km = round(sum(r.get("distance_km", 0) for r in recent_runs_docs if r.get("date", "") >= week_start), 1)

    # Best 10K from best_efforts collection
    be_doc = await db.best_efforts.find_one(q) or {}
    best_10k = next((e.get("time") for e in be_doc.get("efforts", []) if e.get("distance") == "10 km"), None)

    ctl  = round(ff.get("ctl", 0), 1)
    atl  = round(ff.get("atl", 0), 1)
    tsb  = round(ff.get("tsb", 0), 1)
    tsb_label = "Fresh" if tsb > 10 else "Tired" if tsb < -10 else "Neutral"

    context_block = f"""ATHLETE CONTEXT (today: {dt.date.today().isoformat()}):
- Name: {profile.get("name", "Athlete")}
- VDOT (VO2max estimate): {vdot if vdot else "Not enough data"}
- CTL (Fitness): {ctl} | ATL (Fatigue): {atl} | TSB (Form): {tsb} ({tsb_label})
- Last run: {last_run.get("date", "N/A")}, {round(last_run.get("distance_km", 0), 1)} km @ {last_run.get("avg_pace", "N/A")}/km
- This week km: {weekly_km} km
- Best 10K: {best_10k if best_10k else "N/A"}
- Race goal: {profile.get("race_goal", "N/A")} on {profile.get("race_date", "N/A")}"""

    if not JARVIS_GEMINI_KEY:
        print("[JARVIS] Warning: No Gemini API Key found.")
        return JSONResponse({
            "text": "Scusa, la mia chiave AI non è configurata. Chiedi all'amministratore.",
            "action": {"type": "speak_only"}
        }, status_code=200)

    audio_base64 = None
    try:
        from google import genai as ggenai
        gclient = ggenai.Client(api_key=JARVIS_GEMINI_KEY)
        full_prompt = f"{_JARVIS_SYSTEM_PROMPT}\n\n{context_block}\n\nUSER SAID: \"{transcript}\""
        
        # Request standard TEXT modality for free tier stability
        gresp = await gclient.aio.models.generate_content(
            model="gemini-2.5-flash", 
            contents=full_prompt
        )
        
        raw = gresp.text.strip()

        # Robust JSON extraction
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                print(f"[JARVIS] JSON Decode Error. Raw: {raw}")
                result = {"text": "Ho avuto un problema nel formattare la risposta. Riprova.", "action": {"type": "speak_only"}}
        else:
            print(f"[JARVIS] No JSON found in response. Raw: {raw}")
            result = {"text": raw[:200], "action": {"type": "speak_only"}}

        if FISH_AUDIO_API_KEY and result.get("text"):
            import httpx, base64
            try:
                payload = {
                    "text": result["text"],
                    "format": "mp3"
                }
                async with httpx.AsyncClient() as http:
                    tts_resp = await http.post(
                        "https://api.fish.audio/v1/tts",
                        headers={
                            "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json=payload,
                        timeout=15.0
                    )
                    if tts_resp.status_code == 200:
                        result["audio"] = base64.b64encode(tts_resp.content).decode("utf-8")
                    else:
                        print(f"[JARVIS] Fish Audio status {tts_resp.status_code}: {tts_resp.text}")
            except Exception as fe:
                print(f"[JARVIS] Exception calling Fish Audio: {fe}")

    except Exception as e:
        error_msg = f"DEBUG: {str(e)}"
        print(f"[JARVIS] Gemini error: {error_msg}")
        result = {
            "text": error_msg,
            "action": {"type": "speak_only"}
        }

    # Return result (Frontend will fallback to browser TTS if audio is missing)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  GARMIN CSV IMPORT — Manual upload (COLLEZIONE SEPARATA, NON MODIFICA RUNS)
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_garmin_pace(pace_str: str) -> Optional[float]:
    """Parse pace string like '5:59' or '4:37' into seconds per km."""
    if not pace_str or pace_str == "--":
        return None
    try:
        parts = pace_str.strip().split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        pass
    return None


def _parse_garmin_time(time_str: str) -> Optional[float]:
    """Parse time string like '00:35:58' or '01:14:33' into minutes."""
    if not time_str or time_str == "--":
        return None
    try:
        parts = time_str.strip().split(":")
        if len(parts) == 3:
            return int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 60.0
        elif len(parts) == 2:
            return int(parts[0]) + int(parts[1]) / 60.0
    except (ValueError, IndexError):
        pass
    return None


def _parse_garmin_number(val: str) -> Optional[float]:
    """Parse a number string, handling '--' and commas."""
    if not val or val == "--":
        return None
    try:
        return float(val.replace(",", ""))
    except (ValueError, TypeError):
        return None


def _parse_garmin_int(val: str) -> Optional[int]:
    """Parse an integer string, handling '--'."""
    if not val or val == "--":
        return None
    try:
        return int(float(val.replace(",", "")))
    except (ValueError, TypeError):
        return None


@app.post("/api/garmin/csv-import")
async def garmin_csv_import(request: Request):
    """Import Garmin CSV data into a SEPARATE collection (garmin_csv_data).
    
    This does NOT modify the runs collection. Data is stored as-is for
    future use (charts, analysis, etc.).
    
    Body: { "runs": [ {csv_row_data}, ... ] }
    """
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)

    body = await request.json()
    runs_data = body.get("runs", [])
    
    if not runs_data:
        return JSONResponse({"error": "no_runs_provided"}, status_code=400)

    imported = 0
    skipped = 0
    errors = []

    for row in runs_data:
        try:
            # Extract fields from CSV row
            titolo = row.get("Titolo", "").strip()
            data_str = row.get("Data", "").strip()
            distanza_km = _parse_garmin_number(row.get("Distanza", ""))
            calorie = _parse_garmin_int(row.get("Calorie", ""))
            tempo_str = row.get("Tempo", "").strip()
            fc_media = _parse_garmin_int(row.get("FC Media", ""))
            fc_max = _parse_garmin_int(row.get("FC max", ""))
            passo_medio_str = row.get("Passo medio", "").strip()
            passo_migliore_str = row.get("Passo migliore", "").strip()
            ascesa = _parse_garmin_number(row.get("Ascesa totale", ""))
            discesa = _parse_garmin_number(row.get("Discesa totale", ""))
            cadenza_media = _parse_garmin_number(row.get("Cadenza di corsa media", ""))
            cadenza_max = _parse_garmin_number(row.get("Cadenza di corsa max", ""))
            oscillazione_verticale = _parse_garmin_number(row.get("Oscillazione verticale media", ""))
            tempo_contatto = _parse_garmin_number(row.get("Tempo medio di contatto con il suolo", ""))
            lunghezza_passo = _parse_garmin_number(row.get("Lunghezza media passo", ""))
            rapporto_verticale = _parse_garmin_number(row.get("Rapporto verticale medio", ""))
            quota_min = _parse_garmin_number(row.get("Quota minima", ""))
            quota_max = _parse_garmin_number(row.get("Quota massima", ""))
            tempo_movimento = row.get("Tempo in movimento", "").strip()
            tempo_trascorso = row.get("Tempo trascorso", "").strip()
            prp_medio = _parse_garmin_number(row.get("PRP medio", ""))
            potenza_media = _parse_garmin_number(row.get("Potenza media", ""))
            potenza_max = _parse_garmin_number(row.get("Potenza max", ""))
            consumo_body_battery = _parse_garmin_number(row.get("Consumo Body Battery", ""))
            temperatura_min = _parse_garmin_number(row.get("Temperatura min", ""))
            temperatura_max = _parse_garmin_number(row.get("Temperatura max", ""))
            te_aerobico = _parse_garmin_number(row.get("TE aerobico", ""))
            passi = _parse_garmin_int(row.get("Passi", ""))
            numero_lap = _parse_garmin_int(row.get("Numero di Lap", ""))
            tempo_lap_migliore = row.get("Tempo Lap migliore", "").strip()
            freq_resp_media = _parse_garmin_int(row.get("Frequenza respiratoria media", ""))
            freq_resp_min = _parse_garmin_int(row.get("Frequenza respiratoria minima", ""))
            freq_resp_max = _parse_garmin_int(row.get("Frequenza respiratoria massima", ""))

            # Validate required fields
            if not data_str or not distanza_km or distanza_km < 0.1:
                skipped += 1
                continue

            # Parse date - Garmin format: "2026-04-06 08:07:47"
            date_part = data_str.split(" ")[0] if " " in data_str else data_str
            try:
                dt.datetime.strptime(date_part, "%Y-%m-%d")
            except ValueError:
                errors.append(f"Data non valida: {data_str}")
                skipped += 1
                continue

            # Parse duration
            duration_minutes = _parse_garmin_time(tempo_str)
            if not duration_minutes:
                duration_minutes = _parse_garmin_time(tempo_movimento)
            if not duration_minutes:
                duration_minutes = _parse_garmin_time(tempo_trascorso)

            # Parse pace
            pace_sec = _parse_garmin_pace(passo_medio_str)
            avg_pace = f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}" if pace_sec else None

            # Build document for garmin_csv_data collection
            doc = {
                "athlete_id": athlete_id,
                "source": "garmin_csv_import",
                "imported_at": dt.datetime.now().isoformat(),
                # Core fields
                "titolo": titolo if titolo else None,
                "date": date_part,
                "distance_km": distanza_km,
                "duration_minutes": duration_minutes,
                "avg_pace": avg_pace,
                "avg_pace_sec": pace_sec,
                # Heart rate
                "avg_hr": fc_media,
                "max_hr": fc_max,
                # Running dynamics (Garmin)
                "avg_vertical_oscillation_cm": oscillazione_verticale,
                "avg_vertical_ratio_pct": rapporto_verticale,
                "avg_ground_contact_time_ms": tempo_contatto,
                "avg_stride_length_m": lunghezza_passo,
                # Cadence
                "avg_cadence_spm": round(cadenza_media / 2) if cadenza_media else None,
                "max_cadence_spm": round(cadenza_max / 2) if cadenza_max else None,
                # Elevation
                "elevation_gain_m": ascesa,
                "elevation_loss_m": discesa,
                "min_elevation_m": quota_min,
                "max_elevation_m": quota_max,
                # Power
                "avg_power_w": potenza_media,
                "max_power_w": potenza_max,
                # Additional Garmin fields
                "calories": calorie,
                "best_pace_sec": _parse_garmin_pace(passo_migliore_str),
                "steps": passi,
                "body_battery_consumed": consumo_body_battery,
                "temp_min_c": temperatura_min,
                "temp_max_c": temperatura_max,
                "te_aerobico": te_aerobico,
                "prp_medio": prp_medio,
                "laps": numero_lap,
                "best_lap_time": tempo_lap_migliore if tempo_lap_migliore else None,
                "avg_resp_rate": freq_resp_media,
                "min_resp_rate": freq_resp_min,
                "max_resp_rate": freq_resp_max,
                # Raw data (all original fields)
                "raw": row,
            }

            # Insert into garmin_csv_data (no upsert — always insert new)
            await db.garmin_csv_data.insert_one(doc)
            imported += 1

        except Exception as e:
            errors.append(f"Errore riga {imported + skipped + 1}: {str(e)}")
            continue

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "total_received": len(runs_data),
        "collection": "garmin_csv_data",
        "errors": errors[:10],
    }


@app.get("/api/garmin/csv-data")
async def get_garmin_csv_data():
    """Retrieve all Garmin CSV imported data for the current athlete."""
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)

    cursor = db.garmin_csv_data.find({"athlete_id": athlete_id}).sort("date", -1)
    docs = await cursor.to_list(1000)
    
    # Convert _id to string
    for doc in docs:
        if "_id" in doc:
            doc["id"] = str(doc["_id"])
            del doc["_id"]

    return {"data": docs, "count": len(docs)}


@app.delete("/api/garmin/csv-data/{doc_id}")
async def delete_garmin_csv_data(doc_id: str):
    """Delete a specific Garmin CSV import document."""
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)

    from bson import ObjectId
    try:
        result = await db.garmin_csv_data.delete_one({"_id": ObjectId(doc_id), "athlete_id": athlete_id})
        if result.deleted_count == 0:
            return JSONResponse({"error": "not_found"}, status_code=404)
        return {"ok": True}
    except Exception:
        return JSONResponse({"error": "invalid_id"}, status_code=400)


# ═══════════════════════════════════════════════════════════════════════════════
#  GCT ANALYSIS — Ground Contact Time by month and pace zone
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/garmin/gct-analysis")
async def get_gct_analysis():
    """Analyze Ground Contact Time from Garmin CSV data.
    
    Returns monthly averages grouped by pace zone:
    - pace_530: pace >= 5:30/km (slower)
    - pace_500: pace 5:00-5:29/km (medium)
    - pace_445: pace < 4:45/km (faster)
    
    Only includes runs >= 400m with valid GCT data.
    """
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)

    # Fetch all Garmin CSV data for this athlete
    cursor = db.garmin_csv_data.find({
        "athlete_id": athlete_id,
        "avg_ground_contact_time_ms": {"$ne": None},
        "distance_km": {"$gte": 0.4},  # Filter runs < 400m
    }).sort("date", 1)
    
    docs = await cursor.to_list(2000)
    
    if not docs:
        return {"monthly": [], "summary": {"total_runs": 0, "avg_gct": None}}
    
    # Group by month and pace zone
    monthly_data: dict = {}  # "YYYY-MM" -> {pace_zone: {gct_values: [], count: int}}
    
    for doc in docs:
        gct = doc.get("avg_ground_contact_time_ms")
        pace_sec = doc.get("avg_pace_sec")
        date_str = doc.get("date", "")
        
        if not gct or not pace_sec or not date_str:
            continue
        
        # Extract year-month
        year_month = date_str[:7]  # "2026-04"
        if year_month not in monthly_data:
            monthly_data[year_month] = {
                "pace_530": {"values": [], "count": 0},
                "pace_500": {"values": [], "count": 0},
                "pace_445": {"values": [], "count": 0},
            }
        
        # Classify pace zone
        if pace_sec >= 330:  # >= 5:30/km
            zone = "pace_530"
        elif pace_sec >= 300:  # 5:00-5:29/km
            zone = "pace_500"
        else:  # < 4:45/km (285 sec)
            zone = "pace_445"
        
        monthly_data[year_month][zone]["values"].append(gct)
        monthly_data[year_month][zone]["count"] += 1
    
    # Build result: average GCT per month per zone
    result = []
    all_gct_values = []
    
    for ym in sorted(monthly_data.keys()):
        zones = monthly_data[ym]
        row = {"month": ym}
        
        for zone in ["pace_530", "pace_500", "pace_445"]:
            values = zones[zone]["values"]
            if values:
                avg = round(sum(values) / len(values), 1)
                row[zone] = avg
                all_gct_values.extend(values)
            else:
                row[zone] = None
        
        result.append(row)
    
    overall_avg = round(sum(all_gct_values) / len(all_gct_values), 1) if all_gct_values else None
    
    return {
        "monthly": result,
        "summary": {
            "total_runs": len(docs),
            "avg_gct": overall_avg,
            "zones": {
                "pace_530": {"label": "≥ 5:30/km", "color": "#3B82F6"},
                "pace_500": {"label": "5:00-5:29/km", "color": "#10B981"},
                "pace_445": {"label": "< 4:45/km", "color": "#F43F5E"},
            }
        }
    }
