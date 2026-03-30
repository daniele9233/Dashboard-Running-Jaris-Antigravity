"""
Altrove Backend – FastAPI server for running training dashboard.
Handles Strava OAuth, run sync, profile, training plan, analytics, etc.
"""

import os, math, hashlib, datetime as dt
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse

import httpx
import motor.motor_asyncio as motor

load_dotenv()

# ── ENV ──────────────────────────────────────────────────────────────────────
MONGO_URL          = os.environ.get("MONGO_URL", "")
DB_NAME            = os.environ.get("DB_NAME", "DANIDB")
STRAVA_CLIENT_ID   = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
FRONTEND_URL       = os.environ.get("FRONTEND_URL", "http://localhost:5173")

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

            run_doc = {
                "athlete_id": athlete_id,
                "strava_id": strava_id,
                "date": date_str,
                "distance_km": distance_km,
                "duration_minutes": duration_min,
                "avg_pace": avg_pace,
                "avg_hr": round(avg_hr) if avg_hr else None,
                "max_hr": round(max_hr) if max_hr else None,
                "avg_hr_pct": round((avg_hr / max_hr_profile) * 100) if avg_hr else None,
                "max_hr_pct": round((max_hr / max_hr_profile) * 100) if max_hr else None,
                "run_type": _classify_run({"distance_km": distance_km, "avg_pace": avg_pace}),
                "notes": f"Importata da Strava: {act.get('name', '')}",
                "location": act.get("location_city") or act.get("timezone", "").split("/")[-1],
                "avg_cadence": act.get("average_cadence"),
                "elevation_gain": round(act.get("total_elevation_gain", 0), 1),
                "splits": splits,
                "streams": streams_data,  # per-point data: d, hr, cad, alt, pace, ll
                "polyline": full_polyline or summary_polyline,
                "start_latlng": start_latlng,
                "plan_feedback": None,
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


def _assess_feasibility(current_vdot: float, target_vdot: float, weeks: int) -> dict:
    """Assess if the VDOT gap is achievable in the given weeks.

    Research basis (Daniels 2013, Pfitzinger 2015):
    - Well-trained amateur: ~0.3–0.8 VDOT / mesocycle (3–4 weeks)
    - Beginner with room to grow: up to 1.0 VDOT / mesocycle
    - Diminishing returns above VDOT ~50
    - Realistic maximum: ~0.25 VDOT / week sustained over 12–24 weeks
    """
    gap = target_vdot - current_vdot
    mesocycles = weeks / 3.5  # average mesocycle length

    # Conservative estimate: 0.5 VDOT per mesocycle average
    max_gain_conservative = mesocycles * 0.5
    # Optimistic: 0.8 per mesocycle
    max_gain_optimistic = mesocycles * 0.8

    if gap <= 0:
        return {"feasible": True, "difficulty": "already_there",
                "message": f"Il tuo VDOT attuale ({current_vdot}) è già sufficiente per l'obiettivo ({target_vdot}). Piano di mantenimento.",
                "confidence_pct": 95}
    elif gap <= max_gain_conservative:
        return {"feasible": True, "difficulty": "realistic",
                "message": f"Obiettivo realistico: +{gap:.1f} VDOT in {weeks} settimane ({gap/mesocycles:.1f}/mesociclo). Progressione standard Daniels.",
                "confidence_pct": 80}
    elif gap <= max_gain_optimistic:
        return {"feasible": True, "difficulty": "challenging",
                "message": f"Obiettivo ambizioso: +{gap:.1f} VDOT in {weeks} settimane ({gap/mesocycles:.1f}/mesociclo). Richiede costanza totale.",
                "confidence_pct": 55}
    else:
        suggested_weeks = int(math.ceil(gap / 0.5 * 3.5))
        return {"feasible": False, "difficulty": "unrealistic",
                "message": f"Gap troppo alto: +{gap:.1f} VDOT in {weeks} sett. Servirebbero ~{suggested_weeks} settimane. Obiettivo ricalibrato.",
                "confidence_pct": 20, "suggested_weeks": suggested_weeks}


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
            sessions.append({
                "day": day_names[day_offset],
                "date": session_date.isoformat(),
                "type": "rest",
                "title": "Riposo",
                "description": "Giorno di riposo. Recupero attivo: stretching, foam rolling o camminata.",
                "target_distance_km": 0,
                "target_pace": None,
                "target_duration_min": None,
                "completed": False,
                "run_id": None,
            })
            continue

        dist_km = round(week_km * dist_map[day_offset], 1)

        if day_offset == 1:  # Tuesday = quality session
            s_type, title, desc, pace = _tp_quality_session(phase, goal, dist_km, paces, week_vdot)
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
        raw_phases = [
            ("Base Aerobica", 0.30), ("Intensità", 0.40),
            ("Taper", 0.20), ("Gara", 0.10),
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
    """Generate a goal-driven training plan.

    Required: goal_race, weeks_to_race, target_time (mm:ss or h:mm:ss).
    The plan is built around the VDOT gap between current fitness and goal.
    Each week has its own VDOT target and Daniels paces.
    """
    body = await request.json()
    goal_race = body.get("goal_race", "Half Marathon")
    weeks_to_race = int(body.get("weeks_to_race", 16))
    target_time_str = str(body.get("target_time", ""))

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    profile = await db.profile.find_one(q)
    runs = await db.runs.find(q).sort("date", -1).to_list(500)

    max_hr = int((profile or {}).get("max_hr", 190))
    defaults_km = {"5K": 40.0, "10K": 50.0, "Half Marathon": 60.0, "Marathon": 70.0}
    raw_max_km = (profile or {}).get("max_weekly_km")
    max_weekly_km = float(raw_max_km) if raw_max_km else defaults_km.get(goal_race, 55.0)

    # ── Current VDOT from real runs ──────────────────────────────────────────
    current_vdot = _calc_vdot(runs, max_hr)
    if not current_vdot:
        # Fallback estimate from recent run paces
        current_vdot = 30.0  # conservative beginner estimate

    # ── Target VDOT from goal time ───────────────────────────────────────────
    dist_km = RACE_DISTANCES.get(goal_race, 5.0)
    target_time_min = _parse_time_str(target_time_str)

    if target_time_min and target_time_min > 0:
        target_vdot = _time_to_vdot(dist_km, target_time_min)
        if not target_vdot:
            target_vdot = current_vdot  # fallback
    else:
        # No target time → maintain + 2 VDOT improvement
        target_vdot = current_vdot + 2.0

    target_vdot = round(min(target_vdot, 75.0), 2)  # cap at elite level

    # ── Feasibility assessment ───────────────────────────────────────────────
    feasibility = _assess_feasibility(current_vdot, target_vdot, weeks_to_race)

    # If unrealistic, cap target VDOT to max achievable
    if not feasibility["feasible"]:
        mesocycles = weeks_to_race / 3.5
        max_achievable = current_vdot + mesocycles * 0.5
        target_vdot = round(min(target_vdot, max_achievable), 2)
        # Recalculate the adjusted race prediction
        adjusted_time = _vdot_to_race_time(target_vdot, dist_km)
        feasibility["adjusted_target_vdot"] = target_vdot
        feasibility["adjusted_time"] = adjusted_time

    # ── Generate the plan ────────────────────────────────────────────────────
    weeks = _generate_plan_weeks(
        goal_race, weeks_to_race, max_weekly_km,
        current_vdot, target_vdot, athlete_id, target_time_str,
    )

    await db.training_plan.delete_many(q)
    if weeks:
        await db.training_plan.insert_many(weeks)

    # Store goal metadata on profile
    await db.profile.update_one(q, {"$set": {
        "plan_goal_race": goal_race,
        "plan_target_time": target_time_str,
        "plan_target_vdot": target_vdot,
        "plan_current_vdot": current_vdot,
        "plan_weeks": weeks_to_race,
    }})

    return {
        "ok": True,
        "weeks_generated": len(weeks),
        "current_vdot": current_vdot,
        "target_vdot": target_vdot,
        "feasibility": feasibility,
        "race_predictions": _predict_race(target_vdot),
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

def _calc_vdot(runs: list, max_hr: int = 190, weeks_window: int = 8) -> Optional[float]:
    """Estimate VDOT from best validated run using Daniels' formula (Jack Daniels 2003).

    Uses a recency-weighted window to reflect current fitness, not historical peaks.

    Strategy (3 passes — always returns the most recent valid signal):
    1. Last `weeks_window` weeks (default 8): captures current form post-injury/break
    2. Last 16 weeks fallback: if no valid runs in window
    3. All-time fallback: last resort only

    Validation rules:
    - Distance 4–21 km
    - Pace 2:30–9:00/km (150–540 sec/km)
    - HR >= 85% of max_hr (if available)
    - Duration >= 5 min
    - Cap VDOT at 55 (amateur runner)
    """
    import datetime as _dt

    def _best_from(run_list: list) -> Optional[float]:
        best = None
        for r in run_list:
            dist = r.get("distance_km", 0)
            if dist < 4 or dist > 21:
                continue
            pace_str = r.get("avg_pace", "")
            if not pace_str or ":" not in pace_str:
                continue
            try:
                parts = pace_str.split(":")
                pace_s = int(parts[0]) * 60 + int(parts[1])
            except (ValueError, IndexError):
                continue
            if pace_s < 150 or pace_s > 540:
                continue
            duration_min = r.get("duration_minutes", 0) or 0
            if duration_min < 5:
                continue
            avg_hr = r.get("avg_hr")
            if avg_hr and avg_hr < 0.85 * max_hr:
                continue
            speed_mpm = 60000 / pace_s
            vo2 = -4.60 + 0.182258 * speed_mpm + 0.000104 * speed_mpm ** 2
            pct_max = 0.8 + 0.1894393 * math.exp(-0.012778 * duration_min) + 0.2989558 * math.exp(-0.1932605 * duration_min)
            if pct_max > 0:
                vdot = vo2 / pct_max
                if best is None or vdot > best:
                    best = vdot
        return round(min(best, 55.0), 1) if best else None

    cutoff_primary = (_dt.date.today() - _dt.timedelta(weeks=weeks_window)).isoformat()
    cutoff_extended = (_dt.date.today() - _dt.timedelta(weeks=16)).isoformat()

    # Pass 1 — last `weeks_window` weeks (current fitness)
    recent = [r for r in runs if r.get("date", "") >= cutoff_primary]
    result = _best_from(recent)
    if result:
        return result

    # Pass 2 — last 16 weeks (medium-term)
    medium = [r for r in runs if r.get("date", "") >= cutoff_extended]
    result = _best_from(medium)
    if result:
        return result

    # Pass 3 — all-time fallback (should rarely trigger)
    return _best_from(runs)


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


@app.get("/api/analytics")
async def get_analytics():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    runs = await db.runs.find(q).sort("date", -1).to_list(500)
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
    runs = await db.runs.find(q).sort("date", -1).to_list(500)
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
#  RUNNER DNA (AI COACH LOCAL)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/runner-dna")
async def get_runner_dna():
    """Generates a highly-detailed Runner DNA profile acting as an Olympic Coach."""
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    
    # Fetch Data
    runs = await db.runs.find(q).sort("date", 1).to_list(1000)
    profile = await db.profile.find_one(q) or {}
    ff_docs = await db.fitness_freshness.find(q).sort("date", -1).to_list(30)
    
    if len(runs) < 5:
        return JSONResponse({"error": "not_enough_data"}, status_code=400)

    # Base Metrics
    total_runs = len(runs)
    total_km = sum(r.get("distance_km", 0) for r in runs)
    avg_km_per_run = total_km / total_runs
    max_hr = profile.get("max_hr", 190)
    
    # 1. Statistiche Aggregate
    hr_runs = [r for r in runs if r.get("avg_hr") and r.get("avg_hr", 0) > 0]
    cad_runs = [r for r in runs if r.get("avg_cadence") and r.get("avg_cadence", 0) > 0]
    
    avg_hr_all = sum(r["avg_hr"] for r in hr_runs) / len(hr_runs) if hr_runs else 0
    avg_cad_all = (sum(r["avg_cadence"] for r in cad_runs) / len(cad_runs)) * 2 if cad_runs else 0
    
    # Calcola il passo medio in sec/km
    total_sec = sum(r.get("duration_minutes", 0) * 60 for r in runs)
    avg_pace_s = total_sec / total_km if total_km > 0 else 0
    
    # Zone cardiache (time-based)
    zones = {"z1": 0, "z2": 0, "z3": 0, "z4": 0, "z5": 0}
    for r in hr_runs:
        pct = (r["avg_hr"] / max_hr) * 100
        dur = r.get("duration_minutes", 0)
        if pct < 65: zones["z1"] += dur
        elif pct < 77: zones["z2"] += dur
        elif pct < 84: zones["z3"] += dur
        elif pct < 91: zones["z4"] += dur
        else: zones["z5"] += dur
        
    tot_z_dur = sum(zones.values()) or 1
    zone_dist = {k: round(v / tot_z_dur * 100) for k, v in zones.items()}
    
    # 2. Profilazione Runner
    vdot_current = _calc_vdot(runs, max_hr, weeks_window=8) or 30.0
    
    # Livello
    if vdot_current < 38: level = "Principiante"
    elif vdot_current < 48: level = "Intermedio"
    elif vdot_current < 55: level = "Avanzato"
    else: level = "Elite"
    
    # Tipo (Endurance vs Speed)
    # Contiamo quante corse lunghe (>15km) vs ripetute (passo molto più veloce della media)
    long_runs = sum(1 for r in runs if r.get("distance_km", 0) >= 15)
    speed_runs = sum(1 for r in runs if r.get("run_type") == "intervals")
    
    if long_runs > speed_runs * 1.5: r_type = "Endurance Specialist"
    elif speed_runs > long_runs * 1.5: r_type = "Speed/Power Runner"
    else: r_type = "Balanced Runner"
    
    # 3. Consistenza
    from datetime import date
    try:
        first_run = date.fromisoformat(runs[0]["date"][:10])
        last_run = date.fromisoformat(runs[-1]["date"][:10])
        weeks_active = max(1, (last_run - first_run).days / 7)
        freq = total_runs / weeks_active
    except Exception:
        freq = 0
        
    consistency_score = min(100, (freq / 4) * 100) # 4 runs/week = 100%
    if consistency_score > 80: cons_label = "Altamente Costante (Ottima disciplina)"
    elif consistency_score > 50: cons_label = "Regolare (Buon ritmo, ma con margini)"
    else: cons_label = "Incostante (Rischio de-training)"
    
    # 4. Performance Trend (ultime 12 vs prime 12 se disponibili)
    perf_trend = "Stabile"
    if len(runs) >= 20:
        early_vdot = _calc_vdot(runs[:10], max_hr, weeks_window=999) or vdot_current
        recent_vdot = _calc_vdot(runs[-10:], max_hr, weeks_window=999) or vdot_current
        diff = recent_vdot - early_vdot
        if diff > 1.0: perf_trend = f"In Forte Crescita (+{round(diff,1)} VDOT)"
        elif diff > 0.2: perf_trend = "Lieve Progressione"
        elif diff < -1.0: perf_trend = "In Regressione (Possibile overtraining o stop)"
    
    # 5. Efficienza (Pace vs HR)
    eff_score = 0
    if avg_hr_all > 0 and avg_pace_s > 0:
        # Metrica empirica: m/min per battito. Esempio 5:00/km (200m/min) a 150 bpm = 1.33 
        speed_mpm = 60000 / avg_pace_s
        eff_index = speed_mpm / avg_hr_all
        if eff_index > 1.6: eff_score = 95
        elif eff_index > 1.3: eff_score = 80
        elif eff_index > 1.0: eff_score = 60
        else: eff_score = 40
        
    # 6. Stato Attuale (da Fitness/Freshness se disponibile)
    current_form = "Neutro"
    ctl = 0
    if ff_docs:
        tsb = ff_docs[0].get("tsb", 0)
        ctl = ff_docs[0].get("ctl", 0)
        if tsb > 10: current_form = "Picco di Forma (Pronto per la gara)"
        elif tsb > -5: current_form = "Fase di Costruzione Produttiva"
        elif tsb > -15: current_form = "Affaticamento Funzionale (Heavy Block)"
        else: current_form = "Rischio Sovrallenamento (Necessario Scarico)"
    
    # 7. Potenziale
    # Stimiamo il VDOT massimale biologico basato su età (se presente) e VDOT attuale
    age = profile.get("age", 30) or 30
    age_factor = max(0, (age - 35) * 0.5) # VDOT scende leggermente dopo i 35
    potential_vdot = min(65.0, vdot_current + (100 - consistency_score)/10 * 0.5 + (100 - eff_score)/10 * 0.3)
    potential_vdot = round(potential_vdot - age_factor/10, 1)
    
    race_preds = _predict_race(potential_vdot)
    ideal_distance = "Mezza Maratona" if r_type == "Endurance Specialist" else "5K/10K"
    if r_type == "Balanced Runner" and total_km > 1000: ideal_distance = "Maratona"
    
    # Output Dictionary
    dna = {
        "profile": {
            "level": level,
            "type": r_type,
            "vdot_current": round(vdot_current, 1)
        },
        "stats": {
            "avg_pace": _format_pace(1000 / max(1, avg_pace_s)),
            "avg_hr": round(avg_hr_all),
            "avg_cadence": round(avg_cad_all),
            "zone_distribution": zone_dist
        },
        "performance": {
            "trend_status": perf_trend,
            "total_km": round(total_km, 1)
        },
        "consistency": {
            "score_pct": int(consistency_score),
            "label": cons_label,
            "runs_per_week": round(freq, 1)
        },
        "efficiency": {
            "score_pct": int(eff_score),
            "label": "Eccellente" if eff_score > 85 else "Buona" if eff_score > 70 else "Migliorabile"
        },
        "current_state": {
            "form_label": current_form,
            "fitness_ctl": round(ctl, 1)
        },
        "potential": {
            "vdot_ceiling": potential_vdot,
            "ideal_distance": ideal_distance,
            "predictions": race_preds
        }
    }
    
    return {"dna": dna}
