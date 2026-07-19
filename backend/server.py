"""
Altrove Backend – FastAPI server for running training dashboard.
Handles Strava OAuth, run sync, profile, training plan, analytics, etc.
"""

import os, math, hashlib, datetime as dt, asyncio, re
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse

# Rate limiting — opzionale: se slowapi non installato il server parte comunque
# senza limiti (degradazione graceful). Per attivare: pip install slowapi
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _SLOWAPI_AVAILABLE = True
except ImportError:
    _SLOWAPI_AVAILABLE = False
    Limiter = None  # type: ignore
    get_remote_address = None  # type: ignore
    RateLimitExceeded = None  # type: ignore
    _rate_limit_exceeded_handler = None  # type: ignore

import httpx
import json
from anthropic import AsyncAnthropic
import motor.motor_asyncio as motor
import fitdecode
import io
import base64

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

PUBLIC_FRONTEND_URL = "https://dani-frontend-y63x.onrender.com"
PUBLIC_BACKEND_URL = "https://dani-backend-ea0s.onrender.com"


def _is_render_runtime() -> bool:
    return any(os.environ.get(name) for name in ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_HOSTNAME", "RENDER_GIT_COMMIT"))


def _normalise_frontend_url(raw_url: Optional[str], is_render: Optional[bool] = None) -> str:
    raw = (raw_url or "").strip().rstrip("/")
    render_runtime = _is_render_runtime() if is_render is None else is_render
    if not raw:
        return PUBLIC_FRONTEND_URL if render_runtime else "http://localhost:5173"
    if render_runtime and ("localhost" in raw or "127.0.0.1" in raw):
        return PUBLIC_FRONTEND_URL
    return raw


def _normalise_backend_url(raw_url: Optional[str], is_render: Optional[bool] = None) -> str:
    raw = (raw_url or "").strip().rstrip("/")
    render_runtime = _is_render_runtime() if is_render is None else is_render
    if not raw:
        return PUBLIC_BACKEND_URL if render_runtime else "http://localhost:8000"
    if render_runtime and ("localhost" in raw or "127.0.0.1" in raw):
        return PUBLIC_BACKEND_URL
    return raw

# ── ENV ──────────────────────────────────────────────────────────────────────
MONGO_URL          = os.environ.get("MONGO_URL", "")
DB_NAME            = os.environ.get("DB_NAME", "DANIDB")
STRAVA_CLIENT_ID   = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
FRONTEND_URL       = _normalise_frontend_url(os.environ.get("FRONTEND_URL"))
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY     = os.environ.get("GEMINI_API_KEY", "")
JARVIS_GEMINI_KEY  = os.environ.get("JARVIS_GEMINI_KEY", "") or GEMINI_API_KEY
FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
GARMIN_EMAIL       = os.environ.get("GARMIN_EMAIL", "")
GARMIN_PASSWORD    = os.environ.get("GARMIN_PASSWORD", "")
APP_VERSION        = os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_COMMIT") or os.environ.get("COMMIT_SHA") or "local"
ANALYTICS_SCHEMA_VERSION = "pro-v11-2026-05-02"
RUNNER_DNA_SCHEMA_VERSION = "runner-dna-v6-2026-06-10"
GARMIN_CSV_REPAIR_VERSION = "garmin-csv-repair-v2-2026-04-22"

VDOT_RECENCY_WEIGHT_30D = 0.70
VDOT_RECENCY_DECAY_LAMBDA = -math.log(VDOT_RECENCY_WEIGHT_30D) / 30.0
VDOT_RECENT_ANCHOR_DAYS = 21  # 3 weeks: standard "current capacity" window per Daniels RF4 p.71

# Build the callback URL from the current host (set via Render env or default)
BACKEND_URL        = _normalise_backend_url(os.environ.get("BACKEND_URL"))
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
    await _ensure_indexes()
    yield
    client.close()

app = FastAPI(title="Altrove", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Env var ALLOWED_ORIGINS = "https://foo.com,https://bar.com" (comma-separated).
# Default: dev (localhost) + prod (Render frontend) — no wildcard.
# allow_origins=["*"] + allow_credentials=True è invalid per spec CORS:
# i browser rifiutano comunque le credenziali. La whitelist è obbligatoria.
_DEFAULT_ORIGINS = (
    "http://localhost:3000,http://localhost:3001,http://localhost:5173,"
    "https://dani-frontend-ea0s.onrender.com,"
    "https://dani-frontend-y63x.onrender.com"
)
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
# Limiter globale a 120 req/min per IP. I decorator @limiter.limit("...") sui
# singoli endpoint sotto stringono dove serve (AI / sync). Se slowapi non è
# installato (dev senza dipendenze), tutti i decorator diventano no-op.
if _SLOWAPI_AVAILABLE:
    limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
else:
    # Stub no-op così @limiter.limit(...) funziona anche senza slowapi.
    class _NoopLimiter:
        def limit(self, *_args, **_kwargs):
            def deco(f):
                return f
            return deco
    limiter = _NoopLimiter()  # type: ignore

# ── HELPERS ──────────────────────────────────────────────────────────────────

def oid(doc):
    """Convert MongoDB _id to string 'id' field."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

def oids(docs):
    return [oid(d) for d in docs]


async def _get_active_strava_token() -> Optional[dict]:
    tok = await db.strava_tokens.find_one({"active": True}, sort=[("_id", -1)])
    if tok:
        return tok
    return await db.strava_tokens.find_one(sort=[("_id", -1)])


async def _get_athlete_id() -> Optional[int]:
    """Get the current athlete_id from the active Strava token."""
    tok = await _get_active_strava_token()
    return tok.get("athlete_id") if tok else None


async def _invalidate_analytics_cache(athlete_id: Optional[int]):
    if athlete_id:
        await db.analytics_cache.delete_many({"athlete_id": athlete_id})


async def _invalidate_runner_dna_cache(athlete_id: Optional[int]):
    if athlete_id:
        await db.runner_dna_cache.delete_many({"athlete_id": athlete_id})


async def _ensure_indexes():
    """Create non-destructive indexes used by sync + analytics."""
    try:
        await db.runs.create_index([("athlete_id", 1), ("date", -1)])
        await db.runs.create_index([("athlete_id", 1), ("is_treadmill", 1), ("has_gps", 1)])
        await db.runs.create_index("strava_id", unique=True, sparse=True)
        await db.garmin_csv_data.create_index([("athlete_id", 1), ("fingerprint", 1)], unique=True, sparse=True)
        await db.garmin_csv_data.create_index([("athlete_id", 1), ("date", -1)])
        await db.garmin_csv_data.create_index([("athlete_id", 1), ("matched_run_id", 1)])
        await db.analytics_cache.create_index([("athlete_id", 1), ("cache_key", 1)], unique=True, sparse=True)
        await db.runner_dna_cache.create_index("athlete_id", unique=True, sparse=True)
    except Exception as e:
        print(f"[indexes] non-fatal index setup error: {e}")


def _run_has_gps(run: dict) -> bool:
    """Return True only when a run has real GPS evidence."""
    if run.get("polyline"):
        return True
    start = run.get("start_latlng")
    if isinstance(start, list) and len(start) == 2 and start[0] is not None and start[1] is not None:
        return True
    streams = run.get("streams") or []
    if isinstance(streams, list):
        return any(pt.get("ll") for pt in streams if isinstance(pt, dict))
    return False


def valid_outdoor_runs_query(athlete_id=None, min_distance_km: float = 0) -> dict:
    """Mongo query for analytics-valid outdoor GPS runs."""
    q: dict = {"is_treadmill": {"$ne": True}}
    if athlete_id:
        q["athlete_id"] = athlete_id
    if min_distance_km > 0:
        q["distance_km"] = {"$gte": min_distance_km}
    q["$or"] = [
        {"has_gps": True},
        {"polyline": {"$nin": [None, ""]}},
        {"start_latlng.0": {"$exists": True}},
        {"streams.ll": {"$exists": True}},
    ]
    return q


FITNESS_CTL_DAYS = 42
FITNESS_ATL_DAYS = 7
FITNESS_ALPHA_CTL = 2.0 / (FITNESS_CTL_DAYS + 1)
FITNESS_ALPHA_ATL = 2.0 / (FITNESS_ATL_DAYS + 1)


def _parse_datetime(value) -> Optional[dt.datetime]:
    if isinstance(value, dt.datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, str):
        try:
            return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _project_fitness_freshness_doc(doc: Optional[dict], as_of: Optional[dt.datetime] = None) -> Optional[dict]:
    """Project latest CTL/ATL/TSB forward with zero training load since last computation."""
    if not doc:
        return doc

    now = as_of or dt.datetime.now()
    projected = dict(doc)
    last_calc = _parse_datetime(projected.get("computed_at"))
    elapsed_days = 0.0

    if last_calc:
        elapsed_days = max(0.0, (now - last_calc).total_seconds() / 86400.0)
    else:
        try:
            doc_date = dt.date.fromisoformat(str(projected.get("date", ""))[:10])
            elapsed_days = max(0.0, float((now.date() - doc_date).days))
        except ValueError:
            elapsed_days = 0.0

    if elapsed_days > 0:
        ctl = float(projected.get("ctl", 0) or 0) * ((1 - FITNESS_ALPHA_CTL) ** elapsed_days)
        atl = float(projected.get("atl", 0) or 0) * ((1 - FITNESS_ALPHA_ATL) ** elapsed_days)
        projected["ctl"] = round(ctl, 2)
        projected["atl"] = round(atl, 2)
        projected["tsb"] = round(ctl - atl, 2)
        projected["projected"] = True

    projected["as_of"] = now.isoformat(timespec="seconds")
    return projected


async def _ensure_fitness_freshness_current(athlete_id: Optional[int]) -> None:
    """Refresh persisted fitness/freshness if the saved series does not reach today."""
    q = {"athlete_id": athlete_id} if athlete_id else {}
    latest = await db.fitness_freshness.find_one(q, sort=[("date", -1)])
    today = dt.date.today().isoformat()
    if latest and str(latest.get("date", ""))[:10] >= today:
        return

    profile_doc = await db.profile.find_one(q)
    max_hr_p = int(profile_doc.get("max_hr", 190)) if profile_doc else 190
    resting_hr_p = int(profile_doc.get("resting_hr", 50)) if profile_doc else 50
    await _compute_fitness_freshness(athlete_id, max_hr_p, resting_hr_p)
    await _invalidate_analytics_cache(athlete_id)
    await _invalidate_runner_dna_cache(athlete_id)


def fast_valid_outdoor_runs_query(athlete_id=None, min_distance_km: float = 0) -> dict:
    """Lean analytics-valid query that avoids scanning heavy streams arrays."""
    q: dict = {"is_treadmill": {"$ne": True}}
    if athlete_id:
        q["athlete_id"] = athlete_id
    if min_distance_km > 0:
        q["distance_km"] = {"$gte": min_distance_km}
    q["$or"] = [
        {"has_gps": True},
        {"polyline": {"$nin": [None, ""]}},
        {"start_latlng.0": {"$exists": True}},
    ]
    return q


def analytics_run_projection(include_splits: bool = False) -> dict:
    """Fields needed by pro analytics without large per-point streams payloads."""
    projection = {
        "athlete_id": 1,
        "strava_id": 1,
        "name": 1,
        "date": 1,
        "distance_km": 1,
        "duration_minutes": 1,
        "avg_pace": 1,
        "avg_hr": 1,
        "max_hr": 1,
        "run_type": 1,
        "notes": 1,
        "avg_cadence": 1,
        "avg_cadence_spm": 1,
        "elevation_gain": 1,
        "is_treadmill": 1,
        "has_gps": 1,
        "polyline": 1,
        "start_latlng": 1,
        "weather": 1,
        "temperature": 1,
        "apparent_temperature": 1,
        "humidity": 1,
        "wind_speed": 1,
        "temp_min_c": 1,
        "temp_max_c": 1,
        "avg_ground_contact_time": 1,
        "avg_vertical_oscillation": 1,
        "avg_vertical_ratio": 1,
        "avg_stride_length": 1,
        "biomechanics": 1,
        "garmin_csv_id": 1,
    }
    if include_splits:
        projection["splits"] = 1
    return projection


def garmin_csv_projection() -> dict:
    """Lean Garmin CSV fields needed to enrich biomechanics charts."""
    return {
        "date": 1,
        "titolo": 1,
        "distance_km": 1,
        "duration_minutes": 1,
        "avg_pace": 1,
        "avg_pace_sec": 1,
        "avg_hr": 1,
        "avg_ground_contact_time_ms": 1,
        "avg_vertical_oscillation_cm": 1,
        "avg_vertical_ratio_pct": 1,
        "avg_stride_length_m": 1,
        "avg_cadence_spm": 1,
        "max_cadence_spm": 1,
        "matched_run_id": 1,
        "match_status": 1,
        "linked_at": 1,
        "imported_at": 1,
        "inactive_duplicate": 1,
    }


async def _analytics_run_diagnostics(athlete_id: int, range_runs_count: int = 0) -> dict:
    base = {"athlete_id": athlete_id}
    outdoor = {"athlete_id": athlete_id, "is_treadmill": {"$ne": True}}
    total_runs = await db.runs.count_documents(base)
    excluded_treadmill = await db.runs.count_documents({"athlete_id": athlete_id, "is_treadmill": True})
    valid_outdoor = await db.runs.count_documents(fast_valid_outdoor_runs_query(athlete_id))
    outdoor_total = await db.runs.count_documents(outdoor)
    excluded_missing_gps = max(0, outdoor_total - valid_outdoor)
    return {
        "schema_version": ANALYTICS_SCHEMA_VERSION,
        "total_runs": total_runs,
        "valid_outdoor_runs": valid_outdoor,
        "range_valid_outdoor_runs": range_runs_count,
        "excluded_treadmill": excluded_treadmill,
        "excluded_missing_gps": excluded_missing_gps,
    }


def _normalise_run_quality_fields(run_doc: dict) -> dict:
    """Add derived data-quality and biomechanics fields without removing legacy fields."""
    has_gps = _run_has_gps(run_doc)
    reasons = []
    if run_doc.get("is_treadmill"):
        reasons.append("treadmill")
    if not has_gps:
        reasons.append("missing_gps")

    run_doc["has_gps"] = has_gps
    run_doc["gps_quality"] = "gps" if has_gps else "none"
    run_doc["data_quality"] = {
        **(run_doc.get("data_quality") or {}),
        "excluded_from_analytics_reason": reasons[0] if reasons else None,
        "excluded_from_analytics_reasons": reasons,
    }

    avg_cad = run_doc.get("avg_cadence")
    avg_cad_spm = _cadence_spm_from_run(run_doc) or _normalise_strava_cadence_spm(avg_cad)
    if avg_cad_spm is not None:
        run_doc["avg_cadence_spm"] = avg_cad_spm

    biomech = dict(run_doc.get("biomechanics") or {})
    fallback_bio = {
        "avg_ground_contact_time_ms": run_doc.get("avg_ground_contact_time"),
        "avg_vertical_oscillation_cm": run_doc.get("avg_vertical_oscillation"),
        "avg_vertical_ratio_pct": run_doc.get("avg_vertical_ratio"),
        "avg_stride_length_m": run_doc.get("avg_stride_length"),
        "avg_cadence_spm": avg_cad_spm,
    }
    for key, value in fallback_bio.items():
        if biomech.get(key) is None and value is not None:
            biomech[key] = value
    biomech["source"] = biomech.get("source") or "strava_fit"
    if "garmin_csv_id" not in biomech:
        biomech["garmin_csv_id"] = None
    run_doc["biomechanics"] = biomech
    return run_doc

# ── SSE EVENT BUS ─────────────────────────────────────────────────────────────
# Pub/sub in-process per server-push notifications (single-tenant).
# Quando arriverà l'auth (#1 deferred) → estendere con scope per user_id.
#
# Eventi standard:
#   - { "type": "sync_started",  "source": "strava"|"garmin", "ts": ... }
#   - { "type": "sync_complete", "source": "...", "count": N, "ts": ... }
#   - { "type": "sync_error",    "source": "...", "error": "...", "ts": ... }
#   - { "type": "training_adapted", "ts": ... }
#   - { "type": "ping", "ts": ... }   (keepalive ogni 30s)

_event_subscribers: list[asyncio.Queue] = []


async def publish_event(payload: dict):
    """Push un evento a tutti i subscriber connessi. Drop silenzioso se queue piena."""
    payload.setdefault("ts", dt.datetime.utcnow().isoformat() + "Z")
    dead = []
    for q in _event_subscribers:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            # Subscriber lento → marca per rimozione (evita memory leak)
            dead.append(q)
    for q in dead:
        try:
            _event_subscribers.remove(q)
        except ValueError:
            pass


@app.get("/api/events/stream")
async def event_stream(request: Request):
    """
    Server-Sent Events endpoint.

    Frontend usa `new EventSource('/api/events/stream')` e ascolta:
      es.onmessage = (e) => { const data = JSON.parse(e.data); ... }

    Connessione tenuta aperta. Server invia ping ogni 30s per evitare
    timeout proxy (Render/CloudFlare hanno idle timeout 60-100s).
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _event_subscribers.append(queue)

    async def gen():
        try:
            # Hello iniziale così client sa che la connessione è viva
            yield f"data: {json.dumps({'type': 'connected', 'ts': dt.datetime.utcnow().isoformat() + 'Z'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait con timeout = keepalive ping
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive: SSE comment è ignorato dal client ma tiene la connessione viva
                    yield ": ping\n\n"
        finally:
            try:
                _event_subscribers.remove(queue)
            except ValueError:
                pass

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disabilita buffering nginx/Render
        },
    )


# ── ROUTERS ──────────────────────────────────────────────────────────────────
# Pattern: estrazione progressiva endpoint da questo file in `backend/routers/`.
# Round 5 ha estratto health/version come pattern. Vedi REPORT-TECNICO sezione 15.
#
# Import layout-resilient: Render usa `rootDir: backend` (CWD=backend/), dev locale
# può usare `python -m backend.server` (CWD=root). Try entrambi.
try:
    from routers import health as _health_router  # CWD=backend/ (Render prod)
    from routers import profile as _profile_router
    from routers import runs as _runs_router
except ImportError:  # pragma: no cover
    from backend.routers import health as _health_router  # type: ignore
    from backend.routers import profile as _profile_router  # type: ignore
    from backend.routers import runs as _runs_router  # type: ignore

app.include_router(_health_router.router)
app.include_router(_profile_router.router)
app.include_router(_runs_router.router)

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


@app.get("/api/strava/status")
async def strava_status():
    tokens = await _get_active_strava_token()
    if not tokens:
        return {"connected": False, "athlete_id": None, "name": None, "connections": []}

    athlete_id = tokens.get("athlete_id")
    profile = await db.profile.find_one({"athlete_id": athlete_id}) if athlete_id else None
    connections = await _strava_connections_payload()
    return {
        "connected": True,
        "athlete_id": athlete_id,
        "name": profile.get("name") if profile else None,
        "connections": connections,
    }


async def _strava_connections_payload() -> list[dict]:
    active_token = await _get_active_strava_token()
    active_athlete_id = active_token.get("athlete_id") if active_token else None
    tokens = await db.strava_tokens.find({}).sort([("active", -1), ("_id", -1)]).to_list(100)
    connections = []
    for token in tokens:
        athlete_id = token.get("athlete_id")
        profile = await db.profile.find_one({"athlete_id": athlete_id}) if athlete_id else None
        connections.append({
            "athlete_id": athlete_id,
            "name": profile.get("name") if profile else None,
            "profile_pic": profile.get("profile_pic") or profile.get("strava_profile_pic") if profile else None,
            "active": bool(token.get("active")) or athlete_id == active_athlete_id,
        })
    return connections


@app.get("/api/strava/connections")
async def strava_connections():
    active = await _get_active_strava_token()
    return {
        "active_athlete_id": active.get("athlete_id") if active else None,
        "connections": await _strava_connections_payload(),
    }


@app.patch("/api/strava/active-athlete")
async def strava_set_active_athlete(request: Request):
    body = await request.json()
    athlete_id = body.get("athlete_id")
    try:
        athlete_id = int(athlete_id)
    except (TypeError, ValueError):
        return JSONResponse({"error": "invalid_athlete_id"}, status_code=400)

    existing = await db.strava_tokens.find_one({"athlete_id": athlete_id})
    if not existing:
        return JSONResponse({"error": "not_found"}, status_code=404)

    await db.strava_tokens.update_many({}, {"$set": {"active": False}})
    await db.strava_tokens.update_one({"athlete_id": athlete_id}, {"$set": {"active": True}})
    await publish_event({"type": "active_athlete_changed", "source": "strava", "athlete_id": athlete_id})
    return {
        "ok": True,
        "active_athlete_id": athlete_id,
        "connections": await _strava_connections_payload(),
    }


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
        "active": True,
    }

    await db.strava_tokens.update_many({}, {"$set": {"active": False}})

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


@app.delete("/api/strava/connection")
async def strava_disconnect(
    athlete_id: Optional[int] = Query(None),
    force: bool = Query(False),
):
    tokens = await db.strava_tokens.find_one({"athlete_id": athlete_id}) if athlete_id else await _get_active_strava_token()
    if not tokens:
        connections = await _strava_connections_payload()
        active = await _get_active_strava_token()
        return {
            "ok": True,
            "revoked": False,
            "removed": False,
            "connected": bool(active),
            "connections": connections,
            "active_athlete_id": active.get("athlete_id") if active else None,
        }

    athlete_id = tokens.get("athlete_id")
    was_active = bool(tokens.get("active"))
    revoke_ok = False
    revoke_error = None

    try:
        tokens = await _refresh_token_if_needed(tokens)
        access_token = tokens.get("access_token")
        if access_token:
            async with httpx.AsyncClient(timeout=15.0) as http:
                resp = await http.post(
                    "https://www.strava.com/oauth/deauthorize",
                    params={"access_token": access_token},
                )
            revoke_ok = 200 <= resp.status_code < 300
            if not revoke_ok:
                revoke_error = resp.text
        else:
            revoke_error = "missing_access_token"
    except Exception as e:
        revoke_error = str(e)

    # Rimuovi il token locale SOLO se Strava ha revocato l'autorizzazione,
    # oppure se il chiamante forza esplicitamente (force=true). Altrimenti lo
    # slot atleta resterebbe occupato lato Strava senza più alcun token per
    # ritentare la deautorizzazione: meglio tenerlo tracciato e riprovabile.
    removed = False
    if revoke_ok or force:
        delete_q = {"athlete_id": athlete_id} if athlete_id else {"_id": tokens["_id"]}
        await db.strava_tokens.delete_many(delete_q)
        removed = True
        if was_active:
            next_token = await db.strava_tokens.find_one(sort=[("_id", -1)])
            if next_token:
                await db.strava_tokens.update_one({"_id": next_token["_id"]}, {"$set": {"active": True}})

    active = await _get_active_strava_token()

    return {
        "ok": True,
        "revoked": revoke_ok,
        "removed": removed,
        "forced": bool(force and not revoke_ok and removed),
        "connected": bool(active),
        "athlete_id": athlete_id,
        "active_athlete_id": active.get("athlete_id") if active else None,
        "connections": await _strava_connections_payload(),
        "revoke_error": revoke_error,
    }


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
        {"$set": {k: v for k, v in tokens.items() if k != "_id"}},
    )
    return tokens


# ═══════════════════════════════════════════════════════════════════════════════
#  BADGES — stato sblocchi (store single-tenant; la valutazione è lato frontend)
# ═══════════════════════════════════════════════════════════════════════════════

_BADGE_STATE_DEFAULT = {
    "activated": False,
    "activated_at": None,
    "baseline_run_ids": [],
    "baseline": {},
    "unlocked": {},
}


@app.get("/api/badges/state")
async def get_badge_state():
    """Stato badge: baseline d'attivazione + mappa degli sblocchi.
    Single-tenant: un solo documento. Il frontend calcola gli sblocchi e
    persiste qui (no storico: la baseline congela ciò che era già raggiunto)."""
    doc = await db.badge_state.find_one(sort=[("_id", -1)])
    if not doc:
        return dict(_BADGE_STATE_DEFAULT)
    doc.pop("_id", None)
    return {**_BADGE_STATE_DEFAULT, **doc}


@app.put("/api/badges/state")
async def put_badge_state(request: Request):
    body = await request.json()
    state = {
        "activated": bool(body.get("activated", True)),
        "activated_at": body.get("activated_at"),
        "baseline_run_ids": list(body.get("baseline_run_ids", [])),
        "baseline": dict(body.get("baseline", {})),
        "unlocked": dict(body.get("unlocked", {})),
    }
    existing = await db.badge_state.find_one(sort=[("_id", -1)])
    if existing:
        await db.badge_state.update_one({"_id": existing["_id"]}, {"$set": state})
    else:
        await db.badge_state.insert_one(state)
    return {"ok": True, **state}


async def _compute_fitness_freshness(athlete_id: str, max_hr_profile: int = 190, resting_hr: int = 50):
    """Calcola CTL/ATL/TSB da tutte le corse usando TRIMP metodo Lucia (2003).

    trimp = duration_min × hr_reserve × (0.64 × e^(1.92 × hr_reserve))
    CTL = EMA 42 giorni, ATL = EMA 7 giorni, TSB = CTL − ATL
    """
    from datetime import date, timedelta

    q = valid_outdoor_runs_query(athlete_id)
    delete_q = {"athlete_id": athlete_id} if athlete_id else {}
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
    ALPHA_CTL = FITNESS_ALPHA_CTL
    ALPHA_ATL = FITNESS_ALPHA_ATL

    first_date = date.fromisoformat(min(daily_trimp.keys()))
    today = date.today()
    computed_at = dt.datetime.now().isoformat(timespec="seconds")

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
        if trimp_today > 0 or current.weekday() == 0 or current == today:
            docs.append({
                "athlete_id": athlete_id,
                "date": ds,
                "trimp": round(trimp_today, 2),
                "ctl": round(ctl, 2),
                "atl": round(atl, 2),
                "tsb": round(tsb, 2),
                "computed_at": computed_at,
            })
        current += timedelta(days=1)

    # ── Scrivi in MongoDB (sostituisci tutto) ──────────────────────────────────
    await db.fitness_freshness.delete_many(delete_q)
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


# ─────────────────────────────────────────────────────────────────────────────
# STRUCTURAL WORKOUT DETECTION (ripetute / intervals)
# ─────────────────────────────────────────────────────────────────────────────
# Il classifier pace-only (`_classify_run`) NON distingue 3x1000 con recupero
# da un tempo continuo: entrambi hanno avg_pace ~4:35 → "tempo". La struttura a
# ripetute vive nella sequenza dei pace (lap o streams), non nella media.
#
# Strategia: separa i campioni/lap in due cluster di passo (lavoro vs recupero)
# con 2-means; se ci sono ≥2 blocchi di "lavoro" veloce intervallati da recupero
# nettamente più lento (sep = pace_rest/pace_work ≥ soglia) → `intervals`.
# Un singolo blocco veloce sostenuto → `tempo`/`threshold`. Calibrato su dati
# reali (3x1000 → sep 3.15; tempo continuo → sep ~1.1; easy → 0 blocchi).

def _two_means_split(vals: list, iters: int = 25) -> tuple[float, float]:
    """1-D 2-means su lista di pace (sec/km). Ritorna (centroide_veloce, centroide_lento)."""
    if not vals:
        return (0.0, 0.0)
    cf, cs = min(vals), max(vals)
    if cf == cs:
        return (cf, cs)
    for _ in range(iters):
        fast = [v for v in vals if abs(v - cf) <= abs(v - cs)]
        slow = [v for v in vals if abs(v - cf) > abs(v - cs)]
        if not fast or not slow:
            break
        nf, ns = sum(fast) / len(fast), sum(slow) / len(slow)
        if abs(nf - cf) < 0.1 and abs(ns - cs) < 0.1:
            cf, cs = nf, ns
            break
        cf, cs = nf, ns
    return (cf, cs)


def _median_filter(arr: list, w: int) -> list:
    n = len(arr)
    out = []
    for i in range(n):
        window = sorted(arr[max(0, i - w):min(n, i + w + 1)])
        out.append(window[len(window) // 2] if window else arr[i])
    return out


def _workout_structure_from_streams(streams: list, duration_minutes: float) -> Optional[dict]:
    """Rileva struttura (lavoro/recupero) dai per-point streams.

    Speed ∝ Δd per campione (dt uniforme = durata/n) → segmenta sui pace senza
    bisogno del campo `pace` (spesso assente). Ritorna dict con sep/n_work/cov
    o None se stream insufficiente.
    """
    st = streams or []
    dur_s = (duration_minutes or 0) * 60
    n = len(st)
    if n < 12 or dur_s <= 0:
        return None
    ds = [s.get("d") for s in st if isinstance(s, dict)]
    if len(ds) < 12:
        return None
    # riempi eventuali None mantenendo monotonia
    for i in range(len(ds)):
        if ds[i] is None:
            ds[i] = ds[i - 1] if i > 0 else 0.0
    n = len(ds)
    dt = dur_s / (n - 1)
    pace = []
    for i in range(n - 1):
        dd = ds[i + 1] - ds[i]
        pace.append(999.0 if dd <= 0.3 else 1000.0 * dt / dd)  # 999 = fermo
    pace.append(pace[-1] if pace else 999.0)
    w = max(2, int(round(15.0 / dt)))  # smoothing ~15s
    sp = _median_filter(pace, w)
    moving = [p for p in sp if p < 900]
    if len(moving) < 12:
        return None
    cf, cs = _two_means_split(moving)
    sep = (cs / cf) if cf > 0 else 1.0
    thr = (cf + cs) / 2.0
    work = [1 if (p < thr and p < 900) else 0 for p in sp]
    # blocchi contigui
    blocks = []
    i = 0
    while i < n:
        v = work[i]
        j = i
        while j < n and work[j] == v:
            j += 1
        seg_t = (j - i) * dt
        seg_d = ds[min(j, n - 1)] - ds[i]
        blocks.append([v, seg_t, seg_d])
        i = j
    # fondi micro-blocchi (<20s) nel precedente
    merged = []
    for b in blocks:
        if merged and b[1] < 20:
            merged[-1][1] += b[1]
            merged[-1][2] += b[2]
        else:
            merged.append(b[:])
    work_blocks = [b for b in merged if b[0] == 1 and b[1] >= 20 and b[2] >= 150]
    work_d = [b[2] for b in work_blocks]
    total_d = ds[-1] or 1.0
    return {
        "cf": cf, "cs": cs, "sep": sep,
        "n_work": len(work_blocks),
        "work_d": work_d,
        "coverage": sum(work_d) / total_d if total_d else 0.0,
    }


def _workout_structure_from_laps(laps: list) -> Optional[dict]:
    """Rileva struttura dalle lap Strava/Garmin (gold standard: split manuali).

    Ogni lap: pace = 1000/average_speed. Filtra lap-artefatto (<120m o <15s).
    2-means su pace lap → cluster lavoro/recupero.
    """
    if not laps:
        return None
    items = []
    for lp in laps:
        spd = lp.get("average_speed") or 0
        dist = lp.get("distance") or 0
        mt = lp.get("moving_time") or lp.get("elapsed_time") or 0
        pace = (1000.0 / spd) if spd > 0 else ((mt / (dist / 1000.0)) if dist > 0 else None)
        if pace is None or dist < 120 or mt < 15:
            continue
        items.append({"pace": pace, "d": dist, "t": mt})
    if len(items) < 2:
        return None
    paces = [it["pace"] for it in items]
    cf, cs = _two_means_split(paces)
    sep = (cs / cf) if cf > 0 else 1.0
    thr = (cf + cs) / 2.0
    work = [it for it in items if it["pace"] <= thr]
    rest = [it for it in items if it["pace"] > thr]
    # conta blocchi di lavoro intervallati (≥1 recupero tra due lavori)
    seq = [1 if it["pace"] <= thr else 0 for it in items]
    n_work_blocks = sum(1 for k in range(len(seq)) if seq[k] == 1 and (k == 0 or seq[k - 1] == 0))
    has_rest_between = any(seq[k] == 0 for k in range(1, len(seq) - 1))
    return {
        "cf": cf, "cs": cs, "sep": sep,
        "n_work": n_work_blocks,
        "n_rest": len(rest),
        "has_rest_between": has_rest_between,
        "work_d": [it["d"] for it in work],
        "n_laps": len(items),
    }


_WORKOUT_NAME_HINTS = [
    ("intervals", ("ripetut", "interval", "intervall", "x1000", "x800", "x600",
                   "x400", "x200", "x300", "serie", "series", "vo2", "fartlek",
                   "piramide", "pyramid", "allunghi", "strides")),
    ("threshold", ("soglia", "threshold", "tempo run")),
    ("tempo", ("tempo", "medio", "progressiv")),
    ("long", ("lungo", "lunghissimo", "long run")),
    ("recovery", ("recupero", "recovery", "rigeneran", "defatic", "lento facile")),
    ("race", ("gara", "race", "competizione", "wedstrijd")),
]


def _name_workout_hint(name: str) -> Optional[str]:
    nl = (name or "").lower()
    for label, keys in _WORKOUT_NAME_HINTS:
        if any(k in nl for k in keys):
            return label
    return None


def _classify_run_v2(run_doc: dict) -> tuple[str, str]:
    """Classifier strutturale: laps → streams → nome → fallback pace/distanza.

    Ritorna (run_type, evidence). Distingue ripetute (intervals) da tempo
    continuo guardando la STRUTTURA, non solo la media.
    """
    dist = run_doc.get("distance_km") or 0
    pace_parts = (run_doc.get("avg_pace") or "6:00").split(":")
    try:
        ps = int(pace_parts[0]) * 60 + int(pace_parts[1])
    except (ValueError, IndexError):
        ps = 360
    name = run_doc.get("name") or ""
    hint = _name_workout_hint(name)

    # 1) LAPS (gold standard)
    lap_s = _workout_structure_from_laps(run_doc.get("laps"))
    if lap_s and lap_s["n_work"] >= 2 and lap_s["sep"] >= 1.20 \
            and lap_s["cf"] <= lap_s["cs"] * 0.82 and lap_s["has_rest_between"] \
            and lap_s["cf"] <= 315:
        return "intervals", f"laps n_work={lap_s['n_work']} sep={lap_s['sep']:.2f}"

    # 2) STREAMS (per-point structure)
    s = _workout_structure_from_streams(run_doc.get("streams"), run_doc.get("duration_minutes"))
    if s:
        work_dist = sum(s["work_d"])
        # ripetute: ≥2 blocchi veloci, recupero nettamente più lento.
        # cf≤315 (5:15) esclude run/walk easy (lavoro che NON è qualità reale).
        if s["n_work"] >= 2 and s["sep"] >= 1.30 and s["cf"] <= s["cs"] * 0.80 and s["cf"] <= 315:
            return "intervals", f"streams n_work={s['n_work']} sep={s['sep']:.2f} cf={s['cf']:.0f}"
        # tempo/soglia continuo: blocco veloce SOSTENUTO (≥55% e ≥1.2km),
        # pace in range soglia/tempo (230–315s). <230 = rep/sprint, non tempo.
        if s["n_work"] >= 1 and s["coverage"] >= 0.55 and work_dist >= 1200 \
                and 230 <= s["cf"] <= 315 and dist < 16:
            if s["cf"] <= 258:
                return "threshold", f"streams continuous cov={s['coverage']:.2f} cf={s['cf']:.0f}"
            return "tempo", f"streams continuous cov={s['coverage']:.2f} cf={s['cf']:.0f}"

    # 3) name hint per intervals quando struttura debole ma nome esplicito
    if hint == "intervals" and s and s["n_work"] >= 2 and s["sep"] >= 1.18:
        return "intervals", f"name+streams sep={s['sep']:.2f}"

    # 4) fallback pace/distanza (logica storica) con assist dal nome
    base = _classify_run({"distance_km": dist, "avg_pace": run_doc.get("avg_pace", "6:00")})
    if hint in ("long", "recovery", "race", "threshold") and hint != base:
        return hint, f"name='{name}' over {base}"
    src = "no-stream" if not s else f"sep={s['sep']:.2f}"
    return base, f"fallback pace={ps}s {src}"


def _format_pace(speed_ms: float) -> str:
    """Convert m/s to min:sec/km pace string."""
    if speed_ms <= 0:
        return "0:00"
    pace_sec = 1000 / speed_ms
    m = int(pace_sec // 60)
    s = int(pace_sec % 60)
    return f"{m}:{s:02d}"


def _is_strava_run_activity(activity: dict) -> bool:
    """Return True for Strava activity variants that should be imported as runs."""
    activity_type = activity.get("type")
    sport_type = activity.get("sport_type")
    return activity_type in {"Run", "VirtualRun"} or sport_type in {"Run", "TrailRun", "VirtualRun"}


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL RUN OVERRIDES
# ─────────────────────────────────────────────────────────────────────────────
# Strava treadmill data unreliable (no GPS, belt-distance miscalibration).
# Override fixes DISPLAY values only; is_treadmill=True mantenuto so analytics
# (VDOT, zone, race predictions) continue to exclude treadmill runs.
# Key: (name, date) tuple — exact match.
_MANUAL_RUN_OVERRIDES: dict[tuple[str, str], dict] = {
    ("Soglia Intensa Tapis Roulant", "2026-05-20"): {
        "distance_km": 5.3,
        "duration_minutes": 22.1,  # 22:06
        "avg_pace": "4:10",
        "is_treadmill": True,  # treadmill resta True → escluso da analytics
        "treadmill_grade_pct": 2.6,  # info: TRX Marathon livello 3/15
        "manual_override": True,
        "run_type": "threshold",
        "splits": [
            {"km": 1, "pace": "4:27", "distance": 1000, "elapsed_time": 267,
             "hr": None, "cadence": None, "elevation_difference": 0},
            {"km": 2, "pace": "4:27", "distance": 1000, "elapsed_time": 267,
             "hr": None, "cadence": None, "elevation_difference": 0},
            {"km": 3, "pace": "4:08", "distance": 1000, "elapsed_time": 248,
             "hr": None, "cadence": None, "elevation_difference": 0},
            {"km": 4, "pace": "4:08", "distance": 1000, "elapsed_time": 248,
             "hr": None, "cadence": None, "elevation_difference": 0},
            {"km": 5, "pace": "3:52", "distance": 1000, "elapsed_time": 232,
             "hr": None, "cadence": None, "elevation_difference": 0},
            {"km": 6, "pace": "3:38", "distance": 300, "elapsed_time": 65,
             "hr": None, "cadence": None, "elevation_difference": 0},
        ],
        "notes": (
            "Soglia Intensa Tapis Roulant (TRX Marathon, livello 3/15 = 2.6% "
            "pendenza reale). Override manuale: distanza/durata/pace corretti. "
            "Struttura: 2km@13.5kmh + 2km@14.5kmh + 1km@15.5kmh + 300m@16.5kmh. "
            "Treadmill flag mantenuto → escluso da VDOT/zone/predictions."
        ),
    },
}


def _apply_manual_override(run_doc: dict) -> dict:
    """Apply manual override if (name, date) matches a configured entry."""
    key = (run_doc.get("name", ""), run_doc.get("date", ""))
    override = _MANUAL_RUN_OVERRIDES.get(key)
    if not override:
        return run_doc
    run_doc.update(override)
    return run_doc


def _strava_error_response(resp: httpx.Response, fallback_status: int = 502) -> JSONResponse:
    retry_after = resp.headers.get("retry-after")
    read_limit = resp.headers.get("x-readratelimit-limit")
    read_usage = resp.headers.get("x-readratelimit-usage")
    rate_payload = {
        "limit": resp.headers.get("x-ratelimit-limit"),
        "usage": resp.headers.get("x-ratelimit-usage"),
        "read_limit": read_limit,
        "read_usage": read_usage,
    }

    if resp.status_code == 429:
        message = "Limite Strava raggiunto. Riprova tra qualche minuto: il sync ora non verra' conteggiato come 0 corse."
        try:
            read_limit_day = int((read_limit or "").split(",")[1])
            read_usage_day = int((read_usage or "").split(",")[1])
            if read_usage_day >= read_limit_day:
                message = (
                    "Limite giornaliero Strava raggiunto. Riprova dopo il reset giornaliero Strava; "
                    "il nuovo sync usera' molte meno chiamate e non verra' conteggiato come 0 corse."
                )
        except (IndexError, ValueError):
            pass

        body = {
            "error": "strava_rate_limited",
            "message": message,
            "retry_after": int(retry_after) if retry_after and retry_after.isdigit() else None,
            "rate_limit": rate_payload,
        }
        return JSONResponse(body, status_code=429)

    if resp.status_code in {401, 403}:
        return JSONResponse(
            {
                "error": "strava_auth_required",
                "message": "Autorizzazione Strava non valida o permessi insufficienti. Ricollega Strava dal profilo.",
            },
            status_code=resp.status_code,
        )

    return JSONResponse(
        {
            "error": "strava_fetch_failed",
            "message": f"Strava non ha risposto correttamente (HTTP {resp.status_code}).",
            "status_code": resp.status_code,
        },
        status_code=fallback_status,
    )


@app.post("/api/strava/sync")
async def strava_sync():
    """Fetch ALL activities from Strava (paginated) and upsert into DB."""
    tokens = await _get_active_strava_token()
    if not tokens:
        await publish_event({"type": "sync_error", "source": "strava", "error": "not_connected"})
        return JSONResponse({"error": "not_connected"}, status_code=400)
    await publish_event({"type": "sync_started", "source": "strava"})

    tokens = await _refresh_token_if_needed(tokens)
    athlete_id = tokens.get("athlete_id")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    synced = 0
    skipped_existing = 0
    scanned = 0
    existing_runs = await db.runs.count_documents(
        {"athlete_id": athlete_id, "strava_id": {"$exists": True, "$ne": None}}
    ) if athlete_id else await db.runs.count_documents({"strava_id": {"$exists": True, "$ne": None}})
    max_pages = 1 if existing_runs > 0 else 10

    async with httpx.AsyncClient(timeout=30.0) as http:
        # 1) Paginate Strava activities. Once history exists, read only the latest
        # page and import missing runs; reprocessing every old run burns Strava's
        # rate limit and can make a valid new sync look like "0 corse".
        all_activities = []
        page = 1
        while True:
            resp = await http.get(
                "https://www.strava.com/api/v3/athlete/activities",
                headers=headers,
                params={"per_page": 200, "page": page},
            )
            if resp.status_code != 200:
                await publish_event({
                    "type": "sync_error",
                    "source": "strava",
                    "error": "rate_limited" if resp.status_code == 429 else f"http_{resp.status_code}",
                })
                return _strava_error_response(resp)

            batch = resp.json()
            if not batch:
                break
            all_activities.extend(batch)
            if page >= max_pages:
                break
            page += 1

        # Get profile for HR % calculation
        prof_q = {"athlete_id": athlete_id} if athlete_id else {}
        profile = await db.profile.find_one(prof_q)
        max_hr_profile = profile.get("max_hr", 200) if profile else 200

        # 2) Process each run
        for act in all_activities:
            scanned += 1
            if not _is_strava_run_activity(act):
                continue

            strava_id = act["id"]
            existing = await db.runs.find_one({"strava_id": strava_id}, {"_id": 1})
            if existing:
                skipped_existing += 1
                continue

            distance_km = round(act.get("distance", 0) / 1000, 2)
            duration_min = round(act.get("moving_time", 0) / 60, 2)
            avg_speed = act.get("average_speed", 0)
            avg_pace = _format_pace(avg_speed)
            avg_hr = act.get("average_heartrate")
            max_hr = act.get("max_heartrate")
            date_str = act.get("start_date_local", "")[:10]
            start_date = act.get("start_date")
            start_date_local = act.get("start_date_local")

            # Get summary polyline from the activity list data
            summary_polyline = act.get("map", {}).get("summary_polyline", "")
            start_latlng = act.get("start_latlng", [])

            # Fetch detailed activity for splits + full polyline + streams
            splits = []
            full_polyline = ""
            streams_data = None  # per-point streams for detailed chart
            laps_data: list = []  # Strava laps → structural interval detection
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

                    # Fetch laps (Strava manual/auto splits) for structural
                    # interval detection: 3x1000 con recupero NON visibile dalla
                    # media, ma le lap rivelano lavoro/recupero (gold standard).
                    try:
                        laps_resp = await http.get(
                            f"https://www.strava.com/api/v3/activities/{strava_id}/laps",
                            headers=headers,
                        )
                        if laps_resp.status_code == 200:
                            for lp in laps_resp.json():
                                laps_data.append({
                                    "distance": lp.get("distance"),
                                    "moving_time": lp.get("moving_time"),
                                    "elapsed_time": lp.get("elapsed_time"),
                                    "average_speed": lp.get("average_speed"),
                                    "average_heartrate": lp.get("average_heartrate"),
                                    "lap_index": lp.get("lap_index"),
                                })
                    except Exception:
                        pass
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
                "start_date": start_date,
                "start_date_local": start_date_local,
                "sport_type": act.get("sport_type"),
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
                "device_temp_c": detail.get("average_temp") if detail.get("average_temp") is not None else act.get("average_temp"),
                "splits": splits,
                "streams": streams_data,  # per-point data: d, hr, cad, alt, pace, ll
                "laps": laps_data,  # Strava laps for structural interval detection
                "polyline": full_polyline or summary_polyline,
                "start_latlng": start_latlng,
                "plan_feedback": None,
                # Running dynamics - Prefer processed FIT data over Strava summary
                "avg_vertical_oscillation": fit_dynamics.get("avg_vertical_oscillation") or detail.get("average_vertical_oscillation"),
                "avg_vertical_ratio":       fit_dynamics.get("avg_vertical_ratio") or detail.get("average_vertical_ratio"),
                "avg_ground_contact_time":  fit_dynamics.get("avg_ground_contact_time") or detail.get("average_ground_contact_time"),
                "avg_stride_length":        fit_dynamics.get("avg_stride_length") or detail.get("average_stride_length"),
            }
            # Classificazione strutturale (laps → streams → nome → pace).
            # Distingue ripetute (3x1000 con recupero) da tempo continuo, cosa
            # impossibile dalla sola media. Sovrascrive il quick-classify sopra.
            try:
                rt, rt_ev = _classify_run_v2(run_doc)
                run_doc["run_type"] = rt
                run_doc["classify_evidence"] = rt_ev
            except Exception as e:
                print(f"[classify_v2] {strava_id}: {e}")
            # Manual override per casi specifici (es. treadmill TRX).
            # Solo display values; is_treadmill resta True → analytics escludono.
            # (override DOPO classify → run_type manuale ha priorità)
            run_doc = _apply_manual_override(run_doc)
            # GAP (grade-adjusted pace) sec/km — pace-only effort normalizer.
            # Strava linear approx ~15s/km per 1% grade. Saved per-run so future
            # analytics (divergence detection, classify) usano effort vero.
            gap_sec = _gap_pace_seconds({
                "splits": run_doc.get("splits", splits),
                "distance_km": run_doc.get("distance_km", distance_km),
                "avg_pace": run_doc.get("avg_pace", avg_pace),
            })
            if gap_sec:
                run_doc["gap_pace_sec"] = gap_sec
                run_doc["gap_pace"] = _format_secs(gap_sec)
            # Best interval paces (400m/600m/800m/1000m) — per intercettare
            # ripetute annidate dentro un run più lungo. Vital per VO2max
            # detection da workout (8x400m, 6x800m, etc.) che da avg_pace
            # apparirebbero medie/easy.
            best_intervals = _compute_best_intervals(streams_data or [])
            if best_intervals:
                run_doc.update(best_intervals)
            run_doc = _normalise_run_quality_fields(run_doc)
            # Meteo persistito (Open-Meteo, media ore coperte dalla corsa):
            # senza, il VDOT estivo resta non corretto per il caldo e la corsa
            # non compare in Clima & Ritmo. Non-fatale.
            try:
                run_doc.update(await _run_weather_fields(run_doc))
            except Exception as e:
                print(f"[weather-enrich] {strava_id}: {e}")

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
        try:
            await _link_garmin_csv_docs(athlete_id)
        except Exception as e:
            print(f"[garmin-csv-link] non-fatal relink after Strava sync failed: {e}")
        await _invalidate_analytics_cache(athlete_id)
        await _invalidate_runner_dna_cache(athlete_id)

    # ── Auto-adapt training plan on every sync ───────────────────────────────
    # Recalculate VDOT from latest runs and update future weeks if paces drifted
    adapt_result = None
    if athlete_id and synced > 0:
        try:
            adapt_result = await _auto_adapt_plan_after_sync(athlete_id)
        except Exception as e:
            print(f"[training-auto-adapt] non-fatal auto adapt after Strava sync failed: {e}")
            pass  # never fail the sync because of adapt

    await publish_event({"type": "sync_complete", "source": "strava", "count": synced})
    return {
        "ok": True,
        "synced": synced,
        "created": synced,
        "skipped_existing": skipped_existing,
        "scanned": scanned,
        "auto_adapt": adapt_result,
    }


@app.post("/api/runs/reapply-overrides")
async def reapply_manual_overrides():
    """Riapplica _MANUAL_RUN_OVERRIDES su run già presenti in DB.

    Utile quando override è stato aggiunto/modificato DOPO che il run è stato
    già sincronizzato (sync normale ha skip-existing).
    """
    tokens = await _get_active_strava_token()
    athlete_id = tokens.get("athlete_id") if tokens else None
    updated = []
    for (name, date), override in _MANUAL_RUN_OVERRIDES.items():
        q: dict = {"name": name, "date": date}
        if athlete_id:
            q["athlete_id"] = athlete_id
        existing = await db.runs.find_one(q)
        if not existing:
            continue
        run_doc = dict(existing)
        run_doc.update(override)
        gap_sec = _gap_pace_seconds(run_doc)
        if gap_sec:
            run_doc["gap_pace_sec"] = gap_sec
            run_doc["gap_pace"] = _format_secs(gap_sec)
        run_doc = _normalise_run_quality_fields(run_doc)
        await db.runs.update_one({"_id": existing["_id"]}, {"$set": run_doc})
        updated.append({"name": name, "date": date})

    return {"ok": True, "updated": updated, "count": len(updated)}


# Endpoints PROFILE / USER LAYOUT / RUNS estratti in routers/ (round 8 — #15).
# Vedi backend/routers/profile.py + backend/routers/runs.py.


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
async def get_dashboard():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    await _ensure_fitness_freshness_current(athlete_id)
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
        latest = _project_fitness_freshness_doc(ff_docs[0]) or ff_docs[0]
        ff_docs[0] = latest
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
        # Confidence scales with how far over the optimistic ceiling you are:
        # at the edge (gap == max_optimistic) → ~50%; twice the gap → ~25%
        raw_conf = int(round(55 * max_optimistic / gap))
        confidence = max(5, min(raw_conf, 49))   # clamp [5, 49]
        return {**base, "feasible": False, "difficulty": "unrealistic",
                "message": msg, "confidence_pct": confidence,
                "suggested_weeks": suggested_weeks}


PLAN_STRATEGY_CONFIG = {
    "conservative": {
        "label": "Conservativo",
        "focus": "Costanza e prevenzione infortuni",
        "rate_key": "conservative_rate",
        "volume_multiplier": 0.85,
        "completion_base": 92,
        "success_offset": -6,
    },
    "balanced": {
        "label": "Bilanciato",
        "focus": "Miglior compromesso tra fatica e risultato",
        "rate_key": "balanced_rate",
        "volume_multiplier": 1.0,
        "completion_base": 80,
        "success_offset": 0,
    },
    "aggressive": {
        "label": "Sfidante",
        "focus": "Massima performance",
        "rate_key": "optimistic_rate",
        "volume_multiplier": 1.15,
        "completion_base": 62,
        "success_offset": 10,
    },
}


def _clamp_int(value: float, lo: int = 5, hi: int = 95) -> int:
    return int(max(lo, min(hi, round(value))))


def _build_strategy_options(current_vdot: float, target_vdot: float, weeks: int, feasibility: dict,
                            history_context: Optional[dict] = None) -> list:
    gap = max(0.0, target_vdot - current_vdot)
    mesocycles = max(weeks / 3.5, 0.1)
    conservative_rate = float(feasibility.get("conservative_rate") or 0.5)
    optimistic_rate = float(feasibility.get("optimistic_rate") or 0.8)
    balanced_rate = (conservative_rate + optimistic_rate) / 2.0
    history_context = history_context or {}
    readiness = float(history_context.get("readiness_score", 65) or 65)
    stop_days = int(history_context.get("days_since_last_run", 0) or 0)
    quality_count = int(history_context.get("quality_sessions_8w", 0) or 0)
    readiness_adjustment = (readiness - 65) / 5.0
    stop_penalty = max(0.0, min(18.0, (stop_days - 10) * 0.45)) if stop_days > 10 else 0.0
    quality_bonus = min(5.0, quality_count * 0.8)
    rate_map = {
        "conservative_rate": conservative_rate,
        "balanced_rate": balanced_rate,
        "optimistic_rate": optimistic_rate,
    }

    score_cfg = {
        "conservative": {"floor": 28, "ceiling": 86, "margin": 4, "exponent": 1.15, "gap_penalty": 11, "short_penalty": 0.3},
        "balanced": {"floor": 34, "ceiling": 92, "margin": 4, "exponent": 1.22, "gap_penalty": 14, "short_penalty": 0.5},
        "aggressive": {"floor": 40, "ceiling": 95, "margin": 4, "exponent": 1.35, "gap_penalty": 19, "short_penalty": 0.8},
    }

    options = []
    for key, cfg in PLAN_STRATEGY_CONFIG.items():
        rate = rate_map[cfg["rate_key"]]
        capacity = mesocycles * rate
        scoring = score_cfg[key]
        ceiling = scoring["ceiling"]
        if gap <= 0:
            success_pct = ceiling - (2 if key == "aggressive" else 0)
        else:
            ratio = max(0.0, capacity / max(gap, 0.1))
            if ratio < 1.0:
                near_ceiling = ceiling - scoring["margin"]
                success_pct = (
                    scoring["floor"]
                    + (near_ceiling - scoring["floor"]) * (ratio ** scoring["exponent"])
                    - ((1.0 - ratio) * scoring["gap_penalty"])
                )
            else:
                buffer = min(1.0, (ratio - 1.0) / 0.55)
                success_pct = (ceiling - scoring["margin"]) + buffer * scoring["margin"]

            if weeks < 12:
                success_pct -= (12 - weeks) * scoring["short_penalty"]

            success_pct += readiness_adjustment + quality_bonus - stop_penalty

        overreach = max(0.0, gap - capacity)
        completion_pct = cfg["completion_base"] - overreach * 6
        if key == "aggressive":
            completion_pct -= max(0.0, gap - conservative_rate * mesocycles) * 3
        elif key == "conservative":
            completion_pct += 4
        completion_pct += readiness_adjustment - (stop_penalty * 0.7)

        options.append({
            "mode": key,
            "label": cfg["label"],
            "focus": cfg["focus"],
            "success_pct": _clamp_int(success_pct, 15, ceiling),
            "completion_pct": _clamp_int(completion_pct, 15, 98),
            "weekly_volume_multiplier": cfg["volume_multiplier"],
            "projected_vdot": round(min(target_vdot, current_vdot + capacity), 1),
            "note": (
                "Incrementi minimi, recupero piu protetto."
                if key == "conservative"
                else "Progressione Daniels standard."
                if key == "balanced"
                else "Volume piu alto e ritmi piu vicini al limite."
            ),
        })
    return options


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


def _tp_ripetute_session(phase: str, goal: str, dist_km: float,
                         paces: dict, week_vdot: float,
                         target_time_str: str = "", week_number: int = 1,
                         heat_extra_sec: int = 0, temp_note: str = "") -> tuple:
    """Seduta RIPETUTE del martedì. Sempre su percorso pianeggiante (mai salite).

    Alterna settimana per settimana:
    - settimane dispari → ripetute classiche VDOT, fase-specifiche (Daniels)
    - settimane pari    → Protocollo Norvegese 4×4 (Helgerud et al. 2007):
      4×4 min @ 90–95% FCmax con 3 min recupero — +7.2% VO₂max in 8 settimane.

    I ritmi nel dict `paces` sono già adattati alla temperatura attesa;
    `heat_extra_sec` serve solo a correggere il ritmo gara calcolato qui.
    """
    ep = paces.get("easy") or "6:00"
    tp = paces.get("threshold") or "5:00"
    ip = paces.get("interval") or "4:30"
    rp = paces.get("repetition") or "4:10"
    race_dist = RACE_DISTANCES.get(goal, 5.0)
    # Ritmo gara = tempo obiettivo / distanza (fallback: Daniels dal VDOT),
    # corretto per il caldo come gli altri ritmi di qualità.
    _goal_min = _parse_time_str(target_time_str) if target_time_str else None
    if _goal_min and _goal_min > 0:
        race_pace_km = _format_secs(int(round(_goal_min * 60 / race_dist)) + heat_extra_sec)
    else:
        _race_secs = _vdot_to_race_seconds(week_vdot, race_dist)
        race_pace_km = _format_secs(int(round(_race_secs / race_dist)) + heat_extra_sec) if _race_secs else tp

    # Ritmo norvegese: 90–95% FCmax ≈ a metà tra soglia e I-pace
    _tps, _ips = _tp_pace_secs(tp), _tp_pace_secs(ip)
    npace = _format_secs((_tps + _ips) // 2) if _tps and _ips else ip

    if phase in ("Taper", "Gara"):
        n = 4 if phase == "Taper" else 3
        return ("intervals", "Ripetute Sciolte Pre-Gara",
                f"2 km warm-up @ {ep}/km · {n}×200 m @ {rp}/km con recupero completo · "
                f"1 km defaticamento. Solo reattività, zero fatica accumulata. "
                f"Percorso pianeggiante.{temp_note}", rp)

    if week_number % 2 == 0:
        return ("intervals", "Norvegese 4×4",
                f"10 min riscaldamento @ {ep}/km · 4×4 min @ 90–95% FCmax (≈{npace}/km) "
                f"con 3 min recupero in corsa blanda · 10 min defaticamento. "
                f"Protocollo Helgerud 2007: +7% VO₂max in 8 settimane. Col caldo guida "
                f"con la frequenza cardiaca, non col passo. Percorso pianeggiante.{temp_note}", npace)

    if phase == "Base Aerobica":
        return ("intervals", "Ripetute Brevi Introduttive",
                f"2 km warm-up @ {ep}/km · 8×300 m @ {rp}/km con 90 s recupero camminando · "
                f"2 km defaticamento. Reattività e tecnica senza stress metabolico. "
                f"Percorso pianeggiante.{temp_note}", rp)

    if phase == "Sviluppo":
        return ("intervals", "Ripetute 600 m",
                f"2 km warm-up @ {ep}/km · 6×600 m @ {ip}/km con 90 s jog · "
                f"2 km defaticamento. Sviluppo della potenza aerobica. VDOT {week_vdot}. "
                f"Percorso pianeggiante.{temp_note}", ip)

    if phase.startswith("Intensit"):
        reps = {"5K": "5×1000 m", "10K": "6×1000 m", "Half Marathon": "5×1200 m",
                "Marathon": "5×1000 m"}.get(goal, "5×1000 m")
        return ("intervals", f"Ripetute {reps.split('×')[1]}",
                f"2 km warm-up @ {ep}/km · {reps} @ {ip}/km (95–100% VO₂max) con 2½ min jog · "
                f"2 km defaticamento. Massimo stimolo VO₂max. VDOT {week_vdot}. "
                f"Percorso pianeggiante.{temp_note}", ip)

    # Specifico: memoria del ritmo gara
    reps = {"5K": "3×1600 m", "10K": "4×2000 m", "Half Marathon": "3×3000 m",
            "Marathon": "3×3000 m"}.get(goal, "3×1600 m")
    return ("intervals", "Ripetute a Ritmo Gara",
            f"2 km warm-up @ {ep}/km · {reps} @ {race_pace_km}/km (ritmo gara) con 2 min recupero · "
            f"2 km defaticamento. Adattamento neuromuscolare e mentale al ritmo obiettivo. "
            f"Percorso pianeggiante.{temp_note}", race_pace_km)


def _tp_soglia_session(phase: str, goal: str, dist_km: float,
                       paces: dict, week_vdot: float,
                       temp_note: str = "") -> tuple:
    """Seduta SOGLIA del giovedì (T-pace ~88% VO₂max). Percorso pianeggiante.

    Complementare alle ripetute del martedì (Daniels: mai due giorni duri
    consecutivi — Mer è riposo). Il volume di soglia cresce con le fasi.
    """
    ep = paces.get("easy") or "6:00"
    tp = paces.get("threshold") or "5:00"

    if phase == "Base Aerobica":
        return ("tempo", "Soglia Introduttiva",
                f"2 km warm-up @ {ep}/km · 2×8 min @ {tp}/km con 2 min recupero jog · "
                f"2 km defaticamento. Primo contatto col ritmo soglia. "
                f"Percorso pianeggiante.{temp_note}", tp)

    if phase == "Sviluppo":
        return ("tempo", "Tempo Run 20 min",
                f"2 km warm-up @ {ep}/km · 20 min continui @ {tp}/km (soglia ~88% VO₂max) · "
                f"2 km defaticamento. Alza il turnpoint del lattato. VDOT {week_vdot}. "
                f"Percorso pianeggiante.{temp_note}", tp)

    if phase.startswith("Intensit"):
        return ("tempo", "Cruise Intervals 2×12 min",
                f"2 km warm-up @ {ep}/km · 2×12 min @ {tp}/km con 2 min recupero jog · "
                f"2 km defaticamento. Volume di soglia mantenendo la qualità. VDOT {week_vdot}. "
                f"Percorso pianeggiante.{temp_note}", tp)

    if phase == "Specifico":
        km_ct = {"5K": 4, "10K": 6, "Half Marathon": 8, "Marathon": 10}.get(goal, 5)
        return ("tempo", f"Tempo Specifico {km_ct} km",
                f"2 km warm-up @ {ep}/km · {km_ct} km continui @ {tp}/km · "
                f"2 km defaticamento. Tenuta di ritmo nella fase specifica. "
                f"Percorso pianeggiante.{temp_note}", tp)

    if phase == "Taper":
        return ("tempo", "Soglia Breve",
                f"2 km warm-up @ {ep}/km · 12 min @ {tp}/km · 1 km defaticamento. "
                f"Mantieni l'intensità, taglia il volume (Mujika & Padilla 2003).{temp_note}", tp)

    # Gara
    return ("tempo", "Attivazione Soglia",
            f"15 min facili @ {ep}/km con 8 min @ {tp}/km inseriti. "
            f"Gambe pronte, zero fatica per la gara.{temp_note}", tp)


def _tp_strength_exercises(phase: str, day_type: str, week_in_phase: int = 0) -> list:
    """Generate phase-appropriate strength & plyometric exercises for runners.

    Scientific periodization:
    - BASE:      Heavy strength (max force foundation) + low-intensity SSC
    - SVILUPPO:  Heavy strength (maintenance) + moderate plyometrics
    - INTENSITÀ: High-intensity plyometrics + strength maintenance
    - SPECIFICO: Race-specific plyometrics, reduced volume
    - TAPER:     Neuromuscular activation only

    References:
    - Beattie et al. (2017): heavy resistance → running economy +2-8%
    - Saunders et al. (2006): plyometrics → 3K economy +4.1%
    - Lauersen et al. (2014): strength training → injury risk -68%
    - Blagrove et al. (2018): resistance training for endurance runners
    - Barnes & Kilding (2015): running economy determinants
    - Rønnestad & Mujika (2014): heavy strength for endurance performance
    """

    # ── Prehab (sempre, ogni fase) ────────────────────────────────────────────
    prehab = [
        {"name": "Eccentric Heel Drop – Alfredson", "sets": 3, "reps": "15/lato",
         "note": "Ginocchio esteso + flesso. Protocollo gold-standard tendinopatia achillea."},
        {"name": "Clamshell con banda elastica", "sets": 3, "reps": "15/lato",
         "note": "Gluteo medio. Previene ITBS e sindrome patellofemorale."},
        {"name": "Single-Leg Glute Bridge", "sets": 3, "reps": "12/lato",
         "note": "Stabilizzazione bacino. Riduce asimmetrie che causano infortuni."},
    ]

    # ── Core (stabilità lombo-pelvica durante la corsa) ───────────────────────
    core = [
        {"name": "Dead Bug", "sets": 3, "reps": "10/lato",
         "note": "Core anti-estensione. Stabilità lombare in fase di volo."},
        {"name": "Copenhagen Plank", "sets": 3, "reps": "8/lato",
         "note": "Adduttori + core laterale. Previene pubalgia nei runner."},
        {"name": "Plank con alzata gamba alternata", "sets": 3, "reps": "10/lato",
         "note": "Integrazione core-glutei. Simula stabilità in singolo appoggio."},
    ]

    core_light = [
        {"name": "Dead Bug", "sets": 2, "reps": "8/lato",
         "note": "Attivazione core. Mantenimento forza senza accumulo fatica."},
        {"name": "Plank", "sets": 2, "reps": "30 s",
         "note": "Stabilità lombare. Volume ridotto per rispettare il recupero."},
    ]

    # ── Heavy Strength — Fase BASE e SVILUPPO ────────────────────────────────
    # Beattie 2017: max force è il predittore principale di economia di corsa
    strength_heavy = [
        {"name": "Bulgarian Split Squat", "sets": 4, "reps": "6/lato",
         "note": "Carico pesante (zaino/manubri). Recupero 2-3 min. Forza max unilaterale → economia corsa (Beattie 2017)."},
        {"name": "Single-Leg Romanian Deadlift", "sets": 3, "reps": "8/lato",
         "note": "Bilanciere o manubri. Catena posteriore + propriocezione caviglia. Previene infortuni ischio-crurali."},
        {"name": "Calf Raise Monopodalico Pesante", "sets": 4, "reps": "10/lato",
         "note": "Con zaino o manubrio. Stiffness tendine Achille = componente chiave economia corsa."},
        {"name": "Nordic Hamstring Curl", "sets": 3, "reps": 5,
         "note": "Forza eccentrica ischio-crurali. Riduce infortuni muscolari del 51% (van der Horst 2015)."},
    ]

    # Versione mantenimento forza (Intensità / Specifico)
    strength_maintenance = [
        {"name": "Bulgarian Split Squat", "sets": 3, "reps": "6/lato",
         "note": "Mantenimento forza. Volume ridotto, intensità invariata (principio Rønnestad 2014)."},
        {"name": "Single-Leg Romanian Deadlift", "sets": 3, "reps": "8/lato",
         "note": "Catena posteriore. Volume ridotto ma qualità invariata."},
        {"name": "Calf Raise Monopodalico Pesante", "sets": 3, "reps": "8/lato",
         "note": "Mantenimento stiffness Achille pre-gara."},
    ]

    # ── Plyometrics BASSA intensità — Fase BASE ───────────────────────────────
    # Introduzione SSC per adattare tendini e SNC prima dei carichi alti
    plyo_low = [
        {"name": "Pogo Jumps", "sets": 3, "reps": "20 rip",
         "note": "Caviglie rigide, contatto minimo. Carica ciclo stiramento-accorciamento. Base di tutto."},
        {"name": "Single Leg Hops sul posto", "sets": 3, "reps": "10/lato",
         "note": "Forza reattiva unilaterale. Stiffness caviglia specifica per la corsa."},
        {"name": "Sprint in Piano 60 m", "sets": 6, "reps": "60 m",
         "note": "Recupero 90 s camminata. Potenza neuromuscolare su percorso piano (niente salite)."},
    ]

    # ── Plyometrics MEDIA intensità — Fase SVILUPPO ───────────────────────────
    # Conversione forza → potenza reattiva
    plyo_moderate = [
        {"name": "Box Jump (40-50 cm)", "sets": 4, "reps": 6,
         "note": "Massima esplosività nella spinta. Atterraggio morbido. RFD (Rate of Force Development)."},
        {"name": "Bounding – Corsa Balzata", "sets": 4, "reps": "30 m",
         "note": "Forza reattiva orizzontale. Ampiezza falcata. Recupero 3 min completo."},
        {"name": "Single Leg Hops in avanti", "sets": 3, "reps": "8/lato",
         "note": "Potenza propulsiva unilaterale specifica per la corsa."},
        {"name": "Sprint in Piano 80 m", "sets": 8, "reps": "80 m",
         "note": "Recupero 2 min. Forma perfetta, frequenza elevata. Percorso piano."},
    ]

    # ── Plyometrics ALTA intensità — Fase INTENSITÀ ───────────────────────────
    # SSC avanzato: massimizzazione economia corsa (Saunders 2006 +4.1%)
    plyo_high = [
        {"name": "Depth Jump / Drop Jump (40 cm)", "sets": 4, "reps": 6,
         "note": "Rimbalzo IMMEDIATO, RSI >1.5. Massimo SSC. +4.1% economia 3K (Saunders 2006). 3 min recupero."},
        {"name": "Pogo Jumps Monopodalici", "sets": 3, "reps": "10/lato",
         "note": "Stiffness Achille + RFD unilaterale avanzato. Contatto < 150 ms."},
        {"name": "Hopping su un piede", "sets": 3, "reps": "15 m/lato",
         "note": "Potenza reattiva unilaterale massima. Contatto terra < 200 ms."},
        {"name": "Bounding progressivo", "sets": 4, "reps": "40 m",
         "note": "Massima spinta + frequenza di falcata. Simula sforzo neuromuscolare di gara."},
        {"name": "Sprint in Piano 100 m", "sets": 6, "reps": "100 m",
         "note": "Recupero 3 min completo. Potenza massima, forma impeccabile. Percorso piano."},
    ]

    # ── Plyometrics TAPER — attivazione pre-gara ──────────────────────────────
    plyo_activation = [
        {"name": "Pogo Jumps", "sets": 2, "reps": "15 rip",
         "note": "Priming neuromuscolare. Mantiene stiffness senza accumulare fatica."},
        {"name": "Sprint Brevi in Piano", "sets": 4, "reps": "50 m",
         "note": "Attivazione SNC pre-gara. Recupero completo tra le ripetizioni. Percorso piano."},
    ]

    # ── Assegnazione per fase e tipo giornata ─────────────────────────────────

    if day_type == "rest":
        # Giorno riposo = sessione forza completa (il giorno migliore per stimolo intenso)
        if phase == "Base Aerobica":
            # Fondamenta: max force + SSC base + prehab + core
            return prehab + strength_heavy + plyo_low + core

        elif phase == "Sviluppo":
            # Conversione: heavy strength + plyometrics moderate
            return prehab[:2] + strength_heavy + plyo_moderate + core

        elif phase.startswith("Intensit"):
            # Peak SSC + mantenimento forza: volume forza ridotto, qualità plyo alta
            return prehab[:1] + strength_maintenance + plyo_high + core

        elif phase == "Specifico":
            # Riduzione volume, mantenimento qualità
            return prehab[:1] + strength_maintenance[:2] + plyo_moderate[:2] + core_light

        else:  # Taper / Gara
            return prehab[:1] + plyo_activation + core_light

    elif day_type == "easy":
        # Post corsa facile: attivazione leggera, non stimolo nuovo
        if phase in ("Base Aerobica", "Sviluppo"):
            return [
                {"name": "Pogo Jumps", "sets": 2, "reps": "15 rip",
                 "note": "Post-corsa. Mantiene SSC senza affaticare. 5 min dopo il rientro."},
                {"name": "Calf Raise Monopodalico", "sets": 2, "reps": "12/lato",
                 "note": "A corpo libero post-corsa. Rinforzo Achille di mantenimento."},
            ] + prehab[:2] + core_light
        elif phase.startswith("Intensit"):
            return prehab[:2] + [
                {"name": "Pogo Jumps", "sets": 2, "reps": "12 rip",
                 "note": "Priming SSC leggero. Non superare la fatica della seduta di qualità."},
            ] + core_light
        else:
            return prehab[:1] + core_light

    elif day_type == "long":
        # Lungo = solo mobilità e recupero (niente forza, non compromettere il lungo)
        return [
            {"name": "Foam Rolling (polpacci + IT band + plantare)", "sets": 1, "reps": "90 s/zona",
             "note": "Pre o post lungo. Recupero tessuti molli e fascia plantare."},
            {"name": "Pigeon Stretch", "sets": 1, "reps": "60 s/lato",
             "note": "Mobilità anca post-lungo. Previene rigidità piriforme."},
            {"name": "Eccentric Calf Stretch su gradino", "sets": 1, "reps": "45 s/lato",
             "note": "Mantiene elasticità gastrocnemio e soleo post-volume."},
        ]

    # Giorni qualità (Mar/Gio): nessuna forza — la corsa è lo stimolo principale
    return []


def _tp_build_sessions(week_start, week_km: float, phase: str, goal: str,
                       paces: dict, week_vdot: float, plan_mode: str = "balanced",
                       target_time_str: str = "", week_number: int = 1,
                       expected_temp_c: Optional[float] = None,
                       heat_extra_sec: int = 0) -> list:
    """Build 7-day session list for a training week.

    Struttura FISSA a 4 sedute (mai corse in salita, tutto pianeggiante):
    - Lun: lento (easy)
    - Mar: ripetute — alternate col Protocollo Norvegese 4×4 (settimane pari)
    - Gio: soglia (tempo)
    - Sab: lento lungo
    Mer/Ven/Dom: riposo + forza. I ritmi in `paces` sono già adattati alla
    temperatura attesa del mese (`expected_temp_c` / `heat_extra_sec`).
    """
    from datetime import timedelta
    day_names = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    ep = paces.get("easy") or "6:00"

    # Ripartizione km sui 4 giorni: più peso al lungo per le distanze lunghe
    dist_maps = {
        "5K":            {0: 0.22, 1: 0.24, 3: 0.22, 5: 0.32},
        "10K":           {0: 0.21, 1: 0.23, 3: 0.21, 5: 0.35},
        "Half Marathon": {0: 0.19, 1: 0.21, 3: 0.20, 5: 0.40},
        "Marathon":      {0: 0.18, 1: 0.20, 3: 0.20, 5: 0.42},
    }
    dist_map = dist_maps.get(goal, dist_maps["10K"])

    temp_note = ""
    if expected_temp_c is not None and heat_extra_sec >= 4:
        temp_note = (f" ☀️ ~{round(expected_temp_c)}°C attesi nel periodo: ritmi già adattati "
                     f"(+{heat_extra_sec} s/km sulle qualità). Preferisci le ore fresche e idratati.")

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

        if day_offset == 1:  # Martedì = RIPETUTE (alternate col Norvegese 4×4)
            s_type, title, desc, pace = _tp_ripetute_session(
                phase, goal, dist_km, paces, week_vdot, target_time_str,
                week_number, heat_extra_sec, temp_note)
        elif day_offset == 3:  # Giovedì = SOGLIA
            s_type, title, desc, pace = _tp_soglia_session(phase, goal, dist_km, paces, week_vdot, temp_note)
        elif day_offset == 5:  # Sabato = LENTO LUNGO
            s_type, title, pace = "long", "Lento Lungo", ep
            hydro = " Col caldo: idratazione ogni 20 min." if heat_extra_sec >= 6 else " Idratazione costante."
            desc = (f"Lento lungo {dist_km} km a passo {ep}/km. Sforzo 5–6/10, percorso pianeggiante. "
                    f"Costruisci resistenza aerobica e fibre lente (tipo I).{hydro}")
        else:  # Lunedì = LENTO
            s_type, title, pace = "easy", "Lento", ep
            desc = (f"Corsa lenta {dist_km} km a passo {ep}/km. "
                    f"Sforzo percepito 3–4/10, FC Z1–Z2. Percorso pianeggiante, "
                    f"recupero attivo tra le sedute di qualità.")

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


def _tp_has_quality_history(history_context: Optional[dict]) -> bool:
    history_context = history_context or {}
    return (
        int(history_context.get("quality_sessions_8w", 0) or 0) >= 2
        or int(history_context.get("interval_sessions_8w", 0) or 0) >= 1
        or int(history_context.get("tempo_sessions_8w", 0) or 0) >= 2
    )


def _tp_history_phase_alloc(weeks_total: int, history_context: Optional[dict]) -> list[tuple[str, float]]:
    history_context = history_context or {}
    stop_days = int(history_context.get("days_since_last_run", 0) or 0)
    readiness = float(history_context.get("readiness_score", 65) or 65)
    aerobic_score = float(history_context.get("aerobic_base_score", 50) or 50)
    has_quality = _tp_has_quality_history(history_context)

    if stop_days >= 21 or readiness < 45:
        return [
            ("Base Aerobica", 0.38), ("Sviluppo", 0.20), ("Intensità", 0.16),
            ("Specifico", 0.10), ("Taper", 0.10), ("Gara", 0.06),
        ]

    if has_quality and aerobic_score >= 60 and readiness >= 60:
        if weeks_total <= 10:
            return [
                ("Base Aerobica", 0.10), ("Sviluppo", 0.15), ("Intensità", 0.45),
                ("Specifico", 0.15), ("Taper", 0.10), ("Gara", 0.05),
            ]
        return [
            ("Base Aerobica", 0.14), ("Sviluppo", 0.22), ("Intensità", 0.28),
            ("Specifico", 0.18), ("Taper", 0.12), ("Gara", 0.06),
        ]

    if aerobic_score >= 60:
        return [
            ("Base Aerobica", 0.20), ("Sviluppo", 0.22), ("Intensità", 0.24),
            ("Specifico", 0.16), ("Taper", 0.12), ("Gara", 0.06),
        ]

    return [
        ("Base Aerobica", 0.30), ("Sviluppo", 0.22), ("Intensità", 0.20),
        ("Specifico", 0.12), ("Taper", 0.10), ("Gara", 0.06),
    ]


def _calibrate_plan_volume(goal_race: str, profile_max_weekly_km: float,
                           history_context: Optional[dict]) -> tuple[float, float]:
    history_context = history_context or {}
    recent_volume = float(history_context.get("weekly_volume_8w", 0) or history_context.get("weekly_volume", 0) or 0)
    recent_peak = float(history_context.get("recent_peak_weekly_km", 0) or 0)
    stop_days = int(history_context.get("days_since_last_run", 0) or 0)
    readiness = float(history_context.get("readiness_score", 65) or 65)
    defaults_floor = {"5K": 14.0, "10K": 18.0, "Half Marathon": 22.0, "Marathon": 28.0}

    if recent_volume <= 0:
        recent_volume = min(profile_max_weekly_km * 0.45, defaults_floor.get(goal_race, 18.0))

    if stop_days >= 28:
        start_km = max(8.0, min(recent_volume * 0.70, 16.0))
        cap = max(start_km * 1.45, min(profile_max_weekly_km * 0.65, max(recent_peak * 0.85, start_km)))
    elif stop_days >= 14 or readiness < 45:
        start_km = max(10.0, recent_volume * 0.80)
        cap = max(start_km * 1.55, min(profile_max_weekly_km * 0.75, max(recent_peak, recent_volume * 1.25)))
    elif recent_peak > 0:
        start_km = max(10.0, recent_volume * 0.90)
        cap = min(profile_max_weekly_km, max(recent_peak * 1.08, recent_volume * 1.25, defaults_floor.get(goal_race, 18.0)))
    else:
        start_km = max(10.0, recent_volume * 0.90)
        cap = min(profile_max_weekly_km, max(recent_volume * 1.35, defaults_floor.get(goal_race, 18.0)))

    cap = max(10.0, min(profile_max_weekly_km, cap))
    start_km = max(6.0, min(start_km, cap))
    return round(cap, 1), round(start_km, 1)


# ── Temperatura attesa e adattamento ritmi al caldo ──────────────────────────
# Climatologia di Roma nelle ore tipiche di corsa (fallback quando lo storico
# dell'atleta non ha abbastanza campioni meteo per quel mese).
ROME_MONTH_TEMP_C = [9.0, 10.0, 13.0, 16.0, 20.0, 25.0, 28.0, 28.0, 24.0, 19.0, 13.0, 10.0]

# Basi climatiche selezionabili nel Genera Piano (°C tipici ore di corsa, gen→dic).
CITY_MONTH_TEMP_C: dict = {
    "roma":     ROME_MONTH_TEMP_C,
    "milano":   [4.0, 7.0, 12.0, 15.0, 20.0, 25.0, 27.0, 26.0, 22.0, 16.0, 9.0, 5.0],
    "torino":   [4.0, 7.0, 12.0, 15.0, 19.0, 24.0, 26.0, 25.0, 21.0, 15.0, 8.0, 5.0],
    "napoli":   [10.0, 11.0, 13.0, 16.0, 20.0, 25.0, 28.0, 28.0, 24.0, 20.0, 15.0, 11.0],
    "bologna":  [4.0, 7.0, 12.0, 16.0, 21.0, 26.0, 28.0, 27.0, 22.0, 16.0, 9.0, 5.0],
    "firenze":  [7.0, 9.0, 12.0, 15.0, 20.0, 25.0, 28.0, 28.0, 23.0, 17.0, 11.0, 8.0],
    "palermo":  [12.0, 12.0, 14.0, 16.0, 20.0, 24.0, 27.0, 28.0, 25.0, 21.0, 17.0, 13.0],
    "cagliari": [11.0, 11.0, 13.0, 15.0, 19.0, 24.0, 27.0, 27.0, 24.0, 20.0, 15.0, 12.0],
}
ITALIAN_MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]


def _predict_race_hot(vdot: float, heat_extra_sec: int) -> dict:
    """Previsioni gara al caldo atteso: tempo ideale + extra s/km × distanza."""
    def _fmt(sec: int) -> str:
        h, rem = divmod(int(sec), 3600)
        m, s = divmod(rem, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    out: dict = {}
    for label, t in (_predict_race(vdot) or {}).items():
        d = RACE_DISTANCES.get(label)
        mins = _parse_time_str(t)
        if not d or not mins or heat_extra_sec <= 0:
            out[label] = t
            continue
        out[label] = _fmt(round(mins * 60 + heat_extra_sec * d))
    return out


def _tp_pace_secs(p) -> Optional[int]:
    """'4:30' → 270 secondi (None se non parsabile)."""
    try:
        mm, ss = str(p).split(":")
        v = int(mm) * 60 + int(ss)
        return v if v > 0 else None
    except Exception:
        return None


def _tp_month_temps_from_runs(runs) -> dict:
    """Mediana della temperatura per mese dallo storico corse dell'atleta.

    Usa apparent_temperature (feels-like) quando disponibile: è ciò che conta
    per la termoregolazione. Serve ≥3 campioni/mese, altrimenti il mese usa
    la climatologia di Roma.
    """
    by_month: dict = {}
    for r in runs or []:
        t = r.get("apparent_temperature")
        if t is None:
            t = r.get("temperature")
        try:
            t = float(t)
        except (TypeError, ValueError):
            continue
        if not (-15.0 <= t <= 45.0):
            continue
        try:
            m = int(str(r.get("date", ""))[5:7])
        except ValueError:
            continue
        if 1 <= m <= 12:
            by_month.setdefault(m, []).append(t)
    out: dict = {}
    for m, vals in by_month.items():
        if len(vals) >= 3:
            vals.sort()
            out[m] = round(vals[len(vals) // 2], 1)
    return out


def _tp_expected_temp(month: int, month_temps: Optional[dict] = None) -> float:
    if month_temps and month in month_temps:
        return float(month_temps[month])
    return ROME_MONTH_TEMP_C[max(1, min(12, month)) - 1]


def _tp_heat_extra_sec(temp_c: Optional[float]) -> int:
    """Secondi/km extra sui ritmi di qualità per il caldo.

    Modello a tratti (Ely et al. 2007 + pratica coaching): nessun effetto ≤15°C;
    +1.2 s/km/°C fino a 22°C; +1.8 s/km/°C tra 22–28°C; +2.5 s/km/°C oltre.
    Es: 25°C → ~+14 s/km (5×1000 @ 3:55 diventa @ ~4:09); 30°C → ~+24 s/km.
    """
    if temp_c is None or temp_c <= 15.0:
        return 0
    extra = (min(temp_c, 22.0) - 15.0) * 1.2
    if temp_c > 22.0:
        extra += (min(temp_c, 28.0) - 22.0) * 1.8
    if temp_c > 28.0:
        extra += (temp_c - 28.0) * 2.5
    return int(round(extra))


def _tp_apply_heat_to_paces(paces: dict, extra_sec: int) -> dict:
    """Applica la correzione caldo: piena sulle qualità, ~60% sui ritmi lenti."""
    if extra_sec <= 0:
        return dict(paces)
    out: dict = {}
    for k, v in (paces or {}).items():
        s = _tp_pace_secs(v)
        if s is None:
            out[k] = v
            continue
        shift = extra_sec if k in ("interval", "repetition", "threshold", "marathon") else int(round(extra_sec * 0.6))
        out[k] = _format_secs(s + shift)
    return out


def _generate_plan_weeks(goal_race: str, weeks_total: int, max_weekly_km: float,
                          current_vdot: float, target_vdot: float,
                          athlete_id, target_time_str: str,
                          start_date_str: str = None,
                          plan_mode: str = "balanced",
                          history_context: Optional[dict] = None,
                          start_weekly_km: Optional[float] = None,
                          month_temps: Optional[dict] = None) -> list:
    """Generate goal-driven periodized plan with weekly VDOT progression.

    `month_temps`: mediana °C per mese dallo storico dell'atleta — ogni
    settimana i ritmi vengono adattati alla temperatura attesa del periodo.
    """
    from datetime import date, timedelta

    weeks_total = max(8, min(int(weeks_total), 32))

    # ── Periodization: phase allocation (Daniels 4-phase model adapted) ──────
    raw_phases = _tp_history_phase_alloc(weeks_total, history_context)
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
    if plan_mode not in PLAN_STRATEGY_CONFIG:
        plan_mode = "balanced"
    strategy = PLAN_STRATEGY_CONFIG[plan_mode]
    max_weekly_km = max_weekly_km * strategy["volume_multiplier"]
    start_factor = 0.50 if plan_mode == "conservative" else 0.60 if plan_mode == "aggressive" else 0.55
    build_factor = 1.05 if plan_mode == "conservative" else 1.10 if plan_mode == "aggressive" else 1.08
    recovery_every = 3 if plan_mode == "conservative" else 5 if plan_mode == "aggressive" else 4
    recovery_drop = 0.58 if plan_mode == "conservative" else 0.72 if plan_mode == "aggressive" else 0.65
    start_km = start_weekly_km if start_weekly_km is not None else max(12.0, max_weekly_km * start_factor)
    start_km = max(6.0, min(float(start_km), max_weekly_km))
    current_km = start_km

    # Use caller-provided start date if valid, otherwise next Monday
    if start_date_str:
        try:
            start_date = date.fromisoformat(start_date_str)
        except ValueError:
            start_date = None
    else:
        start_date = None
    if start_date is None:
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
                (week_in_phase + 1) % recovery_every == 0
            )

            # Volume strategy
            if phase_name == "Taper":
                # Mujika & Padilla (2003): 40-60% volume reduction, maintain intensity
                taper_pct = 0.70 - 0.15 * week_in_phase
                week_km = max_weekly_km * max(0.35, taper_pct)
            elif phase_name == "Gara":
                week_km = max_weekly_km * 0.25
            elif is_recovery:
                week_km = current_km * recovery_drop
            else:
                week_km = min(current_km, max_weekly_km)
                # Bompa periodization: ~7-10% overload per mesocycle week
                current_km = min(current_km * build_factor, max_weekly_km)

            week_km = round(max(10.0, week_km), 1)
            wv = vdot_progression[week_idx] if week_idx < len(vdot_progression) else target_vdot
            paces = _tp_daniels_paces(wv)

            week_start = current_date
            week_end = current_date + timedelta(days=6)

            # Temperatura attesa della settimana → adattamento ritmi al caldo
            exp_temp = _tp_expected_temp((week_start + timedelta(days=3)).month, month_temps)
            heat_extra = _tp_heat_extra_sec(exp_temp)
            paces = _tp_apply_heat_to_paces(paces, heat_extra)

            sessions = _tp_build_sessions(
                week_start, week_km, phase_name, goal_race, paces, wv,
                plan_mode, target_time_str, week_number=week_number,
                expected_temp_c=exp_temp, heat_extra_sec=heat_extra)

            phase_desc = phase_descs.get(phase_name, "")
            if week_number == 1:
                phase_desc += (f" Si parte da {week_km} km/settimana, calibrati sul tuo volume recente; "
                               f"progressione ≤10% a settimana (regola del 10%).")

            weeks.append({
                "athlete_id": athlete_id,
                "week_number": week_number,
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "phase": phase_name,
                "phase_description": phase_desc,
                "target_km": week_km,
                "target_vdot": wv,
                "expected_temp_c": round(exp_temp, 1),
                "heat_pace_adj_sec": heat_extra,
                "is_recovery_week": is_recovery,
                "sessions": sessions,
                "goal_race": goal_race,
                "target_time": target_time_str,
                "plan_mode": plan_mode,
            })

            week_number += 1
            current_date += timedelta(weeks=1)
            week_idx += 1

    return weeks


@app.post("/api/training-plan/generate")
@limiter.limit("10/minute")
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
    plan_mode = body.get("plan_mode") or "balanced"
    if plan_mode not in PLAN_STRATEGY_CONFIG:
        plan_mode = "balanced"
    dry_run = bool(body.get("dry_run"))
    test_distance_km = body.get("test_distance_km") # optional test calibration
    test_time_str = body.get("test_time")            # optional test time
    start_date_str = body.get("start_date") or None  # user-chosen start date (ISO)
    city = str(body.get("city") or "roma").strip().lower()          # base climatica (default Roma)
    start_km_override = _coerce_float(body.get("start_weekly_km"))  # km/sett di partenza scelti dall'utente

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    profile = await db.profile.find_one(q)

    max_hr = int((profile or {}).get("max_hr", 190))
    resting_hr = int((profile or {}).get("resting_hr", 50))
    defaults_km = {"5K": 40.0, "10K": 50.0, "Half Marathon": 60.0, "Marathon": 70.0}
    raw_max_km = (profile or {}).get("max_weekly_km")
    max_weekly_km = float(raw_max_km) if raw_max_km else defaults_km.get(goal_race, 55.0)

    # ── FULL history analysis — escludi tapis roulant da VDOT ─────────────────
    q_gps = {**q, "is_treadmill": {"$ne": True}}
    vdot_projection = {
        "name": 1,
        "date": 1,
        "distance_km": 1,
        "duration_minutes": 1,
        "avg_hr": 1,
        "avg_pace": 1,
        "is_treadmill": 1,
        "strava_id": 1,
        "activity_id": 1,
        "run_type": 1,
        "notes": 1,
        "splits": 1,
        "weather": 1,
        "temperature": 1,
        "apparent_temperature": 1,
        "humidity": 1,
        "wind_speed": 1,
        "temp_min_c": 1,
        "temp_max_c": 1,
    }
    all_runs, ff_latest = await asyncio.gather(
        db.runs.find(q_gps, vdot_projection).sort("date", -1).to_list(None),
        db.fitness_freshness.find_one(q, sort=[("date", -1)]),
    )
    dist_km = RACE_DISTANCES.get(goal_race, 5.0)
    # VDOT del piano: SOLO corse ≥5 km (regola atleta). Le corse brevi con
    # scaling HR gonfiano la stima (es. 4 km serali → VDOT 58 irreale). Le
    # prove sono già normalizzate a temperatura ideale in _vdot_from_effort:
    # il VDOT rappresenta il potenziale al fresco, i ritmi del piano vengono
    # poi RI-adattati al caldo atteso settimana per settimana.
    vdot_runs = [r for r in all_runs if (r.get("distance_km") or 0) >= 4.8]
    if len(vdot_runs) < 2:
        vdot_runs = all_runs  # fallback nuovi runner con poco storico
    history = _calc_vdot_with_history(vdot_runs, max_hr, weeks_window=8, goal_dist_km=dist_km, resting_hr=resting_hr)
    history_context = _build_training_history_context(all_runs, history, ff_latest, max_hr=max_hr)
    # current_vdot is ALWAYS the same regardless of goal distance —
    # it's derived from best recent runs (all qualifying distances).
    # race_specific_vdot was causing different VDOT per distance → removed.
    current_vdot = history["current"] or 30.0
    current_vdot = _apply_stop_adjustment_to_vdot(current_vdot, history_context)
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

    strategy_options = _build_strategy_options(
        current_vdot, original_target_vdot, weeks_to_race, feasibility, history_context
    )

    if feasibility.get("suggested_weeks"):
        w = feasibility["suggested_weeks"]
        m = feasibility.get("suggested_months", 0)
        feasibility["suggested_timeframe"] = f"{w} settimane" if w <= 4 or m < 2 else f"circa {m} mesi ({w} settimane)"

    # ── Volume: partenza dal volume recente (regola del 10%), override utente ─
    max_weekly_km, start_weekly_km = _calibrate_plan_volume(goal_race, max_weekly_km, history_context)
    recent_weekly_km = float(history_context.get("weekly_volume_4w", 0) or history.get("weekly_volume") or 0)
    if start_km_override and start_km_override > 0:
        start_weekly_km = round(max(8.0, min(float(start_km_override), max_weekly_km)), 1)

    # ── Clima: città scelta (default Roma). Con Roma, la mediana °C mensile
    # dello storico reale dell'atleta raffina la climatologia.
    city_table = CITY_MONTH_TEMP_C.get(city) or CITY_MONTH_TEMP_C["roma"]
    month_temps = {m + 1: float(city_table[m]) for m in range(12)}
    if city == "roma" or city not in CITY_MONTH_TEMP_C:
        month_temps.update(_tp_month_temps_from_runs(all_runs))

    # Anteprima clima del periodo di piano + gara (fine piano)
    try:
        plan_start = dt.date.fromisoformat(start_date_str) if start_date_str else dt.date.today()
    except ValueError:
        plan_start = dt.date.today()
    climate_months, seen_months = [], set()
    for wk in range(suggested_weeks):
        m = (plan_start + dt.timedelta(weeks=wk, days=3)).month
        if m in seen_months:
            continue
        seen_months.add(m)
        t = _tp_expected_temp(m, month_temps)
        climate_months.append({"month": m, "label": ITALIAN_MONTHS[m - 1],
                               "temp_c": round(t, 1), "heat_adj_sec": _tp_heat_extra_sec(t)})
    race_date_est = plan_start + dt.timedelta(weeks=suggested_weeks)
    race_temp = _tp_expected_temp(race_date_est.month, month_temps)
    race_heat_sec = _tp_heat_extra_sec(race_temp)
    climate_payload = {
        "city": city,
        "months": climate_months,
        "race_month_label": ITALIAN_MONTHS[race_date_est.month - 1],
        "race_temp_c": round(race_temp, 1),
        "race_heat_adj_sec": race_heat_sec,
    }
    predictions_ideal = _predict_race(effective_target_vdot)
    predictions_expected = _predict_race_hot(effective_target_vdot, race_heat_sec)

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "weeks_generated": 0,
            "current_vdot": current_vdot,
            "target_vdot": effective_target_vdot,
            "peak_vdot": peak_vdot,
            "peak_date": history["peak_date"],
            "peak_source": history.get("peak_source"),
            "training_months": history["training_months"],
            "weekly_volume": history["weekly_volume"],
            "history_context": history_context,
            "test_vdot": test_vdot,
            "plan_mode": None,
            "strategy_options": strategy_options,
            "feasibility": feasibility,
            "start_weekly_km": start_weekly_km,
            "peak_weekly_km": max_weekly_km,
            "recent_weekly_km": round(recent_weekly_km, 1),
            "climate": climate_payload,
            "race_predictions": predictions_ideal,
            "race_predictions_expected": predictions_expected,
            "suggested_weeks": feasibility.get("suggested_weeks"),
            "suggested_months": feasibility.get("suggested_months"),
            "suggested_timeframe": feasibility.get("suggested_timeframe"),
        }

    # ── Generate the plan ────────────────────────────────────────────────────
    weeks = _generate_plan_weeks(
        goal_race, suggested_weeks, max_weekly_km,
        current_vdot, effective_target_vdot, athlete_id, target_time_str,
        start_date_str=start_date_str,
        plan_mode=plan_mode,
        history_context=history_context,
        start_weekly_km=start_weekly_km,
        month_temps=month_temps,
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
        "plan_mode": plan_mode,
        "plan_history_context": history_context,
        "plan_start_weekly_km": start_weekly_km,
        "plan_peak_weekly_km": max_weekly_km,
        "plan_city": city,
        "plan_generated_at": dt.datetime.now().isoformat(),
        "plan_last_auto_adapt": None,
        "plan_last_auto_adapt_run_key": None,
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
        "start_weekly_km": start_weekly_km,
        "peak_weekly_km": max_weekly_km,
        "recent_weekly_km": round(recent_weekly_km, 1),
        "climate": climate_payload,
        "current_vdot": current_vdot,
        "target_vdot": effective_target_vdot,
        "peak_vdot": peak_vdot,
        "peak_date": history["peak_date"],
        "peak_source": history.get("peak_source"),
        "training_months": history["training_months"],
        "weekly_volume": history["weekly_volume"],
        "history_context": history_context,
        "test_vdot": test_vdot,
        "plan_mode": plan_mode,
        "strategy_options": strategy_options,
        "feasibility": feasibility,
        "race_predictions": predictions_ideal,
        "race_predictions_expected": predictions_expected,
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
    resting_hr = int((profile or {}).get("resting_hr", 50))
    history = _calc_vdot_with_history(all_runs, max_hr, weeks_window=8, goal_dist_km=dist_km, resting_hr=resting_hr)

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
    resting_hr = int((profile or {}).get("resting_hr", 50))

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
    vdot_all = _calc_vdot(recent_runs, max_hr, resting_hr=resting_hr)
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
    if triggered_count > 0:
        await publish_event({"type": "training_adapted", "triggered": triggered_count, "weeks": weeks_mod})
    return {
        "ok": True,
        "adaptations": adaptations,
        "weeks_modified": weeks_mod,
        "sessions_modified": sessions_mod,
        "triggered_count": triggered_count,
    }


async def _auto_adapt_plan_after_sync(athlete_id) -> Optional[dict]:
    """Adapt the active plan after a Strava sync using real training behavior.

    It is intentionally idempotent for repeated syncs with the same latest run:
    paces can be recalibrated from VDOT drift, future volume follows the last
    14 days of real km vs planned km, and high TSB fatigue softens intensity.
    """
    from datetime import date, timedelta

    q = {"athlete_id": athlete_id} if athlete_id else {}
    profile = await db.profile.find_one(q)
    if not profile:
        return None

    max_hr = int(profile.get("max_hr", 190))
    resting_hr = int(profile.get("resting_hr", 50))
    runs = await db.runs.find(q).sort("date", -1).to_list(500)
    actual_vdot = _calc_vdot(runs, max_hr, resting_hr=resting_hr)
    if not actual_vdot:
        return None

    all_weeks = await db.training_plan.find(q).sort("week_number", 1).to_list(100)
    if not all_weeks:
        return None

    today = date.today()
    today_s = today.isoformat()
    latest_run = runs[0] if runs else None
    latest_run_key = None
    if latest_run:
        latest_run_key = ":".join([
            str(latest_run.get("strava_id") or latest_run.get("_id") or ""),
            str(latest_run.get("date") or ""),
            str(latest_run.get("distance_km") or ""),
            str(latest_run.get("duration_minutes") or ""),
        ])

    if latest_run_key and latest_run_key == profile.get("plan_last_auto_adapt_run_key"):
        result = {
            "ok": True,
            "actual_vdot": actual_vdot,
            "action": "already_current",
            "weeks_updated": 0,
            "message": "Nessuna nuova corsa Strava da usare per riadattare il piano.",
        }
        await db.profile.update_one(q, {"$set": {"plan_current_vdot": actual_vdot}})
        return result

    current_week = next(
        (w for w in all_weeks if w.get("week_start", "") <= today_s <= w.get("week_end", "")),
        None,
    )
    anchor_week = current_week or next(
        (w for w in all_weeks if w.get("week_start", "") > today_s),
        all_weeks[-1],
    )

    expected_vdot = float(anchor_week.get("target_vdot") or profile.get("plan_current_vdot") or actual_vdot)
    target_vdot_plan = float(profile.get("plan_target_vdot") or expected_vdot)
    delta = round(actual_vdot - expected_vdot, 2)

    await _ensure_fitness_freshness_current(athlete_id)
    ff_doc = await db.fitness_freshness.find_one(q, sort=[("date", -1)])
    ff_doc = _project_fitness_freshness_doc(ff_doc) or ff_doc
    tsb = float(ff_doc.get("tsb", 0)) if ff_doc else 0.0
    atl = float(ff_doc.get("atl", 0)) if ff_doc else 0.0

    window_start = (today - timedelta(days=14)).isoformat()

    def as_float(value, default: float = 0.0) -> float:
        try:
            return float(value or default)
        except (TypeError, ValueError):
            return default

    def pace_minutes(pace: Optional[str]) -> Optional[float]:
        if not pace or ":" not in pace:
            return None
        try:
            m, s = pace.split(":", 1)
            return int(m) + int(s) / 60.0
        except (TypeError, ValueError):
            return None

    def refresh_duration(session: dict) -> None:
        pace_min = pace_minutes(session.get("target_pace"))
        distance = as_float(session.get("target_distance_km"))
        if pace_min and distance > 0:
            session["target_duration_min"] = round(distance * pace_min)

    planned_14_km = 0.0
    planned_sessions = 0
    for w in all_weeks:
        for s in w.get("sessions", []):
            if s.get("type") == "rest":
                continue
            session_date = str(s.get("date") or w.get("week_start") or "")
            if window_start <= session_date <= today_s:
                planned_14_km += as_float(s.get("target_distance_km"))
                planned_sessions += 1

    actual_14_km = sum(
        as_float(r.get("distance_km"))
        for r in runs
        if window_start <= str(r.get("date") or "") <= today_s
    )
    compliance_ratio = round(actual_14_km / planned_14_km, 2) if planned_14_km >= 3 else None

    volume_scale = 1.0
    compliance_reason = None
    if compliance_ratio is not None:
        if compliance_ratio < 0.55:
            volume_scale = 0.82
            compliance_reason = "low_compliance"
        elif compliance_ratio < 0.80:
            volume_scale = 0.92
            compliance_reason = "partial_compliance"
        elif compliance_ratio > 1.45:
            volume_scale = 0.88
            compliance_reason = "too_much_load"
        elif compliance_ratio > 1.20:
            volume_scale = 0.95
            compliance_reason = "high_load"

    fatigue_scale = 1.0
    fatigue_reason = None
    if tsb < -18:
        fatigue_scale = 0.82
        fatigue_reason = "high_fatigue"
    elif tsb < -10:
        fatigue_scale = 0.92
        fatigue_reason = "moderate_fatigue"

    distance_scale = min(volume_scale, fatigue_scale)
    pace_recalibration = abs(delta) >= 0.5
    reasons = []
    if pace_recalibration:
        reasons.append("vdot_ahead" if delta > 0 else "vdot_behind")
    if compliance_reason:
        reasons.append(compliance_reason)
    if fatigue_reason:
        reasons.append(fatigue_reason)

    result = {
        "ok": True,
        "actual_vdot": actual_vdot,
        "expected_vdot": expected_vdot,
        "delta": delta,
        "actual_14_km": round(actual_14_km, 1),
        "planned_14_km": round(planned_14_km, 1),
        "planned_sessions": planned_sessions,
        "compliance_ratio": compliance_ratio,
        "tsb": round(tsb, 1),
        "atl": round(atl, 1),
        "action": "none",
        "weeks_updated": 0,
        "reasons": reasons,
    }

    async def store_result() -> None:
        update = {
            "plan_current_vdot": actual_vdot,
            "plan_last_auto_adapt": result,
            "plan_last_auto_adapt_at": dt.datetime.now().isoformat(),
        }
        if latest_run_key:
            update["plan_last_auto_adapt_run_key"] = latest_run_key
        await db.profile.update_one(q, {"$set": update})

    if not reasons:
        result["action"] = "within_tolerance"
        await store_result()
        return result

    future_weeks = [w for w in all_weeks if w.get("week_end", "") >= today_s]
    if not future_weeks:
        result["action"] = "no_future_weeks"
        await store_result()
        return result

    updated = 0
    sessions_updated = 0
    softened_quality = False
    for w in future_weeks:
        old_wv = float(w.get("target_vdot") or expected_vdot)
        new_wv = old_wv
        if pace_recalibration:
            new_wv = round(old_wv + delta, 2)
            if delta > 0:
                new_wv = min(new_wv, target_vdot_plan + 1.0)
            else:
                new_wv = max(new_wv, actual_vdot - 1.0)

        new_paces = _tp_daniels_paces(new_wv)
        pace_map = {
            "easy": new_paces.get("easy"),
            "long": new_paces.get("easy"),
            "tempo": new_paces.get("threshold"),
            "intervals": new_paces.get("interval"),
        }

        sessions = [dict(s) for s in w.get("sessions", [])]
        week_modified = False
        for s in sessions:
            if s.get("type") == "rest" or s.get("completed"):
                continue
            session_date = str(s.get("date") or w.get("week_start") or "")
            if session_date and session_date < today_s:
                continue

            if fatigue_reason == "high_fatigue" and not softened_quality and s.get("type") in ("tempo", "intervals"):
                previous_title = s.get("title") or "Qualita"
                s["type"] = "easy"
                s["title"] = "Recupero Attivo (auto-sync)"
                s["description"] = (
                    f"Auto-adattato dopo sync Strava: TSB {tsb:.1f}. "
                    f"{previous_title} trasformata in corsa facile."
                )
                softened_quality = True
                week_modified = True

            if pace_recalibration:
                np = pace_map.get(s.get("type"))
                if np and s.get("target_pace") != np:
                    s["target_pace"] = np
                    refresh_duration(s)
                    week_modified = True

            if distance_scale < 0.995 and as_float(s.get("target_distance_km")) > 0:
                old_distance = as_float(s.get("target_distance_km"))
                s["target_distance_km"] = round(max(1.0, old_distance * distance_scale), 1)
                refresh_duration(s)
                week_modified = True

        if not week_modified and abs(new_wv - old_wv) < 0.2:
            continue

        new_target_km = round(sum(
            as_float(s.get("target_distance_km"))
            for s in sessions
            if s.get("type") != "rest"
        ), 1)
        await db.training_plan.update_one(
            {"athlete_id": athlete_id, "week_number": w["week_number"]},
            {"$set": {"target_vdot": new_wv, "sessions": sessions, "target_km": new_target_km}},
        )
        updated += 1
        sessions_updated += sum(1 for s in sessions if s.get("type") != "rest")

    if pace_recalibration:
        result["action"] = "recalibrated_ahead" if delta > 0 else "recalibrated_behind"
    elif compliance_reason or fatigue_reason:
        result["action"] = "volume_or_fatigue_adjusted"
    result["weeks_updated"] = updated
    result["sessions_updated"] = sessions_updated
    result["distance_scale"] = round(distance_scale, 2)

    await store_result()
    return result


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
    resting_hr = int(profile.get("resting_hr", 50))
    runs = await db.runs.find(q).sort("date", -1).to_list(500)
    actual_vdot = _calc_vdot(runs, max_hr, resting_hr=resting_hr)
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
    await _ensure_fitness_freshness_current(athlete_id)
    cursor = db.fitness_freshness.find(q).sort("date", 1)
    docs = await cursor.to_list(length=1000)

    current = None
    if docs:
        latest = _project_fitness_freshness_doc(docs[-1]) or docs[-1]
        docs[-1] = latest
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
    await _invalidate_analytics_cache(athlete_id)
    await _invalidate_runner_dna_cache(athlete_id)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
#  ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

def _coerce_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
            if not value:
                return None
        v = float(value)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def _run_date_obj(run: dict) -> Optional[dt.date]:
    value = run.get("date")
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, str):
        try:
            return dt.date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _vdot_recency_weight(run: dict, as_of: Optional[dt.date] = None) -> float:
    run_date = _run_date_obj(run)
    if not run_date:
        return 1.0
    anchor = as_of or dt.date.today()
    age_days = max(0, (anchor - run_date).days)
    return math.exp(-VDOT_RECENCY_DECAY_LAMBDA * age_days)


def _weather_value(run: dict, *keys: str) -> Optional[float]:
    for key in keys:
        v = _coerce_float(run.get(key))
        if v is not None:
            return v
    weather = run.get("weather")
    if isinstance(weather, dict):
        for key in keys:
            v = _coerce_float(weather.get(key))
            if v is not None:
                return v
    return None


def _environmental_pace_adjustment_sec_per_km(run: dict) -> float:
    """Estimate seconds/km lost to non-ideal weather when data is available."""
    temp = _weather_value(run, "apparent_temperature", "apparent", "feels_like")
    if temp is None:
        temp = _weather_value(run, "temperature", "temp_c")
    if temp is None:
        tmin = _weather_value(run, "temp_min_c")
        tmax = _weather_value(run, "temp_max_c")
        if tmin is not None and tmax is not None:
            temp = (tmin + tmax) / 2
    humidity = _weather_value(run, "humidity", "relative_humidity")
    wind = _weather_value(run, "wind_speed", "wind", "wind_speed_10m")

    if temp is None and humidity is None and wind is None:
        return 0.0

    effective_temp = temp if temp is not None else 10.0
    humidity = humidity if humidity is not None else 60.0
    wind = wind if wind is not None else 8.0
    distance_factor = max(0.6, min(1.35, float(run.get("distance_km") or 0) / 10.0))

    heat_penalty = max(0.0, effective_temp - 18.0) * 1.9
    cold_penalty = max(0.0, 5.0 - effective_temp) * 0.7
    humidity_penalty = max(0.0, humidity - 65.0) * 0.16
    wind_penalty = max(0.0, wind - 18.0) * 0.18
    synergy_penalty = (
        ((effective_temp - 22.0) * (humidity - 70.0)) / 85.0
        if effective_temp > 22.0 and humidity > 70.0
        else 0.0
    )
    return max(0.0, min(35.0, (heat_penalty + cold_penalty + humidity_penalty + wind_penalty + synergy_penalty) * distance_factor))


def _is_interval_session(run: dict) -> bool:
    text = " ".join(
        str(run.get(key) or "").lower()
        for key in ("run_type", "name", "notes")
    )
    keys = ("interval", "ripet", "repeat", "vo2", "fartlek", "800", "1000", "400")
    if any(k in text for k in keys):
        return True

    full_splits = [
        s for s in (run.get("splits") or [])
        if _coerce_float(s.get("distance")) and _coerce_float(s.get("distance")) >= 900
    ]
    if len(full_splits) < 4:
        return False

    paces = []
    for split in full_splits:
        pace = split.get("pace")
        if isinstance(pace, str) and ":" in pace:
            try:
                m, s = pace.split(":")[:2]
                paces.append(int(m) * 60 + int(s))
            except (TypeError, ValueError):
                continue
        else:
            elapsed = _coerce_float(split.get("elapsed_time"))
            distance = _coerce_float(split.get("distance"))
            if elapsed and distance and distance > 0:
                paces.append(elapsed / (distance / 1000.0))

    if len(paces) < 4:
        return False

    spread = max(paces) - min(paces)
    adjacent_swings = sum(1 for a, b in zip(paces, paces[1:]) if abs(a - b) >= 18)
    alternating = sum(
        1 for a, b, c in zip(paces, paces[1:], paces[2:])
        if (a < b > c) or (a > b < c)
    )
    return spread >= 25 and adjacent_swings >= 2 and alternating >= 1


def _vdot_from_effort(
    run: dict,
    dist_km: float,
    duration_min: float,
    pace_s: float,
    avg_hr: Optional[float],
    max_hr: int,
) -> Optional[float]:
    if dist_km < 3 or dist_km > 21:
        return None
    if pace_s < 150 or pace_s > 540:
        return None
    if duration_min < 10:
        return None

    # ── Layer 2: GAP (grade-adjusted pace) ───────────────────────────────────
    # Use flat-equivalent pace so downhill runs don't inflate VDOT and uphill
    # runs don't deflate it. _gap_pace_seconds returns None when no elevation
    # data is available, in which case we fall back to the raw pace.
    gap_s = _gap_pace_seconds(run)
    base_pace_s = gap_s if (gap_s and 150 <= gap_s <= 600) else pace_s

    # ── Layer 1: environmental normalization (temp/humidity/wind) ─────────────
    # Convert the effort to its cool, calm-weather equivalent pace.
    environmental_delta = _environmental_pace_adjustment_sec_per_km(run)
    corrected_pace_s = max(150.0, base_pace_s - environmental_delta)
    speed_mpm = 60000 / corrected_pace_s
    vo2 = -4.60 + 0.182258 * speed_mpm + 0.000104 * speed_mpm ** 2

    pct_max_duration = (0.8 + 0.1894393 * math.exp(-0.012778 * duration_min)
                        + 0.2989558 * math.exp(-0.1932605 * duration_min))

    # ── Layer 3: HR as validator, not blind driver ───────────────────────────
    # A sub-maximal tempo run legitimately implies a HIGHER VDOT than its pace
    # alone (run easy, high engine). HR scaling unlocks that. We deliberately do
    # NOT clamp the HR-scaled value to the pace-only ceiling — that would strip
    # the real signal out of every tempo/threshold run and understate VDOT.
    # Unreliable HR (sensor dropout) is handled downstream by per-run confidence
    # weighting and the confidence-gated recency anchor, not by clipping here.
    if avg_hr and max_hr > 0:
        hr_pct = avg_hr / max_hr
        if hr_pct < 0.75:
            return None
        if hr_pct >= 0.92:
            pct_max = pct_max_duration
        else:
            pct_max = max(0.55, min(1.0, hr_pct - 0.02))
            if duration_min >= 15:
                pct_max = min(pct_max_duration, pct_max)
    else:
        pct_max = pct_max_duration

    if pct_max <= 0:
        return None
    return vo2 / pct_max


def _interval_vdot_from_splits(run: dict, max_hr: int) -> Optional[float]:
    if not _is_interval_session(run):
        return None
    full_splits = [
        s for s in (run.get("splits") or [])
        if _coerce_float(s.get("distance")) and _coerce_float(s.get("distance")) >= 900
        and _coerce_float(s.get("elapsed_time")) and _coerce_float(s.get("elapsed_time")) > 0
    ]
    if len(full_splits) < 3:
        return None

    candidates = []
    max_k = min(6, len(full_splits))
    for k in range(3, max_k + 1):
        for i in range(len(full_splits) - k + 1):
            window = full_splits[i:i + k]
            dist_km = sum(float(s.get("distance") or 0) for s in window) / 1000.0
            elapsed_s = sum(float(s.get("elapsed_time") or 0) for s in window)
            if dist_km < 3 or elapsed_s <= 0:
                continue
            pace_s = elapsed_s / dist_km
            hr_values = [_coerce_float(s.get("hr")) for s in window]
            hr_values = [h for h in hr_values if h is not None]
            split_hr = sum(hr_values) / len(hr_values) if hr_values else run.get("avg_hr")
            vdot = _vdot_from_effort(run, dist_km, elapsed_s / 60.0, pace_s, split_hr, max_hr)
            if vdot:
                candidates.append(vdot)

    return max(candidates) if candidates else None


def _vdot_from_run(r: dict, max_hr: int = 190, resting_hr: int = 50) -> Optional[float]:
    """Calculate VDOT from a single run — Daniels VO2 (2013) + HR-based effort correction.

    Scientific basis:
    - Daniels: VO2 = -4.60 + 0.182258·v + 0.000104·v²   (v in m/min)
    - Daniels duration-%VO2max: %max(t) = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)
      This assumes a *race effort*. For sub-maximal training runs it overstates %VO2max
      and therefore *under*-estimates VDOT.
    - Karvonen %HRR ≈ %VO2max (Swain & Leutholtz 1997, ACSM). Used when resting HR known.
    - Swain 1994 linear: %VO2max = 1.1094·%HRmax − 0.142.  Fallback when resting HR absent.

    Logic:
    - Reject obvious non-efforts (easy/recovery) via HRmax% < 75%.
    - Near-max effort (HR% ≥ 92% OR no HR data) → use Daniels race-effort %VO2max(t).
    - Sub-max effort (HR% 75–92%) → use HR-derived %VO2max. This is the fix that
      unlocks VDOT from tempo/threshold runs, not only races.
    - Gates: distanza 4–21km, passo 2:30–9:00/km, durata ≥10min.
    """
    # Tapis roulant: escludi da tutte le metriche (nessun GPS, passo non affidabile)
    if r.get("is_treadmill"):
        return None
    dist = r.get("distance_km", 0)
    if dist < 3 or dist > 21:
        return None
    pace_str = r.get("avg_pace", "")
    if not pace_str or ":" not in pace_str:
        return None
    try:
        parts = pace_str.split(":")
        pace_s = int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None
    duration_min = r.get("duration_minutes", 0) or 0
    avg_hr = r.get("avg_hr")
    # HR steady-state: il primo split include il ramp-up cardiaco (HR insegue
    # il VO2 per ~2-3 min), quindi l'HR medio dell'intera corsa sottostima lo
    # sforzo su run brevi → %VO2max troppo bassa → VDOT gonfiato di 2-4 punti
    # su tempo da 4-5km. Escludi il primo split quando ci sono dati a
    # sufficienza; mai abbassare sotto l'avg ufficiale (corse in fade).
    split_hrs = [_coerce_float(s.get("hr")) for s in (r.get("splits") or [])]
    split_hrs = [h for h in split_hrs if h]
    if avg_hr and len(split_hrs) >= 3:
        steady_hr = sum(split_hrs[1:]) / len(split_hrs[1:])
        avg_hr = max(avg_hr, steady_hr)
    total_vdot = _vdot_from_effort(r, dist, duration_min, pace_s, avg_hr, max_hr)
    interval_vdot = _interval_vdot_from_splits(r, max_hr)
    candidates = [v for v in (total_vdot, interval_vdot) if v]
    return max(candidates) if candidates else None

def _run_cardiac_drift_pct(run: dict) -> Optional[float]:
    """Pa:HR decoupling between first and second half of a run (% drift).

    Pace-adjusted (effort = HR x pace_sec, proportional to HR/speed): real
    cardiac drift is HR climbing AT THE SAME pace (heat, dehydration, fatigue).
    An intentional negative split raises HR because pace drops — that is NOT
    drift and must not be penalised (e.g. tempo progressivo 4:23 -> 4:15 with
    HR 147 -> 159 = ~3% decoupling, not 8% raw-HR drift). Falls back to raw HR
    drift when splits carry no usable pace. Returns None without HR data.
    """
    splits = [s for s in (run.get("splits") or []) if _coerce_float(s.get("hr"))]
    if len(splits) < 4:
        return None
    half = len(splits) // 2

    def _split_pace_sec(s: dict) -> Optional[float]:
        p = s.get("pace")
        if isinstance(p, str) and ":" in p:
            try:
                m, sec = p.split(":")[:2]
                return int(m) * 60 + int(sec)
            except (TypeError, ValueError):
                pass
        elapsed = _coerce_float(s.get("elapsed_time"))
        dist = _coerce_float(s.get("distance"))
        if elapsed and dist and dist > 0:
            return elapsed / (dist / 1000.0)
        return None

    def _half_effort(rows: list) -> Optional[float]:
        vals = []
        for s in rows:
            hr = _coerce_float(s.get("hr"))
            pace = _split_pace_sec(s)
            if hr and pace:
                vals.append(hr * pace)
        return sum(vals) / len(vals) if vals else None

    e1 = _half_effort(splits[:half])
    e2 = _half_effort(splits[half:])
    if e1 and e2 and e1 > 0:
        return (e2 - e1) / e1 * 100.0

    def _avg_hr(rows: list) -> Optional[float]:
        vals = [_coerce_float(s.get("hr")) for s in rows if _coerce_float(s.get("hr"))]
        return sum(vals) / len(vals) if vals else None

    h1 = _avg_hr(splits[:half])
    h2 = _avg_hr(splits[half:])
    if not h1 or not h2 or h1 <= 0:
        return None
    return (h2 - h1) / h1 * 100.0


def _run_vdot_confidence(run: dict, max_hr: int = 190) -> float:
    """Per-run reliability of the VDOT estimate, 0.2..1.0.

    Down-weights runs whose pace or HR is contaminated by confounders the model
    cannot fully correct: missing GPS, sparse splits, high cardiac drift,
    implausible HR (sensor fault), un-correctable heat, and short samples.
    A confident clean tempo run scores ~1.0; a short no-GPS run with a glitchy
    HR trace scores near the 0.2 floor and barely moves the fused VDOT.
    """
    c = 1.0
    if not _run_has_gps(run):
        c *= 0.5
    splits = run.get("splits") or []
    if len(splits) < 3:
        c *= 0.8

    drift = _run_cardiac_drift_pct(run)
    if drift is not None:
        if drift > 8:
            c *= 0.6
        elif drift > 5:
            c *= 0.8

    avg_hr = _coerce_float(run.get("avg_hr"))
    if avg_hr is not None and (avg_hr > max_hr + 3 or avg_hr < 90):
        c *= 0.55  # sensor fault: HR above max or implausibly low on a hard run

    temp = _weather_value(run, "apparent_temperature", "temperature", "temp_c")
    if temp is None:
        d = _run_date_obj(run)
        if d and d.month in (6, 7, 8):
            c *= 0.85  # suspected summer heat we couldn't correct

    dist = _coerce_float(run.get("distance_km")) or 0.0
    if dist < 4:
        c *= 0.7

    return max(0.2, min(1.0, c))


def _calc_vdot(runs: list, max_hr: int = 190, weeks_window: int = 8,
               resting_hr: int = 50, as_of: Optional[dt.date] = None) -> Optional[float]:
    """Estimate current VDOT (backward compat wrapper)."""
    h = _calc_vdot_with_history(runs, max_hr, weeks_window, resting_hr=resting_hr, as_of=as_of)
    return h["current"]


def _calc_vdot_with_history(runs: list, max_hr: int = 190,
                             weeks_window: int = 8,
                             goal_dist_km: float = 0,
                             resting_hr: int = 50,
                             as_of: Optional[dt.date] = None) -> dict:
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
        v = _vdot_from_run(r, max_hr, resting_hr)
        if v:
            run_vdots.append((r, min(v, 65.0)))

    if not run_vdots:
        return {"current": None, "peak": None, "peak_date": None,
                "peak_source": None, "training_months": 0, "weekly_volume": 0,
                "race_specific_vdot": None}

    today = as_of or _dt.date.today()
    def _top_avg(values, n=3):
        sorted_vals = sorted(values, reverse=True)
        top = sorted_vals[:n]
        return sum(top) / len(top) if top else None

    def _weighted_top_current(candidates, top_n=6):
        if not candidates:
            return None
        relevant = [
            item for item in candidates
            if _vdot_recency_weight(item[0], today) >= 0.35
        ]
        if len(relevant) >= 2:
            candidates = relevant
        ranked = sorted(candidates, key=lambda item: item[1], reverse=True)[:top_n]
        weighted_sum = 0.0
        total_weight = 0.0
        for run, value in ranked:
            # weight = recency × per-run reliability (confounder-aware)
            w = _vdot_recency_weight(run, today) * _run_vdot_confidence(run, max_hr)
            weighted_sum += value * w
            total_weight += w
        return weighted_sum / total_weight if total_weight > 0 else None

    def _recent_anchor(candidates):
        cutoff = today - _dt.timedelta(days=VDOT_RECENT_ANCHOR_DAYS)
        # Only let a recent run anchor the estimate if it is reliable enough —
        # a glitchy/no-GPS spike must not drag current VDOT up on its own.
        recent_values = [
            value for run, value in candidates
            if (_run_date_obj(run) or _dt.date.min) >= cutoff
            and _run_vdot_confidence(run, max_hr) >= 0.6
        ]
        # Corroborazione: il SECONDO massimo, non il massimo. Una singola
        # uscita anomala (4km in giornata umida con grosso credito caldo) non
        # puo' settare il VDOT globale da sola; con un solo campione recente
        # lascia decidere la media pesata.
        if len(recent_values) >= 2:
            return sorted(recent_values)[-2]
        return None

    cutoff_16w = (today - _dt.timedelta(weeks=16)).isoformat()

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

    # Current: capacity estimate from the best recent samples, with exponential
    # recency decay (30-day-old run weighs 0.70). This avoids hard 8-week cliffs.
    if run_vdots and len(run_vdots) >= 2:
        current = _weighted_top_current(run_vdots)
        anchor = _recent_anchor(run_vdots)
        if anchor:
            current = max(current or anchor, anchor)
    else:
        current = max(v for _, v in run_vdots) if run_vdots else None
    current = round(current, 1) if current else None

    # Peak: all-time best
    peak_run, peak_val = max(run_vdots, key=lambda x: x[1])
    peak = round(peak_val, 1)
    peak_date = peak_run.get("date", "")
    peak_source = {
        "date": peak_date,
        "name": peak_run.get("name"),
        "distance_km": peak_run.get("distance_km"),
        "duration_minutes": peak_run.get("duration_minutes"),
        "avg_pace": peak_run.get("avg_pace"),
        "avg_hr": peak_run.get("avg_hr"),
        "strava_id": peak_run.get("strava_id") or peak_run.get("activity_id"),
    }

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
    volume_cutoff = (today - _dt.timedelta(weeks=weeks_window)).isoformat()
    recent_runs = [r for r in runs if r.get("date", "") >= volume_cutoff]
    recent_km = sum(r.get("distance_km", 0) for r in recent_runs)
    weekly_volume = round(recent_km / max(1, weeks_window), 1)

    # ── Overall reliability + uncertainty band ───────────────────────────────
    # The band widens when the contributing runs are noisy (low confidence) or
    # disagree with each other (high spread). Surfaced as "VDOT 52 ±1.5 · MEDIA".
    ranked_all = sorted(run_vdots, key=lambda x: x[1], reverse=True)[:6]
    confidence = 0.0
    band = None
    range_low = range_high = None
    if ranked_all and current:
        confs = [_run_vdot_confidence(r, max_hr) for r, _ in ranked_all]
        vals = [v for _, v in ranked_all]
        confidence = round(sum(confs) / len(confs), 2)
        if len(vals) >= 2:
            mean_v = sum(vals) / len(vals)
            stdev_v = (sum((x - mean_v) ** 2 for x in vals) / len(vals)) ** 0.5
        else:
            stdev_v = 0.0
        band = round(1.0 + (1.0 - confidence) * 2.5 + stdev_v * 0.5, 1)
        range_low = round(current - band, 1)
        range_high = round(current + band, 1)
    confidence_label = (
        "alta" if confidence >= 0.75 else "media" if confidence >= 0.5 else "bassa"
    )

    return {
        "current": current,
        "peak": peak,
        "peak_date": peak_date,
        "peak_source": peak_source,
        "training_months": training_months,
        "weekly_volume": weekly_volume,
        "race_specific_vdot": race_specific_vdot,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "band": band,
        "range_low": range_low,
        "range_high": range_high,
    }


def _build_training_history_context(runs: list, history: dict, ff_latest: Optional[dict] = None,
                                    as_of: Optional[dt.date] = None,
                                    max_hr: int = 190) -> dict:
    """Summarize past training into knobs the plan generator can actually use."""
    today = as_of or dt.date.today()
    dated_runs = [(r, _run_date_obj(r)) for r in runs if _run_date_obj(r)]
    dated_runs.sort(key=lambda item: item[1])

    if not dated_runs:
        return {
            "days_since_last_run": 999,
            "longest_stop_days_6m": 999,
            "weekly_volume_4w": 0.0,
            "weekly_volume_8w": 0.0,
            "recent_peak_weekly_km": 0.0,
            "quality_sessions_8w": 0,
            "interval_sessions_8w": 0,
            "tempo_sessions_8w": 0,
            "long_runs_8w": 0,
            "easy_ratio_8w": 0.0,
            "aerobic_base_score": 0,
            "readiness_score": 15,
            "training_status": "no_recent_data",
            "load": {"ctl": 0.0, "atl": 0.0, "tsb": 0.0},
        }

    def _km_in_window(days: int) -> float:
        cutoff = today - dt.timedelta(days=days)
        return sum(float(r.get("distance_km") or 0) for r, d in dated_runs if d >= cutoff)

    def _week_key(day: dt.date) -> str:
        monday = day - dt.timedelta(days=day.weekday())
        return monday.isoformat()

    last_run_date = dated_runs[-1][1]
    days_since_last_run = max(0, (today - last_run_date).days)

    six_months_ago = today - dt.timedelta(days=183)
    recent_dates = [d for _, d in dated_runs if d >= six_months_ago]
    longest_gap = 0
    prev = six_months_ago
    for d in recent_dates:
        longest_gap = max(longest_gap, (d - prev).days - 1)
        prev = d
    longest_gap = max(longest_gap, (today - prev).days)

    cutoff_8w = today - dt.timedelta(weeks=8)
    recent_runs = [(r, d) for r, d in dated_runs if d >= cutoff_8w]
    weekly_volume_4w = round(_km_in_window(28) / 4, 1)
    weekly_volume_8w = round(_km_in_window(56) / 8, 1)

    weekly_totals: dict[str, float] = {}
    for r, d in recent_runs:
        key = _week_key(d)
        weekly_totals[key] = weekly_totals.get(key, 0.0) + float(r.get("distance_km") or 0)
    recent_peak_weekly_km = round(max(weekly_totals.values(), default=0.0), 1)

    quality_sessions = 0
    interval_sessions = 0
    tempo_sessions = 0
    long_runs = 0
    easy_like = 0
    for r, _ in recent_runs:
        text = " ".join(str(r.get(k) or "").lower() for k in ("run_type", "name", "notes"))
        dist = float(r.get("distance_km") or 0)
        avg_hr = _coerce_float(r.get("avg_hr"))
        max_hr_hint = _coerce_float(r.get("max_hr")) or float(max_hr or 190)
        hr_pct = avg_hr / max_hr_hint if avg_hr and max_hr_hint > 0 else 0.0
        is_interval = _is_interval_session(r) or any(k in text for k in ("interval", "ripet", "vo2", "fartlek", "400", "800", "1000"))
        is_tempo = any(k in text for k in ("tempo", "threshold", "soglia", "medio", "progress")) or hr_pct >= 0.82
        if is_interval:
            interval_sessions += 1
            quality_sessions += 1
        elif is_tempo:
            tempo_sessions += 1
            quality_sessions += 1
        elif dist >= 14:
            long_runs += 1
        if dist >= 3 and (avg_hr is None or hr_pct <= 0.78) and not is_interval:
            easy_like += 1

    run_count = len(recent_runs)
    easy_ratio = round(easy_like / run_count, 2) if run_count else 0.0
    consistency = min(35.0, run_count / 24.0 * 35.0)
    volume_score = min(35.0, weekly_volume_8w / 45.0 * 35.0)
    easy_score = min(20.0, easy_ratio / 0.75 * 20.0)
    long_score = min(10.0, long_runs / 4.0 * 10.0)
    aerobic_base_score = round(consistency + volume_score + easy_score + long_score)

    ctl = float((ff_latest or {}).get("ctl", 0) or 0)
    atl = float((ff_latest or {}).get("atl", 0) or 0)
    tsb = float((ff_latest or {}).get("tsb", 0) or 0)
    stop_penalty = min(45.0, max(0, days_since_last_run - 7) * 1.4)
    fatigue_penalty = 18.0 if tsb < -15 else 10.0 if tsb < -10 else 0.0
    load_bonus = min(12.0, ctl / 6.0)
    readiness_score = round(max(5.0, min(95.0, aerobic_base_score + load_bonus - stop_penalty - fatigue_penalty)))

    if days_since_last_run >= 21:
        training_status = "return_from_stop"
    elif quality_sessions >= 2 and aerobic_base_score >= 60:
        training_status = "trained_with_quality"
    elif aerobic_base_score >= 60:
        training_status = "aerobic_base_built"
    elif weekly_volume_8w >= 15:
        training_status = "building_base"
    else:
        training_status = "low_recent_load"

    return {
        "days_since_last_run": days_since_last_run,
        "longest_stop_days_6m": longest_gap,
        "weekly_volume_4w": weekly_volume_4w,
        "weekly_volume_8w": weekly_volume_8w,
        "weekly_volume": history.get("weekly_volume", weekly_volume_8w),
        "recent_peak_weekly_km": recent_peak_weekly_km,
        "quality_sessions_8w": quality_sessions,
        "interval_sessions_8w": interval_sessions,
        "tempo_sessions_8w": tempo_sessions,
        "long_runs_8w": long_runs,
        "easy_ratio_8w": easy_ratio,
        "aerobic_base_score": aerobic_base_score,
        "readiness_score": readiness_score,
        "training_status": training_status,
        "load": {"ctl": round(ctl, 1), "atl": round(atl, 1), "tsb": round(tsb, 1)},
    }


def _apply_stop_adjustment_to_vdot(current_vdot: float, history_context: dict) -> float:
    stop_days = int(history_context.get("days_since_last_run", 0) or 0)
    if stop_days < 14:
        return current_vdot
    if stop_days < 28:
        penalty = 0.4
    elif stop_days < 56:
        penalty = 1.0
    elif stop_days < 84:
        penalty = 1.8
    else:
        penalty = 2.6
    return round(max(25.0, current_vdot - penalty), 1)


def _vdot_to_race_seconds(vdot: float, dist_km: float) -> Optional[float]:
    """Predict race finish in seconds (Daniels iterative). None on bad input."""
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
    return t * 60


def _vdot_from_race(dist_km: float, time_seconds: float) -> Optional[float]:
    """Compute VDOT da race time + distance (Daniels reverse formula).

    Pace-only, NO heart rate. Usato per field test (3K/5K/6K max effort).
    Inverte _vdot_to_race_seconds via bisection.
    """
    if dist_km <= 0 or time_seconds <= 0:
        return None
    t_min = time_seconds / 60.0
    pct = 0.8 + 0.1894393 * math.exp(-0.012778 * t_min) + 0.2989558 * math.exp(-0.1932605 * t_min)
    v = (dist_km * 1000) / t_min  # m/min
    vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
    vdot = vo2 / pct
    return round(vdot, 1) if vdot > 0 else None


def _seconds_to_time_str(total_s: float) -> str:
    total_s = round(total_s)
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _vdot_to_race_time(vdot: float, dist_km: float) -> Optional[str]:
    """Predict race finish time for a given distance using iterative Daniels inversion."""
    sec = _vdot_to_race_seconds(vdot, dist_km)
    if sec is None:
        return None
    return _seconds_to_time_str(sec)


def _compute_endurance_context(runs: Optional[list]) -> dict:
    """Compute longest recent run + avg cardiac drift % from last 90 days.

    Returns {longest_km, drift_pct} where drift_pct is mean |drift| over runs
    with ≥4 splits, distance ≥4km. Used by _predict_race for HM/Marathon penalty.
    """
    if not runs:
        return {"longest_km": 0.0, "drift_pct": 0.0}
    cutoff_ts = (dt.datetime.utcnow() - dt.timedelta(days=90)).isoformat()
    longest = 0.0
    drifts = []
    for r in runs:
        if r.get("is_treadmill"):
            continue
        date = r.get("date") or ""
        if date < cutoff_ts:
            continue
        d = r.get("distance_km", 0) or 0
        if d > longest:
            longest = d
        splits = r.get("splits") or []
        if d < 4 or len(splits) < 4:
            continue
        half = len(splits) // 2
        try:
            first_paces = [s.get("pace") for s in splits[:half]]
            second_paces = [s.get("pace") for s in splits[half:]]
            def _ppts(p):
                if not p or ":" not in p:
                    return 0
                m, s = p.split(":")
                return int(m) * 60 + int(s)
            p1 = sum(_ppts(p) for p in first_paces) / max(1, len(first_paces))
            p2 = sum(_ppts(p) for p in second_paces) / max(1, len(second_paces))
            if p1 > 0:
                drifts.append(abs((p2 - p1) / p1 * 100))
        except Exception:
            continue
    drift_avg = (sum(drifts) / len(drifts)) if drifts else 0.0
    return {"longest_km": longest, "drift_pct": drift_avg}


def _compute_race_fractions(longest: float, drift: float, ctl_val: float) -> dict:
    """Fraction-of-peak VDOT per distanza (race-specific endurance model).

    Base calibrato vs Garmin race calculator (runner senza race-specific):
      5K  → 0.91  (VO2max-dominato, ma serve tolleranza lattica + lavoro brevi)
      10K → 0.87  (serve specifica race-pace endurance ~45min)
      HM  → 0.84  (serve long run base + threshold work)
      Mar → 0.77  (serve grosso volume + long runs 30K+)

    Esempio VDOT 52.3 base: 5K 20:48, 10K 44:48, HM 1:41, Mar 3:48
    (matcha Garmin 20:53 / 44:55 / 1:42:54 / 3:49:18 ±1 min).

    Bonus per training match (longest_recent, CTL ≥50).
    Penalità per cardiac drift alto (efficienza scarsa peggiora lunghe).
    """
    fractions = {
        5.0:     0.92,
        10.0:    0.88,
        21.0975: 0.85,
        42.195:  0.77,
    }
    if longest >= 15:
        fractions[5.0] += min(0.03, (longest - 15) * 0.003)
    if longest >= 12:
        fractions[10.0] += min(0.04, (longest - 12) * 0.004)
    if longest >= 15:
        fractions[21.0975] += min(0.08, (longest - 15) * 0.008)
    if longest >= 25:
        fractions[42.195] += min(0.12, (longest - 25) * 0.01)

    # CTL bonus parte da 50 (atleta trained). CTL 50 = 0 bonus, baseline Garmin.
    # CTL 70 = +0.04 (max). Per atleta well-trained predictions si avvicinano
    # al teorico Daniels (peak VDOT esprimibile).
    if ctl_val >= 50:
        ctl_bonus = min(0.04, (ctl_val - 50) / 500)
        fractions[5.0]     += ctl_bonus
        fractions[10.0]    += ctl_bonus * 1.2
        fractions[21.0975] += ctl_bonus * 1.5
        fractions[42.195]  += ctl_bonus * 2.0

    if drift > 5:
        drift_pen = min(0.04, (drift - 5) * 0.01)
        fractions[5.0]     -= drift_pen * 0.4
        fractions[10.0]    -= drift_pen * 0.6
        fractions[21.0975] -= drift_pen * 1.0
        fractions[42.195]  -= drift_pen * 1.5

    for k in list(fractions.keys()):
        fractions[k] = max(0.55, min(1.00, fractions[k]))
    return fractions


def _predict_race(vdot: float, runs: Optional[list] = None, ctl: Optional[float] = None) -> dict:
    """Race time predictions con fraction-of-peak VDOT model.

    VDOT peak (5K max effort) NON esprimibile in race performance senza
    training specifico per distanza. Anche 5K richiede 6-8 settimane di
    lavoro race-pace per esprimere peak. Per HM/Mar servono long runs.

    effective_vdot[dist] = peak_vdot × fraction[dist] (vedi _compute_race_fractions)

    Esempio VDOT 52, untrained:
      5K ~20:55 (vs Daniels puro 19:11 — irrealistico per non race-trained)
      10K ~44:35 (vs 40:00)
      HM ~1:43 (vs 1:38)
      Mar ~3:49 (vs 3:24)
    """
    if not vdot:
        return {}

    ctx = _compute_endurance_context(runs)
    fractions = _compute_race_fractions(ctx["longest_km"], ctx["drift_pct"], ctl or 0)

    result = {}
    for label, dist in [("5K", 5.0), ("10K", 10.0), ("Half Marathon", 21.0975), ("Marathon", 42.195)]:
        effective_vdot = vdot * fractions[dist]
        t = _vdot_to_race_seconds(effective_vdot, dist)
        if t:
            result[label] = _seconds_to_time_str(t)
    return result


# ─── Temperature + humidity race-prediction bands ────────────────────────────
RACE_TEMP_BANDS = [
    {"key": "ideale",     "label": "Ideale",     "range": "5-11°C",  "temp_c": 8.0,  "humidity": 70},
    {"key": "media",      "label": "Media",      "range": "12-19°C", "temp_c": 16.0, "humidity": 65},
    {"key": "alta",       "label": "Alta",       "range": "20-26°C", "temp_c": 23.0, "humidity": 60},
    {"key": "proibitiva", "label": "Proibitiva", "range": ">27°C",   "temp_c": 31.0, "humidity": 60},
]


def _apparent_temp_c(temp_c: float, humidity_pct: Optional[float]) -> float:
    """Humidity-adjusted ('feels like') temperature for running.

    Below ~20°C humidity barely affects performance — evaporative cooling still
    works. Above 20°C, high humidity blocks sweat evaporation, so the effective
    heat stress climbs with relative humidity. Linear surcharge keeps it legible.
    """
    if humidity_pct is None or temp_c <= 20.0:
        return temp_c
    return temp_c + max(0.0, humidity_pct - 50.0) / 100.0 * (temp_c - 20.0) * 0.7


def _heat_slowdown_frac(temp_c: float, humidity_pct: Optional[float], dist_km: float) -> float:
    """Fractional race-time slowdown vs a cool ~12°C optimum.

    Distance-scaled because heat accumulates: a marathon in 30°C suffers far
    more than a 5K. Coefficient runs ~0.35%/°C of excess at 5K up to ~0.80%/°C
    at the marathon, applied to the humidity-adjusted apparent temperature.
    Calibrated against heat-vs-performance studies (e.g. Ely 2007 marathon data:
    ~+1 min/°C above optimum for a 3h runner near 25°C).
    """
    apparent = _apparent_temp_c(temp_c, humidity_pct)
    excess = max(0.0, apparent - 12.0)
    d = max(5.0, min(42.2, dist_km))
    coef = 0.0035 + (d - 5.0) / (42.2 - 5.0) * (0.0080 - 0.0035)
    return excess * coef


def _predict_race_temp_bands(vdot: float, runs: Optional[list] = None,
                             ctl: Optional[float] = None) -> dict:
    """Race predictions across four climate bands (temp + humidity aware).

    The 'ideale' band is the reference (cool, near-optimal); the others add a
    distance-scaled heat penalty on top of the same endurance-aware base time
    used by _predict_race, so the numbers stay consistent with the main card.
    """
    if not vdot:
        return {"bands": []}
    ctx = _compute_endurance_context(runs)
    fractions = _compute_race_fractions(ctx["longest_km"], ctx["drift_pct"], ctl or 0)
    dists = [("5K", 5.0), ("10K", 10.0), ("Half Marathon", 21.0975), ("Marathon", 42.195)]
    base_secs = {}
    for label, dist in dists:
        t = _vdot_to_race_seconds(vdot * fractions[dist], dist)
        if t:
            base_secs[label] = t

    bands = []
    for band in RACE_TEMP_BANDS:
        preds = {}
        for label, dist in dists:
            if label in base_secs:
                frac = _heat_slowdown_frac(band["temp_c"], band["humidity"], dist)
                preds[label] = _seconds_to_time_str(base_secs[label] * (1.0 + frac))
        bands.append({
            "key": band["key"],
            "label": band["label"],
            "range": band["range"],
            "humidity": band["humidity"],
            "predictions": preds,
        })
    return {"bands": bands}


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


def _analytics_date(value: str) -> Optional[dt.date]:
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _parse_pace_sec(pace_str: Optional[str]) -> Optional[float]:
    if not pace_str or ":" not in str(pace_str):
        return None
    try:
        parts = str(pace_str).split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None


def _pace_label(seconds: Optional[float]) -> Optional[str]:
    if seconds is None or seconds <= 0:
        return None
    m = int(seconds // 60)
    s = int(round(seconds % 60))
    if s == 60:
        m += 1
        s = 0
    return f"{m}:{s:02d}"


def _time_to_seconds(value: Optional[str]) -> Optional[int]:
    if not value or ":" not in value:
        return None
    try:
        parts = [int(p) for p in value.split(":")]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
    except (ValueError, IndexError):
        return None
    return None


def _avg(values: list) -> Optional[float]:
    nums = [float(v) for v in values if v is not None]
    return sum(nums) / len(nums) if nums else None


def _stdev(values: list) -> float:
    nums = [float(v) for v in values if v is not None]
    if len(nums) < 2:
        return 0.0
    mean = sum(nums) / len(nums)
    return math.sqrt(sum((v - mean) ** 2 for v in nums) / len(nums))


def _range_cutoff(range_key: str, reference_date: Optional[dt.date] = None) -> Optional[dt.date]:
    today = reference_date or dt.date.today()
    days = {"1M": 31, "3M": 92, "6M": 183, "12M": 366}.get(range_key.upper())
    return today - dt.timedelta(days=days) if days else None


def _latest_analytics_date(rows: list) -> Optional[dt.date]:
    dates = [_analytics_date(r.get("date")) for r in rows]
    dates = [d for d in dates if d]
    return max(dates) if dates else None


def _filter_runs_for_range(runs: list, range_key: str, reference_date: Optional[dt.date] = None) -> list:
    cutoff = _range_cutoff(range_key, reference_date or _latest_analytics_date(runs))
    if not cutoff:
        return runs
    return [r for r in runs if (_analytics_date(r.get("date")) or dt.date.min) >= cutoff]


def _resolve_resolution(range_key: str, resolution: str, detail: bool) -> str:
    if resolution in {"day", "week", "month"}:
        return resolution
    if not detail:
        return "month"
    if range_key.upper() in {"1M", "3M"}:
        return "day"
    if range_key.upper() in {"6M", "12M"}:
        return "week"
    return "month"


def _bucket_key(date_str: str, resolution: str) -> Optional[str]:
    d = _analytics_date(date_str)
    if not d:
        return None
    if resolution == "day":
        return d.isoformat()
    if resolution == "week":
        return (d - dt.timedelta(days=d.weekday())).isoformat()
    return d.strftime("%Y-%m")


def _chart(
    chart_id: str,
    title: str,
    unit: str = "",
    summary: Optional[dict] = None,
    series_card: Optional[list] = None,
    series_detail: Optional[list] = None,
    kpis: Optional[dict] = None,
    sample_size: int = 0,
    message: Optional[str] = None,
) -> dict:
    status = "ok" if sample_size > 0 else "insufficient_data"
    return {
        "id": chart_id,
        "title": title,
        "unit": unit,
        "summary": summary or {},
        "series_card": series_card or [],
        "series_detail": series_detail or [],
        "kpis": kpis or {},
        "quality": {
            "status": status,
            "sample_size": sample_size,
            "message": (message or "Dati insufficienti") if status != "ok" else None,
        },
    }


def _group_runs_by_bucket(runs: list, resolution: str) -> dict:
    groups: dict[str, list] = {}
    for r in runs:
        key = _bucket_key(r.get("date", ""), resolution)
        if key:
            groups.setdefault(key, []).append(r)
    return groups


def _weighted_pace_sec(runs: list) -> Optional[float]:
    total_km = sum(float(r.get("distance_km") or 0) for r in runs)
    total_min = sum(float(r.get("duration_minutes") or 0) for r in runs)
    if total_km > 0 and total_min > 0:
        return total_min * 60 / total_km
    return _avg([_parse_pace_sec(r.get("avg_pace")) for r in runs])


def _pace_at_vo2_pct(vdot: Optional[float], pct: float) -> Optional[float]:
    if not vdot:
        return None
    vo2 = vdot * pct
    disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
    if disc < 0:
        return None
    v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
    return 60000 / v if v > 0 else None


def _bio_value(run: dict, key: str) -> Optional[float]:
    bio = run.get("biomechanics") or {}
    aliases = {
        "gct": ["avg_ground_contact_time_ms", "avg_ground_contact_time"],
        "vo": ["avg_vertical_oscillation_cm", "avg_vertical_oscillation"],
        "vr": ["avg_vertical_ratio_pct", "avg_vertical_ratio"],
        "stride": ["avg_stride_length_m", "avg_stride_length"],
        "cadence": ["avg_cadence_spm", "avg_cadence"],
    }
    for field in aliases.get(key, [key]):
        value = bio.get(field)
        if value is None:
            value = run.get(field)
        if value is not None:
            try:
                value = float(value)
                if value <= 0:
                    continue
                if key == "cadence" and value < 120:
                    value *= 2
                return value
            except (TypeError, ValueError):
                continue
    return None


def _garmin_csv_doc_to_run_like(doc: dict) -> dict:
    """Expose imported Garmin CSV telemetry through the same shape used by charts."""
    csv_id = str(doc.get("_id") or doc.get("id") or "")
    pace_sec = doc.get("avg_pace_sec") or _parse_pace_sec(doc.get("avg_pace"))
    distance_km = float(doc.get("distance_km") or 0)
    duration = doc.get("duration_minutes")
    if (not duration or float(duration or 0) <= 0) and pace_sec and distance_km > 0:
        duration = distance_km * pace_sec / 60

    biomechanics = {
        "avg_ground_contact_time_ms": doc.get("avg_ground_contact_time_ms"),
        "avg_vertical_oscillation_cm": doc.get("avg_vertical_oscillation_cm"),
        "avg_vertical_ratio_pct": doc.get("avg_vertical_ratio_pct"),
        "avg_stride_length_m": doc.get("avg_stride_length_m"),
        "avg_cadence_spm": doc.get("avg_cadence_spm"),
        "source": "garmin_csv_import",
        "garmin_csv_id": csv_id,
    }
    return {
        "id": f"garmin_csv:{csv_id}",
        "date": doc.get("date"),
        "name": doc.get("titolo"),
        "distance_km": distance_km,
        "duration_minutes": duration,
        "avg_pace": doc.get("avg_pace"),
        "avg_hr": doc.get("avg_hr"),
        "avg_cadence": doc.get("avg_cadence_spm"),
        "avg_ground_contact_time": doc.get("avg_ground_contact_time_ms"),
        "avg_vertical_oscillation": doc.get("avg_vertical_oscillation_cm"),
        "avg_vertical_ratio": doc.get("avg_vertical_ratio_pct"),
        "avg_stride_length": doc.get("avg_stride_length_m"),
        "biomechanics": biomechanics,
        "source": "garmin_csv_import",
        "garmin_csv_id": csv_id,
    }


def _build_trend_km_chart(runs: list, resolution: str) -> dict:
    detail = []
    for key, group in sorted(_group_runs_by_bucket(runs, resolution).items()):
        detail.append({"date": key, "km": round(sum(r.get("distance_km", 0) for r in group), 1), "runs": len(group)})
    card = []
    for key, group in sorted(_group_runs_by_bucket(runs, "month").items()):
        card.append({"date": key, "km": round(sum(r.get("distance_km", 0) for r in group), 1), "runs": len(group)})
    total = round(sum(r.get("distance_km", 0) for r in runs), 1)
    return _chart(
        "trend_km", "Trend KM", "km",
        {"total_km": total, "runs": len(runs), "max_bucket_km": max([p["km"] for p in detail], default=0)},
        card, detail,
        {"total_km": total, "runs": len(runs), "avg_km_per_month": round(total / max(1, len(card)), 1)},
        len(runs),
    )


def _build_fitness_chart(ff_docs: list, range_key: str, resolution: str) -> dict:
    cutoff = _range_cutoff(range_key, _latest_analytics_date(ff_docs))
    docs = [
        d for d in ff_docs
        if not cutoff or (_analytics_date(d.get("date")) or dt.date.min) >= cutoff
    ]
    docs = sorted(docs, key=lambda d: d.get("date", ""))
    detail = [{"date": d.get("date"), "ctl": d.get("ctl"), "atl": d.get("atl"), "tsb": d.get("tsb"), "trimp": d.get("trimp")} for d in docs]
    monthly = {}
    for d in docs:
        key = _bucket_key(d.get("date", ""), "month")
        if key:
            monthly[key] = d
    card = [{"date": k, "ctl": v.get("ctl"), "atl": v.get("atl"), "tsb": v.get("tsb")} for k, v in sorted(monthly.items())]
    latest = docs[-1] if docs else {}
    return _chart(
        "fitness_freshness", "Fitness & Freschezza", "load",
        {"latest_ctl": latest.get("ctl"), "latest_atl": latest.get("atl"), "latest_tsb": latest.get("tsb")},
        card, detail,
        {"ctl": latest.get("ctl"), "atl": latest.get("atl"), "tsb": latest.get("tsb")},
        len(docs),
    )


def _build_pace_zone_chart(runs: list, days: int = 90) -> dict:
    reference_date = _latest_analytics_date(runs) or dt.date.today()
    cutoff = reference_date - dt.timedelta(days=days)
    scoped_runs = [
        r for r in runs
        if (_analytics_date(r.get("date")) or dt.date.min) >= cutoff
    ]
    bins = [
        ("Z1", "Recupero", 390, "#3B82F6"),
        ("Z2", "Easy", 360, "#10B981"),
        ("Z3", "Steady", 330, "#A3E635"),
        ("Z4", "Threshold", 300, "#F59E0B"),
        ("Z5", "Fast", 0, "#F43F5E"),
    ]
    totals = {b[0]: {"runs": 0, "km": 0.0, "label": b[1], "color": b[3]} for b in bins}
    for r in scoped_runs:
        pace = _parse_pace_sec(r.get("avg_pace"))
        if not pace:
            continue
        for zone, _, min_sec, _ in bins:
            if pace >= min_sec:
                totals[zone]["runs"] += 1
                totals[zone]["km"] += float(r.get("distance_km") or 0)
                break
    total_km = sum(v["km"] for v in totals.values())
    series = [
        {"zone": z, "name": v["label"], "km": round(v["km"], 1), "runs": v["runs"], "pct": round(v["km"] / total_km * 100, 1) if total_km else 0, "color": v["color"]}
        for z, v in totals.items()
    ]
    sample_size = sum(v["runs"] for v in totals.values())
    return _chart(
        "pace_zones", "Distribuzione Zone di Passo", "%",
        {"total_km": round(total_km, 1), "days": days},
        series, series,
        {"total_km": round(total_km, 1), "runs": sample_size, "days": days},
        sample_size=sample_size,
        message=f"Nessuna corsa outdoor GPS valida negli ultimi {days} giorni",
    )


def _build_pace_distribution_chart(runs: list) -> dict:
    paces = [_parse_pace_sec(r.get("avg_pace")) for r in runs]
    paces = [p for p in paces if p]
    bins: dict[int, int] = {}
    for p in paces:
        bucket = int(p // 15) * 15
        bins[bucket] = bins.get(bucket, 0) + 1
    series = [{"pace": _pace_label(k), "pace_sec": k, "runs": v} for k, v in sorted(bins.items())]
    return _chart(
        "pace_distribution", "Distribuzione del Passo", "runs",
        {"avg_pace_sec": round(_avg(paces) or 0, 1), "bins": len(series)},
        series, series,
        {"runs": len(paces), "avg_pace": _pace_label(_avg(paces))},
        sample_size=len(paces),
        message="Nessuna corsa outdoor GPS valida con passo medio",
    )


def _build_effort_matrix_chart(runs: list) -> dict:
    points = []
    for r in runs:
        pace = _parse_pace_sec(r.get("avg_pace"))
        if not pace:
            continue
        hr = r.get("avg_hr")
        dist = float(r.get("distance_km") or 0)
        if dist <= 0:
            continue
        duration = float(r.get("duration_minutes") or 0)
        if duration <= 0:
            duration = dist * pace / 60
        load = round(duration * ((float(hr) if hr else 140) / 140), 1)
        points.append({
            "date": r.get("date"),
            "dist": round(dist, 2),
            "pace": round(pace / 60, 2),
            "pace_sec": round(pace, 1),
            "hr": hr,
            "z": load,
        })
    return _chart(
        "effort_matrix", "Matrice degli Sforzi", "effort",
        {"points": len(points)},
        points[-80:], points,
        {"points": len(points), "hr_fallback": sum(1 for p in points if not p.get("hr"))},
        sample_size=len(points),
        message="Nessuna corsa outdoor GPS valida con distanza e passo",
    )


def _build_pace_trend_chart(runs: list, resolution: str) -> dict:
    def build(res: str) -> list:
        rows = []
        for key, group in sorted(_group_runs_by_bucket(runs, res).items()):
            pace = _weighted_pace_sec(group)
            rows.append({"date": key, "pace": round(pace, 1) if pace else None, "pace_label": _pace_label(pace), "runs": len(group)})
        return rows
    detail = build(resolution)
    card = build("month")
    paces = [p["pace"] for p in detail if p.get("pace")]
    return _chart("trend_passo", "Trend Passo", "sec/km", {"avg_pace_sec": round(_avg(paces) or 0, 1)}, card, detail, sample_size=len(paces))


def _build_vdot_chart(
    runs: list,
    max_hr: int,
    resolution: str,
    only_chart: Optional[str] = None,
    resting_hr: int = 50,
    anchor_vdot: Optional[float] = None,
    threshold_frac: float = 0.81,
) -> tuple[Optional[dict], Optional[dict], Optional[dict]]:
    """Trend VDOT / soglia / gare.

    anchor_vdot: VDOT ATTIVO canonico (field-test aware, stesso di /api/vdot/
    paces e della dashboard). La serie mensile viene calibrata così che
    l'ultimo punto coincida con quel valore — prima il "Passo Soglia Latest"
    e il VDOT del grafico divergevano dai numeri mostrati in dashboard.
    threshold_frac: frazione VO2max usata per il passo soglia, la STESSA della
    dashboard (0.88 con field test attivo, 0.81 sustainable senza).
    """
    want_all = only_chart is None
    want_vdot = want_all or only_chart == "vo2_vdot_trend"
    want_threshold = want_all or only_chart == "threshold_progression"
    want_race = want_all or only_chart == "race_evolution"

    buckets: dict[str, list] = {}
    month_buckets: dict[str, list] = {}
    for r in runs:
        value = _vdot_from_run(r, max_hr, resting_hr)
        if not value:
            continue
        date = r.get("date", "")
        detail_key = _bucket_key(date, resolution)
        month_key = _bucket_key(date, "month")
        if detail_key:
            buckets.setdefault(detail_key, []).append(r)
        if month_key:
            month_buckets.setdefault(month_key, []).append(r)

    def _bucket_as_of(group: list) -> Optional[dt.date]:
        dates = [_run_date_obj(r) for r in group]
        dates = [d for d in dates if d is not None]
        return max(dates) if dates else None

    def _bucket_point(key: str, group: list) -> Optional[dict]:
        values = [min(_vdot_from_run(r, max_hr, resting_hr) or 0, 65.0) for r in group]
        values = [v for v in values if v > 0]
        if not values:
            return None
        vdot = _calc_vdot(group, max_hr, resting_hr=resting_hr, as_of=_bucket_as_of(group)) or _avg(values)
        if not vdot:
            return None
        vdot = min(vdot, 65.0)
        return {
            "date": key,
            "vdot": round(vdot, 1),
            "vo2max": round(vdot, 1),
            "sample_size": len(values),
            "best_session_vdot": round(max(values), 1),
            "avg_session_vdot": round(_avg(values) or 0, 1),
            "quality": "vdot_model_v2",
        }

    detail = [p for p in (_bucket_point(key, group) for key, group in sorted(buckets.items())) if p]
    card = [p for p in (_bucket_point(key, group) for key, group in sorted(month_buckets.items())) if p]
    current = _calc_vdot(runs, max_hr, resting_hr=resting_hr)

    # ── Calibrazione sull'anchor canonico ────────────────────────────────────
    # Scala la serie così che l'ultimo bucket = VDOT attivo (dashboard). Il
    # rapporto è clampato: la forma storica resta, il livello si allinea.
    if anchor_vdot:
        last_bucket = card[-1].get("vdot") if card else (detail[-1].get("vdot") if detail else None)
        scale = 1.0
        if last_bucket:
            scale = max(0.85, min(1.15, float(anchor_vdot) / float(last_bucket)))
        if scale != 1.0:
            for series in (detail, card):
                for p in series:
                    for f in ("vdot", "vo2max", "best_session_vdot", "avg_session_vdot"):
                        if p.get(f):
                            p[f] = round(min(p[f] * scale, 65.0), 1)
        current = round(float(anchor_vdot), 1)

    vdot_chart = None
    if want_vdot:
        vdot_chart = _chart("vo2_vdot_trend", "VO2 Max / VDOT Trend", "VDOT", {"current": current}, card, detail, {"current_vdot": current}, len(detail))

    threshold_chart = None
    if want_threshold:
        threshold_detail = []
        for p in detail:
            # Stessa frazione della dashboard (0.88 field test / 0.81 senza):
            # sui bucket calibrati l'ultimo punto coincide col Passo Soglia.
            threshold = _pace_at_vo2_pct(p.get("vdot"), threshold_frac)
            threshold_detail.append({
                "date": p["date"],
                "threshold_pace": round(threshold, 1) if threshold else None,
                "threshold_label": _pace_label(threshold),
                "vdot": p.get("vdot"),
                "sample_size": p.get("sample_size", 0),
            })
        threshold_chart = _chart("threshold_progression", "Soglia / Progressione Temporale", "sec/km", {}, threshold_detail[-12:], threshold_detail, sample_size=len(threshold_detail))

    race_chart = None
    if want_race:
        race_detail = []
        for p in detail:
            preds = _predict_race(p.get("vdot")) if p.get("vdot") else {}
            race_detail.append({
                "date": p["date"],
                "k5": _time_to_seconds(preds.get("5K")),
                "k10": _time_to_seconds(preds.get("10K")),
                "hm": _time_to_seconds(preds.get("Half Marathon")),
                "fm": _time_to_seconds(preds.get("Marathon")),
                "vdot": p.get("vdot"),
            })
        race_chart = _chart("race_evolution", "Race Evolution", "seconds", {}, race_detail[-12:], race_detail, sample_size=len(race_detail))
    return vdot_chart, threshold_chart, race_chart


def _best_effort_candidate(run: dict, target_km: float, min_km: float) -> Optional[dict]:
    km = float(run.get("distance_km") or 0)
    actual_s = float(run.get("duration_minutes") or 0) * 60
    if km < min_km or actual_s <= 0:
        return None

    effort = None
    streams = run.get("streams") or []
    if streams and km >= target_km * 0.98:
        effort = _best_effort_from_streams(streams, target_km * 1000, actual_s)
        if effort:
            effort["source"] = "streams"

    splits_target = int(round(target_km))
    if not effort and run.get("splits") and km >= min_km:
        effort = _best_effort_from_splits(run.get("splits") or [], splits_target)
        if effort:
            effort["source"] = "splits"

    if not effort and km >= target_km * 0.98:
        estimated_s = actual_s * (target_km / km)
        effort = {
            "time_s": estimated_s,
            "pace_s": estimated_s / target_km,
            "source": "avg_pace_estimate",
        }

    if not effort:
        return None
    if effort["pace_s"] < 175 or effort["pace_s"] > 900:
        return None
    return effort


def _build_best_efforts_progression_chart(runs: list, resolution: str) -> dict:
    targets = [("k5", 5.0, 4.5), ("k10", 10.0, 9.5), ("hm", 21.097, 20.0)]
    card_rows: dict[str, dict] = {}
    detail_rows: dict[str, dict] = {}
    sample = 0
    source_counts: dict[str, int] = {}

    def update_row(rows: dict[str, dict], key: str, label: str, effort: dict):
        rows.setdefault(key, {"date": key})
        if label not in rows[key] or effort["time_s"] < rows[key][label]:
            rows[key][label] = round(effort["time_s"])
            rows[key][f"{label}_source"] = effort.get("source")

    for r in runs:
        month_key = _bucket_key(r.get("date", ""), "month")
        detail_key = _bucket_key(r.get("date", ""), resolution)
        if not month_key or not detail_key:
            continue
        for label, target_km, min_km in targets:
            effort = _best_effort_candidate(r, target_km, min_km)
            if not effort:
                continue
            update_row(card_rows, month_key, label, effort)
            update_row(detail_rows, detail_key, label, effort)
            sample += 1
            src = str(effort.get("source") or "unknown")
            source_counts[src] = source_counts.get(src, 0) + 1

    card = [card_rows[k] for k in sorted(card_rows.keys()) if any(t[0] in card_rows[k] for t in targets)]
    detail = [detail_rows[k] for k in sorted(detail_rows.keys()) if any(t[0] in detail_rows[k] for t in targets)]
    return _chart(
        "best_efforts_progression", "Best Efforts Progression", "seconds",
        {"sources": source_counts},
        card[-12:], detail,
        {"samples": sample, "sources": source_counts},
        sample_size=sample,
        message="Nessuna corsa outdoor GPS valida abbastanza lunga per 5K, 10K o mezza",
    )


def _build_biomechanics_charts(
    runs: list,
    resolution: str,
    vdot: Optional[float],
    garmin_csv_docs: Optional[list] = None,
    only_chart: Optional[str] = None,
) -> dict:
    def wants(chart_id: str) -> bool:
        return only_chart is None or only_chart == chart_id

    valid_chart_ids = {
        "ground_contact_stability",
        "athletic_profile",
        "efficiency_correlation",
        "adaptation",
        "paces",
        "cadence_monthly",
        "cardiac_drift",
        "gct_monthly",
        "gct_cadence",
        "cadence_speed_matrix",
    }
    if only_chart and only_chart not in valid_chart_ids:
        return {}

    linked_csv_ids = set()
    for r in runs:
        for value in (r.get("garmin_csv_id"), (r.get("biomechanics") or {}).get("garmin_csv_id")):
            if value:
                linked_csv_ids.add(str(value))

    csv_runs = []
    for doc in garmin_csv_docs or []:
        csv_id = str(doc.get("_id") or doc.get("id") or "")
        if csv_id and csv_id in linked_csv_ids:
            continue
        if not any(doc.get(k) is not None for k in (
            "avg_ground_contact_time_ms",
            "avg_vertical_oscillation_cm",
            "avg_vertical_ratio_pct",
            "avg_stride_length_m",
            "avg_cadence_spm",
        )):
            continue
        csv_runs.append(_garmin_csv_doc_to_run_like(doc))

    telemetry_runs = runs + csv_runs
    charts: dict[str, dict] = {}

    needs_bio_runs = only_chart is None or only_chart in {
        "ground_contact_stability",
        "athletic_profile",
        "efficiency_correlation",
        "cadence_monthly",
        "gct_monthly",
        "gct_cadence",
        "cadence_speed_matrix",
    }
    bio_runs = []
    gct_runs = []
    cad_runs = []
    if needs_bio_runs:
        bio_runs = [r for r in telemetry_runs if any(_bio_value(r, k) is not None for k in ("gct", "cadence", "vr", "stride", "vo"))]
        gct_runs = [r for r in bio_runs if _bio_value(r, "gct") is not None]
        cad_runs = [r for r in bio_runs if _bio_value(r, "cadence") is not None]

    if wants("ground_contact_stability"):
        stability_rows = []
        for key, group in sorted(_group_runs_by_bucket(gct_runs, resolution).items()):
            gcts = [_bio_value(r, "gct") for r in group]
            cads = [_bio_value(r, "cadence") for r in group]
            vrs = [_bio_value(r, "vr") for r in group]
            avg_gct = _avg(gcts)
            avg_cad = _avg(cads)
            avg_vr = _avg(vrs)
            consistency = _stdev(gcts)
            score = 100
            if avg_gct:
                score -= max(0, avg_gct - 250) * 0.18
            if avg_cad:
                score -= abs(avg_cad - 174) * 0.7
            if avg_vr:
                score -= max(0, avg_vr - 8.5) * 3
            score -= consistency * 0.12
            stability_rows.append({"date": key, "score": round(max(0, min(100, score)), 1), "gct": round(avg_gct or 0, 1), "cadence": round(avg_cad or 0, 1), "vertical_ratio": round(avg_vr or 0, 2), "runs": len(group)})
        latest_stability = stability_rows[-1] if stability_rows else {}
        charts["ground_contact_stability"] = _chart("ground_contact_stability", "Ground Contact Stability", "score", {"latest_score": latest_stability.get("score")}, stability_rows[-12:], stability_rows, latest_stability, len(stability_rows))

    if wants("athletic_profile"):
        avg_pace = _weighted_pace_sec(runs)
        avg_hr = _avg([r.get("avg_hr") for r in runs])
        avg_cad = _avg([_bio_value(r, "cadence") for r in cad_runs])
        avg_gct = _avg([_bio_value(r, "gct") for r in gct_runs])
        radar = [
            {"axis": "Endurance", "value": round(min(100, sum(r.get("distance_km", 0) for r in runs) / max(1, len(runs)) * 7), 1)},
            {"axis": "Speed", "value": round(min(100, ((vdot or 30) - 30) * 4), 1)},
            {"axis": "Efficiency", "value": round(min(100, ((3600 / avg_pace) / avg_hr * 1000) if avg_pace and avg_hr else 0), 1)},
            {"axis": "Cadence", "value": round(max(0, min(100, 100 - abs((avg_cad or 0) - 174) * 2)), 1) if avg_cad else 0},
            {"axis": "Impact", "value": round(max(0, min(100, 100 - max(0, (avg_gct or 300) - 240) * 0.8)), 1) if avg_gct else 0},
        ]
        charts["athletic_profile"] = _chart("athletic_profile", "Athletic Profile", "score", {}, radar, radar, sample_size=len(bio_runs))

    if wants("efficiency_correlation"):
        pace_eff_runs = []
        for r in telemetry_runs:
            pace = _parse_pace_sec(r.get("avg_pace"))
            hr = r.get("avg_hr")
            if pace and hr:
                pace_eff_runs.append({"date": r.get("date"), "pace": pace, "hr": hr, "efficiency": round((3600 / pace) / hr * 100, 3), "cadence": _bio_value(r, "cadence"), "gct": _bio_value(r, "gct")})
        charts["efficiency_correlation"] = _chart("efficiency_correlation", "Efficiency Correlation", "index", {}, pace_eff_runs[-80:], pace_eff_runs, sample_size=len(pace_eff_runs))

    if wants("adaptation"):
        adaptation = []
        for key, group in sorted(_group_runs_by_bucket(runs, resolution).items()):
            adaptation.append({
                "date": key,
                "km": round(sum(r.get("distance_km", 0) for r in group), 1),
                "pace": round(_weighted_pace_sec(group) or 0, 1),
                "hr": round(_avg([r.get("avg_hr") for r in group]) or 0, 1),
                "cadence": round(_avg([_bio_value(r, "cadence") for r in group]) or 0, 1),
                "gct": round(_avg([_bio_value(r, "gct") for r in group]) or 0, 1),
            })
        charts["adaptation"] = _chart("adaptation", "Long-Term Training Adaptation", "mixed", {}, adaptation[-12:], adaptation, sample_size=len(adaptation))

    if wants("paces"):
        monthly_paces = _build_pace_trend_chart(runs, "month")["series_card"]
        detail_paces = _build_pace_trend_chart(runs, resolution)["series_detail"]
        charts["paces"] = _chart("paces", "Andamento Paces", "sec/km", {}, monthly_paces, detail_paces, sample_size=len(runs))

    if wants("cadence_monthly"):
        cadence_rows = []
        for key, group in sorted(_group_runs_by_bucket(cad_runs, resolution).items()):
            cadence_rows.append({"date": key, "cadence": round(_avg([_bio_value(r, "cadence") for r in group]) or 0, 1), "runs": len(group)})
        charts["cadence_monthly"] = _chart("cadence_monthly", "Cadenza Mensile", "spm", {}, cadence_rows[-12:], cadence_rows, sample_size=len(cadence_rows))

    if wants("cardiac_drift"):
        cardiac_drift = []
        for r in runs:
            splits = r.get("splits") or []
            if len(splits) < 4:
                continue
            half = len(splits) // 2
            first = [_parse_pace_sec(s.get("pace")) for s in splits[:half]]
            second = [_parse_pace_sec(s.get("pace")) for s in splits[half:]]
            first_hr = _avg([s.get("hr") for s in splits[:half]])
            second_hr = _avg([s.get("hr") for s in splits[half:]])
            p1 = _avg(first)
            p2 = _avg(second)
            if p1 and p2:
                cardiac_drift.append({"date": r.get("date"), "drift_pct": round((p2 - p1) / p1 * 100, 2), "hr_drift": round((second_hr or 0) - (first_hr or 0), 1), "distance_km": r.get("distance_km")})
        charts["cardiac_drift"] = _chart("cardiac_drift", "Deriva Cardiaca", "%", {}, cardiac_drift[-40:], cardiac_drift, sample_size=len(cardiac_drift))

    if wants("gct_monthly"):
        gct_month = []
        for key, group in sorted(_group_runs_by_bucket(gct_runs, resolution).items()):
            row = {"date": key, "pace_530": None, "pace_500": None, "pace_445": None}
            buckets = {"pace_530": [], "pace_500": [], "pace_445": []}
            for r in group:
                pace = _parse_pace_sec(r.get("avg_pace"))
                gct = _bio_value(r, "gct")
                if not pace or not gct:
                    continue
                zone = "pace_530" if pace >= 330 else "pace_500" if pace >= 300 else "pace_445"
                buckets[zone].append(gct)
            for zone, vals in buckets.items():
                if vals:
                    row[zone] = round(_avg(vals) or 0, 1)
            gct_month.append(row)
        charts["gct_monthly"] = _chart("gct_monthly", "GCT mensile", "ms", {}, gct_month[-12:], gct_month, sample_size=len(gct_month))

    if wants("gct_cadence") or wants("cadence_speed_matrix"):
        gct_cad = []
        cad_speed = []
        for r in bio_runs:
            pace = _parse_pace_sec(r.get("avg_pace"))
            cad = _bio_value(r, "cadence")
            gct = _bio_value(r, "gct")
            if cad and gct:
                gct_cad.append({"date": r.get("date"), "cadence": round(cad, 1), "gct": round(gct, 1), "distance_km": r.get("distance_km")})
            if pace and cad:
                cad_speed.append({"date": r.get("date"), "speed": round(3600 / pace, 2), "cadence": round(cad, 1), "r": max(4, min(30, r.get("distance_km", 5))), "pace_sec": round(pace, 1)})
        if wants("gct_cadence"):
            charts["gct_cadence"] = _chart("gct_cadence", "GCT vs Cadence", "ms", {}, gct_cad[-80:], gct_cad, sample_size=len(gct_cad))
        if wants("cadence_speed_matrix"):
            charts["cadence_speed_matrix"] = _chart("cadence_speed_matrix", "Cadence vs Speed Matrix", "km/h", {}, cad_speed[-80:], cad_speed, sample_size=len(cad_speed))

    return charts


@app.get("/api/analytics/pro")
async def get_pro_analytics(
    tab: str = Query("all"),
    range_key: str = Query("12M", alias="range"),
    resolution: str = Query("auto"),
    detail: bool = Query(False),
    chart: Optional[str] = Query(None),
):
    """Unified real-data analytics contract for visible Statistics charts."""
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)

    tab = (tab or "all").lower()
    range_key = (range_key or "12M").upper()
    resolved_resolution = _resolve_resolution(range_key, resolution, detail)
    cache_key = f"{ANALYTICS_SCHEMA_VERSION}:pro:{tab}:{range_key}:{resolved_resolution}:{detail}:{chart or 'all'}"
    cached = await db.analytics_cache.find_one({"athlete_id": athlete_id, "cache_key": cache_key})
    if cached and cached.get("payload"):
        return cached["payload"]

    csv_only_biomech_charts = {
        "ground_contact_stability",
        "cadence_monthly",
        "gct_monthly",
        "gct_cadence",
        "cadence_speed_matrix",
    }
    skip_runs_for_csv_chart = tab == "biomechanics" and chart in csv_only_biomech_charts
    needs_splits = (
        tab == "all"
        or (tab == "potential_progress" and (not chart or chart in {"vo2_vdot_trend", "threshold_progression", "race_evolution", "best_efforts_progression"}))
        or (tab == "biomechanics" and (chart == "cardiac_drift" or (detail and not chart)))
    )
    all_runs = []
    runs = []
    if not skip_runs_for_csv_chart:
        q = fast_valid_outdoor_runs_query(athlete_id)
        all_runs = await db.runs.find(q, analytics_run_projection(include_splits=needs_splits)).sort("date", 1).to_list(3000)
        all_runs = [_normalise_run_quality_fields(dict(r)) for r in all_runs]
        runs = _filter_runs_for_range(all_runs, range_key)
    diagnostics = await _analytics_run_diagnostics(athlete_id, len(runs))

    profile_q = {"athlete_id": athlete_id}
    profile = await db.profile.find_one(profile_q) or {}
    max_hr = int(profile.get("max_hr", 190) or 190)
    resting_hr = int(profile.get("resting_hr", 50) or 50)

    sections: dict = {}
    if tab in {"all", "load_form"}:
        load_builders = {
            "trend_km": lambda: _build_trend_km_chart(runs, resolved_resolution),
            "pace_zones": lambda: _build_pace_zone_chart(all_runs, 90),
            "pace_distribution": lambda: _build_pace_distribution_chart(all_runs),
            "effort_matrix": lambda: _build_effort_matrix_chart(runs),
        }
        load_charts = {}
        if not chart or chart == "fitness_freshness":
            ff_docs = await db.fitness_freshness.find(profile_q).sort("date", 1).to_list(2000)
            load_charts["fitness_freshness"] = _build_fitness_chart(ff_docs, range_key, resolved_resolution)
        if chart:
            if chart in load_builders:
                load_charts = {chart: load_builders[chart]()}
            elif chart in load_charts:
                load_charts = {chart: load_charts[chart]}
            else:
                load_charts = {}
        else:
            load_charts.update({key: builder() for key, builder in load_builders.items()})
        sections["load_form"] = {"charts": load_charts}

    if tab in {"all", "potential_progress"}:
        potential_charts = {}
        vdot_chart_ids = {"vo2_vdot_trend", "threshold_progression", "race_evolution"}
        if not chart or chart in vdot_chart_ids:
            only_vdot_chart = chart if chart in vdot_chart_ids else None
            # VDOT attivo canonico (field-test aware) + stessa frazione soglia
            # della dashboard: allinea questi grafici ai valori mostrati altrove.
            active_vdot, from_ft = await _get_active_vdot(athlete_id, runs, max_hr, resting_hr)
            vdot_chart, threshold_chart, race_chart = _build_vdot_chart(
                runs, max_hr, resolved_resolution, only_vdot_chart, resting_hr=resting_hr,
                anchor_vdot=active_vdot, threshold_frac=0.88 if from_ft else 0.81,
            )
            vdot_charts = {}
            if vdot_chart:
                vdot_charts["vo2_vdot_trend"] = vdot_chart
            if threshold_chart:
                vdot_charts["threshold_progression"] = threshold_chart
            if race_chart:
                vdot_charts["race_evolution"] = race_chart
            potential_charts.update(vdot_charts if not chart else {chart: vdot_charts[chart]} if chart in vdot_charts else {})
        if not chart or chart == "trend_passo":
            potential_charts["trend_passo"] = _build_pace_trend_chart(runs, resolved_resolution)
        if not chart or chart == "best_efforts_progression":
            potential_charts["best_efforts_progression"] = _build_best_efforts_progression_chart(all_runs, resolved_resolution)
        if chart and chart not in potential_charts:
            potential_charts = {}
        sections["potential_progress"] = {"charts": potential_charts}

    if tab in {"all", "biomechanics"}:
        current_vdot = None
        if not chart or chart == "athletic_profile":
            current_vdot = _calc_vdot(runs, max_hr, resting_hr=resting_hr) or _calc_vdot(all_runs, max_hr, resting_hr=resting_hr)
        csv_chart_ids = {
            "ground_contact_stability",
            "athletic_profile",
            "efficiency_correlation",
            "cadence_monthly",
            "gct_monthly",
            "gct_cadence",
            "cadence_speed_matrix",
        }
        garmin_csv_docs = []
        if not chart or chart in csv_chart_ids:
            csv_query = {
                "athlete_id": athlete_id,
                "inactive_duplicate": {"$ne": True},
                "$or": [
                    {"avg_ground_contact_time_ms": {"$ne": None}},
                    {"avg_vertical_oscillation_cm": {"$ne": None}},
                    {"avg_vertical_ratio_pct": {"$ne": None}},
                    {"avg_stride_length_m": {"$ne": None}},
                    {"avg_cadence_spm": {"$ne": None}},
                ],
            }
            csv_cutoff = _range_cutoff(range_key, _latest_analytics_date(runs) or dt.date.today())
            if csv_cutoff:
                csv_query["date"] = {"$gte": csv_cutoff.isoformat()}
            garmin_csv_docs = await db.garmin_csv_data.find(csv_query, garmin_csv_projection()).sort("date", 1).to_list(3000)
            garmin_csv_docs = _filter_runs_for_range(garmin_csv_docs, range_key)
            if skip_runs_for_csv_chart and not garmin_csv_docs:
                q = fast_valid_outdoor_runs_query(athlete_id)
                all_runs = await db.runs.find(q, analytics_run_projection()).sort("date", 1).to_list(3000)
                all_runs = [_normalise_run_quality_fields(dict(r)) for r in all_runs]
                runs = _filter_runs_for_range(all_runs, range_key)
        biomech_charts = _build_biomechanics_charts(runs, resolved_resolution, current_vdot, garmin_csv_docs, chart)
        sections["biomechanics"] = {"charts": biomech_charts}

    if not detail:
        for section in sections.values():
            for chart_payload in section.get("charts", {}).values():
                chart_payload["series_detail"] = chart_payload.get("series_card", [])

    payload = {
        "generated_at": dt.datetime.now().isoformat(),
        "schema_version": ANALYTICS_SCHEMA_VERSION,
        "filters": {
            "tab": tab,
            "range": range_key,
            "resolution": resolved_resolution,
            "detail": detail,
            "chart": chart,
            "excluded": ["treadmill", "missing_gps"],
        },
        "diagnostics": diagnostics,
        "sections": sections,
    }
    await db.analytics_cache.replace_one(
        {"athlete_id": athlete_id, "cache_key": cache_key},
        {"athlete_id": athlete_id, "cache_key": cache_key, "payload": payload, "generated_at": payload["generated_at"]},
        upsert=True,
    )
    return payload


@app.get("/api/analytics")
async def get_analytics():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # Escludi tapis roulant e corse senza GPS da tutte le metriche analitiche.
    q_stats = valid_outdoor_runs_query(athlete_id)
    runs = await db.runs.find(q_stats).sort("date", -1).to_list(500)
    profile = await db.profile.find_one(q)
    max_hr = int(profile.get("max_hr", 190)) if profile else 190
    resting_hr = int(profile.get("resting_hr", 50)) if profile else 50

    # Field test override: VDOT autoritativo se test recente
    vdot, from_field_test = await _get_active_vdot(athlete_id, runs, max_hr, resting_hr)

    # CTL latest per endurance-aware race predictions
    ff_latest = await db.fitness_freshness.find_one(q, sort=[("date", -1)])
    ctl_now = (ff_latest or {}).get("ctl") if ff_latest else None

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

    # Goal gap (race predictions endurance-aware)
    preds_full = _predict_race(vdot, runs=runs, ctl=ctl_now) if vdot else {}
    preds_temp = _predict_race_temp_bands(vdot, runs=runs, ctl=ctl_now) if vdot else {"bands": []}
    goal_gap = None
    if profile and profile.get("target_time") and vdot:
        goal_gap = {
            "target": profile.get("target_time"),
            "race": profile.get("race_goal"),
            "predicted": preds_full.get(profile.get("race_goal")),
        }

    return {
        "vdot": vdot,
        "race_predictions": preds_full,
        "race_predictions_temp": preds_temp,
        "pace_trend": pace_trend,
        "zone_distribution": zone_dist,
        "goal_gap": goal_gap,
    }


@app.get("/api/prediction-history")
async def get_prediction_history():
    # Return stored predictions or compute from run history
    docs = await db.prediction_history.find().sort("date", 1).to_list(100)
    return {"predictions": oids(docs)}


# ═══════════════════════════════════════════════════════════════════════════════
#  FIELD TEST (pace-only VDOT benchmark)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Test sul campo a max intensità: distanza fissa (3K/5K/6K) + tempo cronometrato.
# Usato come benchmark VDOT ufficiale, sovrascrive _calc_vdot da runs history.
# Solo pace, NO heart rate (utente: HR polso inaffidabile per artefatti).

async def _get_active_vdot(athlete_id, runs, max_hr, resting_hr):
    """Restituisce VDOT attivo: field test recente (<90gg) se presente, else _calc_vdot.

    Field test = benchmark autoritativo, sovrascrive calcoli da runs history.
    """
    q = {"athlete_id": athlete_id} if athlete_id else {}
    cutoff = (dt.datetime.utcnow() - dt.timedelta(days=90)).isoformat()
    test = await db.field_tests.find_one(
        {**q, "date": {"$gte": cutoff}},
        sort=[("date", -1)],
    )
    if test and test.get("vdot"):
        return float(test["vdot"]), True  # (vdot, from_field_test)
    fallback = _calc_vdot(runs, max_hr, resting_hr=resting_hr)
    return fallback, False


@app.post("/api/field-test")
async def post_field_test(payload: dict = Body(...)):
    """Registra field test pace-only.

    Body: {distance_km: 3|5|6, time_seconds: int, date?: ISO}
    Calcola VDOT via Daniels reverse formula. NO heart rate.
    """
    dist_km = payload.get("distance_km")
    time_sec = payload.get("time_seconds")
    date = payload.get("date") or dt.datetime.utcnow().isoformat()
    if dist_km not in (3, 5, 6, 3.0, 5.0, 6.0):
        raise HTTPException(status_code=400, detail="distance_km must be 3, 5, or 6")
    if not time_sec or time_sec <= 0:
        raise HTTPException(status_code=400, detail="time_seconds must be > 0")
    vdot = _vdot_from_race(float(dist_km), float(time_sec))
    if not vdot:
        raise HTTPException(status_code=400, detail="invalid race data")
    athlete_id = await _get_athlete_id()
    doc = {
        "athlete_id": athlete_id,
        "distance_km": float(dist_km),
        "time_seconds": int(time_sec),
        "date": date,
        "vdot": vdot,
        "pace_sec_per_km": int(round(time_sec / dist_km)),
    }
    result = await db.field_tests.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@app.get("/api/field-test/latest")
async def get_field_test_latest():
    """Ultimo field test (qualsiasi data)."""
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    test = await db.field_tests.find_one(q, sort=[("date", -1)])
    if not test:
        return {"test": None}
    return {"test": oid(test)}


@app.get("/api/field-test/list")
async def get_field_test_list():
    """Cronologia field test."""
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    tests = await db.field_tests.find(q).sort("date", -1).to_list(50)
    return {"tests": oids(tests)}


@app.delete("/api/field-test/{test_id}")
async def delete_field_test(test_id: str):
    from bson import ObjectId
    try:
        result = await db.field_tests.delete_one({"_id": ObjectId(test_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="invalid test_id")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="test not found")
    return {"ok": True}


# ─── GAP (Grade Adjusted Pace) helpers ───────────────────────────────────────
def _grade_adjustment_sec(grade_pct: float) -> float:
    """Seconds/km to subtract from raw pace to get the flat-equivalent pace.

    Asymmetric, Minetti-style. A naive symmetric ~15s/%/km (Strava) badly
    overstates the benefit of running downhill: the metabolic saving going down
    is much smaller than the cost going up, and very steep descents add braking
    cost back. So:
      - Uphill   (grade > 0): ~12.5 s/km per 1%  (flat would be that much faster)
      - Downhill (grade < 0): ~7 s/km per 1% benefit, fading past -8% where
                              braking starts to cost, capped so a steep descent
                              never looks like a huge flat-pace gift.
    """
    if grade_pct >= 0:
        return grade_pct * 12.5
    g = abs(grade_pct)
    benefit_per_pct = 7.0 if g <= 8.0 else max(2.0, 7.0 - (g - 8.0) * 1.2)
    return -min(g * benefit_per_pct, 55.0)


def _gap_pace_seconds(run: dict) -> Optional[int]:
    """Grade-adjusted pace (sec/km) per-split, weighted by distance.

    Uses _grade_adjustment_sec (asymmetric uphill/downhill). Positive grade →
    GAP faster than raw; negative grade → GAP slower than raw, but with a much
    gentler downhill credit than a symmetric model.

    Returns None se splits insufficienti o data invalida.
    """
    splits = run.get("splits") or []
    dist_km = run.get("distance_km", 0) or 0
    if splits and len(splits) >= 1:
        total_gap_time = 0.0
        total_dist = 0.0
        for sp in splits:
            sp_pace_str = sp.get("pace", "")
            sp_dist_m = sp.get("distance", 1000) or 1000
            sp_elev = sp.get("elevation_difference") or 0
            if not sp_pace_str or ":" not in sp_pace_str:
                continue
            try:
                m, s = sp_pace_str.split(":")
                sp_pace = int(m) * 60 + int(s)
            except Exception:
                continue
            if sp_dist_m <= 0:
                continue
            sp_grade_pct = (sp_elev / sp_dist_m) * 100
            sp_gap = sp_pace - _grade_adjustment_sec(sp_grade_pct)
            sp_km = sp_dist_m / 1000.0
            total_gap_time += sp_gap * sp_km
            total_dist += sp_km
        if total_dist > 0:
            return int(round(total_gap_time / total_dist))
    # Fallback: avg_pace + net elevation
    avg_pace = run.get("avg_pace", "")
    if not avg_pace or ":" not in avg_pace or dist_km < 1:
        return None
    try:
        m, s = avg_pace.split(":")
        raw_sec = int(m) * 60 + int(s)
    except Exception:
        return None
    net_elev = sum((sp.get("elevation_difference") or 0) for sp in (splits or []))
    grade_pct = (net_elev / (dist_km * 1000)) * 100 if dist_km > 0 else 0
    return int(round(raw_sec - _grade_adjustment_sec(grade_pct)))


def _format_secs(sec: int) -> str:
    if not sec or sec <= 0:
        return ""
    return f"{sec // 60}:{sec % 60:02d}"


def _best_interval_pace_sec(streams: list, target_m: float) -> Optional[int]:
    """Trova passo migliore (sec/km) su segmento contiguo `target_m`.

    Sliding window sui streams downsampled (~500 punti per run).
    Per ripetute 400m/600m/800m/1000m: scopre best effort anche
    se annidato in run più lungo (esempio: 8x400m con rec dentro un 10K).

    Returns None se streams insufficienti.
    """
    if not streams or len(streams) < 2:
        return None
    n = len(streams)
    best_pace = float("inf")
    # Pre-compute d array
    ds = [s.get("d") for s in streams]
    paces = [s.get("pace") for s in streams]
    for i in range(n):
        start_d = ds[i]
        if start_d is None:
            continue
        end_d = start_d + target_m
        # Cerca j minimo dove d >= end_d
        j = i + 1
        while j < n and (ds[j] is None or ds[j] < end_d):
            j += 1
        if j >= n:
            break  # finestra fuori range, segmenti rimanenti più corti
        # Calcola tempo segment integrando pace su distanze
        total_time = 0.0
        last_d = start_d
        valid = True
        for k in range(i + 1, j + 1):
            d = ds[k]
            p = paces[k]
            if d is None or p is None or p <= 0:
                continue
            seg_d = d - last_d
            if seg_d <= 0:
                last_d = d
                continue
            total_time += (seg_d / 1000.0) * p
            last_d = d
        if not valid or total_time <= 0:
            continue
        # Aggiusta a target esatto (segment leggermente più lungo di target)
        actual_d = ds[j] - start_d
        if actual_d <= 0:
            continue
        pace_for_target = total_time / (actual_d / 1000.0)
        if pace_for_target < best_pace:
            best_pace = pace_for_target
    return int(round(best_pace)) if best_pace < float("inf") else None


def _compute_best_intervals(streams: list) -> dict:
    """Calcola best pace per ripetute standard. Pre-compute al sync.

    Range completo 400m → 3000m per coprire tutti i tipi di workout:
      400/600/800m  → speed/R-pace (sprint, neuromuscular)
      1000/1200m    → VO2max/I-pace (Veronique Billat, Daniels I)
      1500/2000m    → cruise interval (tra I e T)
      3000m         → T-pace sustained / 3K race
    """
    if not streams:
        return {}
    targets = [
        ("400m", 400),
        ("600m", 600),
        ("800m", 800),
        ("1000m", 1000),
        ("1200m", 1200),
        ("1500m", 1500),
        ("2000m", 2000),
        ("3000m", 3000),
    ]
    out = {}
    for label, target_m in targets:
        p = _best_interval_pace_sec(streams, target_m)
        if p:
            out[f"best_{label}_sec"] = p
    return out


@app.get("/api/field-test/divergence")
async def get_field_test_divergence():
    """Smart detection: zone obsolete vs reality based on recent runs (GAP).

    Returns needs_recalibration=True when:
      - no_test: nessun field test
      - stale: ultimo test >60gg
      - divergence: ≥3 corse recenti con GAP più veloce del previsto
        (rispetto a T-pace/I-pace correnti)

    User decide se eseguire nuovo test. NO auto-recalc VDOT.
    """
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    latest_test = await db.field_tests.find_one(q, sort=[("date", -1)])

    if not latest_test:
        return {
            "needs_recalibration": True,
            "reason": "no_test",
            "age_days": None,
            "message": "Nessun field test. Registra benchmark pace-only.",
            "evidence": [],
        }

    # Age check
    try:
        test_date = dt.datetime.fromisoformat(latest_test["date"].replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        test_date = dt.datetime.utcnow()
    age_days = (dt.datetime.utcnow() - test_date).days

    if age_days > 60:
        return {
            "needs_recalibration": True,
            "reason": "stale",
            "age_days": age_days,
            "message": f"Field test di {age_days} giorni fa. Considera ricalibrare.",
            "evidence": [],
        }

    # Divergence check: corse dopo il test
    runs = await db.runs.find({
        **q,
        "is_treadmill": {"$ne": True},
        "date": {"$gte": latest_test["date"]},
    }).sort("date", -1).to_list(30)

    vdot = float(latest_test["vdot"])
    # Compute current I-pace e T-pace (Daniels classic da field test VDOT)
    def _pace_at(pct):
        vo2 = vdot * pct
        disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
        if disc < 0:
            return None
        v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
        if v <= 0:
            return None
        return int(round(1000 / (v / 60)))

    i_sec = _pace_at(0.98)   # I-pace (5K race pace, VO2max work)
    t_sec = _pace_at(0.88)   # T-pace (sustainable ~1h)
    r_sec = _pace_at(1.10)   # R-pace (sprint, neuromuscular)

    # Pace di riferimento per ogni distanza ripetuta:
    #   400/600/800m   → R-pace (sprint/speed)
    #   1000/1200m     → I-pace (VO2max)
    #   1500/2000m     → tra I e T (cruise interval)
    #   3000m          → T-pace (extended threshold)
    interval_specs = [
        ("400m",  "best_400m_sec",  r_sec, 5,  "R"),
        ("600m",  "best_600m_sec",  r_sec, 3,  "R"),
        ("800m",  "best_800m_sec",  i_sec, 5,  "I"),
        ("1000m", "best_1000m_sec", i_sec, 3,  "I"),
        ("1200m", "best_1200m_sec", i_sec, 2,  "I"),
        ("1500m", "best_1500m_sec", (i_sec + t_sec) // 2 if i_sec and t_sec else None, 3, "I/T"),
        ("2000m", "best_2000m_sec", (i_sec + t_sec) // 2 if i_sec and t_sec else None, 5, "I/T"),
        ("3000m", "best_3000m_sec", t_sec, 5, "T"),
    ]

    evidence = []
    for r in runs:
        gap = _gap_pace_seconds(r)
        duration = r.get("duration_minutes", 0) or 0
        dist = r.get("distance_km", 0) or 0
        matched = False
        # Priority 1: best interval over any distance 400m-3000m.
        # Iterate dalle ripetute brevi (più stringenti) verso le lunghe.
        # Se MATCH su una, skip resto (no double-count, segnale già preso).
        for label, field, ref_pace, delta, label_ref in interval_specs:
            best = r.get(field)
            if not best or not ref_pace:
                continue
            if best < (ref_pace - delta):
                evidence.append({
                    "date": r.get("date"),
                    "distance_km": round(dist, 1),
                    "duration_min": round(duration, 1),
                    "gap_pace": _format_secs(best),
                    "expected_i_pace": _format_secs(ref_pace),
                    "type": "interval_improvement",
                    "interval_detail": f"best {label} {_format_secs(best)} vs {label_ref} {_format_secs(ref_pace)}",
                })
                matched = True
                break

        if matched or not gap:
            continue

        # Priority 2: tempo runs lungo (≥25min, ≥5km) > T-pace - 10s
        if duration >= 25 and dist >= 5 and t_sec and gap < (t_sec - 10):
            evidence.append({
                "date": r.get("date"),
                "distance_km": round(dist, 1),
                "duration_min": round(duration, 1),
                "gap_pace": _format_secs(gap),
                "expected_t_pace": _format_secs(t_sec),
                "type": "threshold_improvement",
            })
        # Priority 3: short fast 3-8km < I-pace - 5s
        elif 3 <= dist <= 8 and i_sec and gap < (i_sec - 5):
            evidence.append({
                "date": r.get("date"),
                "distance_km": round(dist, 1),
                "duration_min": round(duration, 1),
                "gap_pace": _format_secs(gap),
                "expected_i_pace": _format_secs(i_sec),
                "type": "vo2max_improvement",
            })

    if len(evidence) >= 3:
        return {
            "needs_recalibration": True,
            "reason": "divergence",
            "age_days": age_days,
            "message": f"{len(evidence)} corse recenti più veloci del previsto. Zone potrebbero essere obsolete.",
            "evidence": evidence[:5],
        }

    return {
        "needs_recalibration": False,
        "reason": "fresh",
        "age_days": age_days,
        "message": f"Field test di {age_days} giorni fa, zone affidabili.",
        "evidence": [],
    }


@app.get("/api/vdot/paces")
async def get_vdot_paces():
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # Escludi tapis roulant e corse senza GPS da VDOT e paces.
    q_stats = valid_outdoor_runs_query(athlete_id)
    runs = await db.runs.find(q_stats).sort("date", -1).to_list(500)
    profile = await db.profile.find_one(q)
    max_hr = int(profile.get("max_hr", 190)) if profile else 190
    resting_hr = int(profile.get("resting_hr", 50)) if profile else 50
    # Field test override: se presente <90gg, sovrascrive VDOT calcolato
    vdot, from_field_test = await _get_active_vdot(athlete_id, runs, max_hr, resting_hr)
    if not vdot:
        return {"vdot": None, "paces": {}, "race_predictions": {}, "from_field_test": False}

    def pace_at_vo2_pct(pct: float) -> Optional[str]:
        """Calculate training pace (sec/km) at a given % of VO2max."""
        vo2 = vdot * pct
        disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
        if disc < 0:
            return None
        v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)  # m/min
        return _format_pace(v / 60) if v > 0 else None  # convert m/min → m/s for _format_pace

    # ── EMPIRICAL THRESHOLD PACE (rev. 2026-05 — feedback utente) ─────────────
    # Soglia anaerobica sostenibile = pace tenibile ~1h (lattato stabile).
    # Daniels "T-pace" tradizionale (86% VO2max) sovrastima per runner non
    # full-trained: assume tenuta completa. Realtà: VDOT calcolato su 5K
    # max effort, ma tenuta su 60min richiede endurance ancora da costruire.
    # → Theoretical T = pace_at_vo2_pct(0.81) ≈ HM pace, più conservativo.
    # → Empirical override solo con tempo runs lunghi (≥20 min), distanza
    #   ≥5km, HR stretta 87-90%, terreno piatto (|net elev|/km ≤ 6m), che
    #   esclude corse brevi downhill-favored e ripetute.
    def _parse_pace_to_secs(pace_str: str) -> int:
        """'5:42' → 342. Returns 0 on bad input."""
        try:
            parts = pace_str.split(":")
            if len(parts) != 2:
                return 0
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 0

    def _secs_to_pace_str(secs: int) -> str:
        if secs <= 0:
            return ""
        m = secs // 60
        s = secs % 60
        return f"{m}:{s:02d}"

    def _net_elev_per_km(run: dict) -> float:
        """|net elevation change| / distance_km in m/km. 0 if no splits."""
        splits = run.get("splits") or []
        dist = run.get("distance_km", 0) or 0
        if not splits or dist <= 0:
            return 0
        net = sum((s.get("elevation_difference") or 0) for s in splits)
        return abs(net) / dist

    threshold_empirical = None
    tempo_runs = []
    for r in runs:
        if r.get("is_treadmill"):
            continue
        hr_pct = r.get("avg_hr_pct")
        if hr_pct is None:
            continue
        # avg_hr_pct may come as fraction (0.87) or percent (87)
        pct = hr_pct / 100.0 if hr_pct > 1 else hr_pct
        # Filtri stringenti per sustainable threshold:
        #   - ≥5km e ≥20 min (Daniels T-block sustained, esclude tempo brevi)
        #   - HR 87-90% (banda T stretta, evita bleed M-pace e VO2max)
        #   - terreno ~piatto (|net elev|/km ≤ 6m, esclude downhill-favored)
        if r.get("distance_km", 0) < 5:
            continue
        if (r.get("duration_minutes", 0) or 0) < 20:
            continue
        if not (0.87 <= pct <= 0.90):
            continue
        if _net_elev_per_km(r) > 6:
            continue
        tempo_runs.append(r)
        if len(tempo_runs) >= 8:
            break

    # Empirical override: solo se mediana tempo runs cade vicino al T-pace
    # race-derived (computed below). Sanity-clamp dopo aver calcolato T.
    if len(tempo_runs) >= 3:
        paces = sorted(filter(None, [_parse_pace_to_secs(r.get("avg_pace", "")) for r in tempo_runs]))
        paces = [p for p in paces if p > 0]
        if paces:
            median = paces[len(paces) // 2]
            # Senza anchor T-pace ancora computato: usa clamp largo basato
            # su pace_at_vo2_pct(0.81) come reference legacy
            ref = pace_at_vo2_pct(0.81)
            ref_sec = _parse_pace_to_secs(ref) if ref else 0
            if ref_sec:
                lo = ref_sec - 10
                hi = ref_sec + 40
                if lo <= median <= hi:
                    threshold_empirical = _secs_to_pace_str(median)
            else:
                threshold_empirical = _secs_to_pace_str(max(150, min(500, median)))

    # CTL latest per endurance-aware race predictions
    ff_latest = await db.fitness_freshness.find_one(q, sort=[("date", -1)])
    ctl_now = (ff_latest or {}).get("ctl") if ff_latest else None

    # ── Training Paces (pace-only, no HR) ──────────────────────────────────
    # Se field test attivo: VDOT autoritativo, applica Daniels classico
    # standard (nessuna fraction penalty: utente ha già dimostrato VDOT reale).
    # Se nessun field test: fraction model basato su runs history.
    end_ctx = _compute_endurance_context(runs)
    preds_full = _predict_race(vdot, runs=runs, ctl=ctl_now)

    if from_field_test:
        # VDOT da field test = potenziale attuale realmente espresso.
        # Daniels classico applicabile direttamente.
        # E 65%, M 80% (tenuta-adjusted), T 88%, I 98%, R 110%
        # M-pace ridotto se manca endurance per long runs
        longest = end_ctx["longest_km"]
        if longest >= 25:
            m_pct = 0.80
        elif longest >= 18:
            m_pct = 0.78
        elif longest >= 12:
            m_pct = 0.76
        else:
            m_pct = 0.74

        paces_out = {
            "easy":       pace_at_vo2_pct(0.65),
            "marathon":   pace_at_vo2_pct(m_pct),
            "threshold":  pace_at_vo2_pct(0.88),   # T Daniels classico: VDOT è reale
            "threshold_peak": pace_at_vo2_pct(0.88),
            "threshold_empirical": threshold_empirical,
            "interval":   pace_at_vo2_pct(0.98),
            "repetition": pace_at_vo2_pct(1.10),
        }
    else:
        # Nessun field test → zone CONSERVATIVE ma DINAMICHE (rev. 2026-06-11).
        # Storia: i valori erano hardcoded (T 4:32, verdict 2026-05) perché il
        # VDOT era sistematicamente distorto (niente correzione caldo, penalità
        # drift sui negative split, HR ramp-up non gestito). Con quei bias
        # corretti, congelare le zone crea l'errore opposto: 11/06 l'utente ha
        # corso 4:21/km per 22min SOTTO la banda HR di soglia (86-87%) con
        # 20.6°C/76% — il 4:32 fisso era ormai 10-15s/km troppo lento.
        # T sostenibile ~1h = 81% VO2max (non Daniels classico 86-88%, che
        # assume tenuta endurance completa). M scalato sulla tenuta reale.
        # M = passo maratona PREVISTO (endurance-aware), non il teorico dal
        # motore: senza tenuta da maratona il teorico (0.74-0.78) esce 40s/km
        # piu' veloce della previsione gara stessa — incoerenza visibile.
        m_secs_total = _time_to_seconds(preds_full.get("Marathon"))
        m_pace = (_secs_to_pace_str(int(round(m_secs_total / 42.195)))
                  if m_secs_total else pace_at_vo2_pct(0.74))
        i_pace = pace_at_vo2_pct(0.98) or "4:20"   # I: da VDOT reale (VO2max work)
        i_sec = _parse_pace_to_secs(i_pace)
        r_pace = _secs_to_pace_str(i_sec - 15) if i_sec else "4:05"  # R: I − 15s
        paces_out = {
            "easy":       pace_at_vo2_pct(0.60),   # E: conversazionale; resta la zona
                                                   # piu' lenta anche con M penalizzato
            "marathon":   m_pace,                  # M: dalla previsione endurance-aware
            "threshold":  pace_at_vo2_pct(0.81),   # T: sustainable ~1h
            "threshold_peak": pace_at_vo2_pct(0.86),  # T Daniels classico (peak)
            "threshold_empirical": threshold_empirical,
            "interval":   i_pace,        # I: VDOT-driven (motore, confermato sul campo)
            "repetition": r_pace,        # R: I − 15s (sprint/neuromuscular)
        }

    return {
        "vdot": vdot,
        "from_field_test": from_field_test,
        "paces": paces_out,
        "race_predictions": preds_full,
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
    q = {
        "is_treadmill": {"$ne": True},
        "strava_id": {"$exists": True, "$ne": None},
    }
    if athlete_id:
        q["athlete_id"] = athlete_id
    profile_q = {"athlete_id": athlete_id} if athlete_id else {}
    profile, ff_latest = await asyncio.gather(
        db.profile.find_one(profile_q),
        db.fitness_freshness.find_one(profile_q, sort=[("date", -1)]),
    )
    max_hr = int((profile or {}).get("max_hr", 190) or 190)
    resting_hr = int((profile or {}).get("resting_hr", 50) or 50)
    runs = await db.runs.find(q, analytics_run_projection()).sort("date", -1).to_list(80)
    today = dt.date.today()

    # Athlete-relative intensity cutoffs from VDOT (Daniels paces). Used to
    # classify stimulus by REAL intensity instead of a fixed pace, and to keep
    # heat-inflated HR from mislabelling an easy long run as metabolic.
    _athlete_vdot = _calc_vdot(runs, max_hr, resting_hr=resting_hr)
    if _athlete_vdot:
        _paces = _tp_daniels_paces(_athlete_vdot)
        _threshold_pace_s = _parse_pace_sec(_paces.get("threshold")) or 270
        _marathon_pace_s = _parse_pace_sec(_paces.get("marathon")) or 315
    else:
        _threshold_pace_s, _marathon_pace_s = 270, 315  # fallbacks (~4:30 / ~5:15)

    def _safe_float(value, default=0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _safe_int(value, default=0) -> int:
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return default

    def _normalised_cadence(run: dict) -> Optional[float]:
        return _cadence_spm_from_run(run)

    def _format_date_label(value: Optional[str]) -> str:
        d = _analytics_date(value or "")
        if not d:
            return str(value or "")
        return d.strftime("%d/%m")

    def _adaptation_for_run(run: dict) -> tuple[str, str, int, str]:
        distance = _safe_float(run.get("distance_km"), 0)
        duration = _safe_float(run.get("duration_minutes"), 0)
        pace_s = _parse_pace_sec(run.get("avg_pace"))
        hr = _safe_float(run.get("avg_hr"), 0)
        hr_pct = hr / max_hr if max_hr > 0 and hr > 0 else 0
        cadence = _normalised_cadence(run) or 0
        elevation = _safe_float(run.get("elevation_gain"), 0)
        text = " ".join(str(run.get(k) or "") for k in ("name", "run_type", "notes")).lower()

        # Real intensity = pace corrected for grade (GAP) and weather, so a slow
        # easy run in the heat — high HR from thermoregulation, not effort — is
        # not mistaken for a threshold/metabolic session. Heat makes you slower,
        # so the cool/flat-equivalent pace is FASTER than raw; that is the pace
        # we compare against the athlete's Daniels zones.
        gap_s = _gap_pace_seconds(run)
        base_pace_s = gap_s if (gap_s and 150 <= gap_s <= 700) else pace_s
        env_delta = _environmental_pace_adjustment_sec_per_km(run)
        effort_pace_s = (base_pace_s - env_delta) if base_pace_s else None

        # Intensity bands relative to the athlete (not fixed seconds).
        is_quality = effort_pace_s is not None and effort_pace_s <= _threshold_pace_s + 20
        is_easy = effort_pace_s is None or effort_pace_s >= _marathon_pace_s + 15

        neuromuscular_keys = ("repetition", "ripet", "sprint", "strides", "fartlek", "hill sprint", "salite brevi")
        metabolic_keys = ("tempo", "threshold", "soglia", "interval", "progressive", "medio", "vo2")
        structural_keys = ("long", "lungo", "trail", "hilly", "collinare", "easy lungo")

        if (
            any(k in text for k in neuromuscular_keys)
            or (duration <= 45 and effort_pace_s is not None and effort_pace_s <= 300 and (hr_pct >= 0.82 or cadence >= 178))
            or (duration <= 40 and cadence >= 182)
        ):
            return "Neuromuscolare", "neuromuscular", 7, "Velocita, coordinazione e reclutamento muscolare"

        # Genuine metabolic stimulus: real pace at/near threshold, OR explicit
        # quality keyword. HR alone is NOT enough — heat inflates it.
        if any(k in text for k in metabolic_keys) or (20 <= duration <= 75 and is_quality):
            return "Metabolico", "metabolic", 14, "Soglia, mitocondri ed economia aerobica"

        # Structural: long volume or clearly easy aerobic work (incl. easy long
        # runs in the heat that previously leaked into the metabolic bucket).
        if (
            any(k in text for k in structural_keys)
            or distance >= 14
            or duration >= 70
            or elevation >= 250
            or ((distance >= 10 or duration >= 60) and is_easy)
        ):
            return "Strutturale", "structural", 21, "Volume aerobico e resilienza tissutale"

        # Moderate continuous effort (between easy and threshold) → metabolic.
        if 20 <= duration <= 75 and not is_easy:
            return "Metabolico", "metabolic", 14, "Soglia, mitocondri ed economia aerobica"

        if distance >= 10 or duration >= 60:
            return "Strutturale", "structural", 21, "Volume aerobico e resilienza tissutale"

        return "Metabolico", "metabolic", 14, "Stimolo aerobico generale"

    recent_runs = []
    for run in runs:
        run_date = _analytics_date(run.get("date", ""))
        if not run_date:
            continue
        distance = _safe_float(run.get("distance_km"), 0)
        duration = _safe_float(run.get("duration_minutes"), 0)
        adaptation_type, adaptation_key, window_days, reason = _adaptation_for_run(run)
        elapsed_days = max(0, (today - run_date).days)
        raw_progress = (elapsed_days / window_days) * 100 if window_days > 0 else 100
        benefit_progress_pct = round(max(0, min(100, raw_progress)))
        missing_pct = round(max(0, 100 - raw_progress))
        days_remaining = max(0, window_days - elapsed_days)
        hr = _safe_float(run.get("avg_hr"), 0)
        hr_factor = 1.0 + max(0.0, (hr / max_hr) - 0.70) * 1.8 if max_hr > 0 and hr > 0 else 1.0
        load = round(max(0.0, distance * max(duration, 1) / 10 * hr_factor), 1)
        benefit_date = run_date + dt.timedelta(days=window_days)

        recent_runs.append({
            "id": str(run.get("_id") or run.get("id") or ""),
            "strava_id": run.get("strava_id"),
            "date": run.get("date"),
            "date_label": _format_date_label(run.get("date")),
            "name": run.get("name") or run.get("run_type") or "Corsa",
            "distance_km": round(distance, 2),
            "duration_minutes": round(duration, 1),
            "avg_pace": run.get("avg_pace"),
            "avg_hr": _safe_int(run.get("avg_hr"), 0) or None,
            "run_type": run.get("run_type"),
            "adaptation_type": adaptation_type,
            "adaptation_key": adaptation_key,
            "benefit_window_days": window_days,
            "benefit_date": benefit_date.isoformat(),
            "benefit_progress_pct": benefit_progress_pct,
            "missing_pct": missing_pct,
            "days_remaining": days_remaining,
            "load": load,
            "reason": reason,
            "_date_obj": run_date,
        })
        if len(recent_runs) >= 20:
            break

    totals = {
        "neuromuscular": {"label": "Neuromuscolare", "load": 0.0, "runs": 0, "missing_pct": 0, "ready_pct": 0, "color": "#D4FF00"},
        "metabolic": {"label": "Metabolico", "load": 0.0, "runs": 0, "missing_pct": 0, "ready_pct": 0, "color": "#F59E0B"},
        "structural": {"label": "Strutturale", "load": 0.0, "runs": 0, "missing_pct": 0, "ready_pct": 0, "color": "#6366F1"},
    }
    for item in recent_runs:
        bucket = totals[item["adaptation_key"]]
        bucket["load"] += item["load"]
        bucket["runs"] += 1
        bucket["missing_pct"] += item["missing_pct"]
        bucket["ready_pct"] += item["benefit_progress_pct"]

    for bucket in totals.values():
        count = bucket["runs"] or 1
        bucket["load"] = round(bucket["load"], 1)
        bucket["missing_pct"] = round(bucket["missing_pct"] / count)
        bucket["ready_pct"] = round(bucket["ready_pct"] / count)

    investments = [
        {
            "date": item["date"],
            "load": item["load"],
            "type": item["run_type"],
            "adaptation_type": item["adaptation_type"],
        }
        for item in recent_runs[:10]
    ]

    latest_tsb = ff_latest.get("tsb") if ff_latest else None
    total_load = sum(item["load"] for item in recent_runs) or 1.0
    category_load = {
        key: max(1.0, sum(item["load"] for item in recent_runs if item["adaptation_key"] == key))
        for key in totals
    }

    projection = []
    best_projection = None
    for i in range(21):
        d = today + dt.timedelta(days=i)
        raw_category_scores = {"neuromuscular": 0.0, "metabolic": 0.0, "structural": 0.0}
        matured_total = 0.0
        for item in recent_runs:
            elapsed_on_day = max(0, (d - item["_date_obj"]).days)
            window = item["benefit_window_days"] or 1
            if elapsed_on_day <= window:
                maturity = elapsed_on_day / window
            else:
                maturity = max(0.0, 1.0 - ((elapsed_on_day - window) / max(1.0, window * 0.75)))
            contribution = item["load"] * maturity
            raw_category_scores[item["adaptation_key"]] += contribution
            matured_total += contribution

        adaptation_ready = max(0.0, min(100.0, (matured_total / total_load) * 100))
        if latest_tsb is not None:
            freshness = max(0.0, min(100.0, 50 + float(latest_tsb) * 1.4 + i * 0.6))
            readiness = adaptation_ready * 0.62 + freshness * 0.38
        else:
            freshness = None
            readiness = adaptation_ready

        row = {
            "date": d.isoformat(),
            "label": d.strftime("%d/%m"),
            "neuromuscular": round(min(100.0, raw_category_scores["neuromuscular"] / category_load["neuromuscular"] * 100), 1),
            "metabolic": round(min(100.0, raw_category_scores["metabolic"] / category_load["metabolic"] * 100), 1),
            "structural": round(min(100.0, raw_category_scores["structural"] / category_load["structural"] * 100), 1),
            "adaptation_ready": round(adaptation_ready, 1),
            "readiness": round(readiness, 1),
            "fitness": round(readiness, 1),
            "tsb": round(float(latest_tsb), 1) if latest_tsb is not None else None,
            "freshness": round(freshness, 1) if freshness is not None else None,
        }
        projection.append(row)
        if best_projection is None or row["readiness"] > best_projection["readiness"]:
            best_projection = row

    golden_day = best_projection["date"] if best_projection and recent_runs else None
    days_to_golden = (dt.date.fromisoformat(golden_day) - today).days if golden_day else None
    public_recent_runs = []
    for item in recent_runs:
        public_item = dict(item)
        public_item.pop("_date_obj", None)
        public_recent_runs.append(public_item)

    return {
        "investments": investments,
        "golden_day": golden_day,
        "days_to_golden": days_to_golden,
        "projection": projection,
        "recent_runs": public_recent_runs,
        "adaptation_totals": totals,
        "golden_day_score": best_projection["readiness"] if best_projection and recent_runs else None,
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
    q = valid_outdoor_runs_query(athlete_id)

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

    # ── Merge PB manuali dal profilo ──────────────────────────────────────────
    # Corse importate senza splits/streams (es. Garmin CSV) non sono visibili
    # al calcolo sopra: il PB inserito a mano nel profilo vince se più veloce.
    profile_doc = await db.profile.find_one({"athlete_id": athlete_id} if athlete_id else {}) or {}
    profile_pbs = profile_doc.get("pbs") or {}
    pb_key_map = {
        "1 km": ["1K", "1k", "1000"],
        "5 km": ["5K", "5k", "5000"],
        "10 km": ["10K", "10k", "10000"],
        "15 km": ["15K", "15k"],
        "Mezza Maratona": ["Half Marathon", "Mezza", "Mezza Maratona", "21K", "21k"],
        "Maratona": ["Marathon", "Maratona", "42K", "42k"],
    }
    target_m_by_label = {t[0]: t[1] for t in targets}

    def _pb_time_to_secs(value: str) -> Optional[float]:
        try:
            parts = [float(p) for p in str(value).strip().split(":")]
        except ValueError:
            return None
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        return None

    for label, profile_keys in pb_key_map.items():
        entry_key = next((k for k in profile_pbs if any(k.lower() == c.lower() for c in profile_keys)), None)
        if not entry_key:
            continue
        pb = profile_pbs.get(entry_key) or {}
        pb_secs = _pb_time_to_secs(pb.get("time", ""))
        if not pb_secs or pb_secs <= 0:
            continue
        pace_s = pb_secs / (target_m_by_label[label] / 1000.0)
        if pace_s < MIN_PACE_S:
            continue
        if bests.get(label) is None or pace_s < bests[label]["pace_s"]:
            bests[label] = {
                "distance": label,
                "time": _secs_to_time(pb_secs),
                "pace": _secs_to_time(pace_s) + "/km",
                "pace_s": pace_s,
                "date": pb.get("date", ""),
                "run_id": "",
            }

    result = [v for v in bests.values() if v is not None]
    order = [t[0] for t in targets]
    result.sort(key=lambda x: order.index(x["distance"]) if x["distance"] in order else 99)
    return {"efforts": [{k: v[k] for k in ("distance", "time", "pace", "date", "run_id")} for v in result]}


@app.get("/api/heatmap")
async def get_heatmap():
    athlete_id = await _get_athlete_id()
    q = valid_outdoor_runs_query(athlete_id)
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
@limiter.limit("10/minute")
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
    """Multi-provider AI with exhaustive fallback chain:

    L1: Claude Haiku 4.5 (if ANTHROPIC_API_KEY has credits)
    L2: Gemini — tries BOTH keys (JARVIS_GEMINI_KEY, GEMINI_API_KEY) against
        multiple models in order of free-tier generosity:
        gemini-2.5-flash-lite → gemini-flash-lite-latest → gemini-flash-latest
        → gemini-2.5-flash → gemini-2.0-flash
    """
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

    # Level 2: Gemini — iterate over (key, model) pairs until one succeeds.
    # Order: lite models first (highest free-tier RPD), then heavier ones.
    _keys = []
    if JARVIS_GEMINI_KEY:
        _keys.append(("JARVIS", JARVIS_GEMINI_KEY))
    if GEMINI_API_KEY and GEMINI_API_KEY != JARVIS_GEMINI_KEY:
        _keys.append(("MAIN", GEMINI_API_KEY))

    _models = (
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
    )
    if _keys:
        from google import genai as ggenai
        for _kname, _kval in _keys:
            for _gmodel in _models:
                try:
                    gclient2 = ggenai.Client(api_key=_kval)
                    gresp2 = await gclient2.aio.models.generate_content(
                        model=_gmodel, contents=prompt
                    )
                    txt = (gresp2.text or "").strip()
                    if txt:
                        return txt
                except Exception as e:
                    print(f"[AI-L2] Gemini {_kname}/{_gmodel} failed: {type(e).__name__}: {e}")

    raise RuntimeError("All AI providers unavailable")


# ─── Dashboard Insight (AI commento Status Forma) ────────────────────────────
@app.get("/api/ai/dashboard-insight")
async def get_dashboard_insight():
    """Genera un commento AI 3-4 righe sul Status di Forma corrente.

    Cache su MongoDB per (athlete_id, last_run_id, ff_date) → rigenera
    automaticamente quando arriva una nuova corsa o il calcolo CTL/ATL si aggiorna.
    """
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    last_run = await db.runs.find_one(q, sort=[("date", -1)])
    ff_latest = await db.fitness_freshness.find_one(q, sort=[("date", -1)])

    if not ff_latest or not last_run:
        return {"insight": None, "cached": False}

    # Bump prompt_v when prompt changes → invalidates old cached entries
    cache_key = {
        "athlete_id": athlete_id or "",
        "last_run_id": str(last_run.get("_id")),
        "ff_date": str(ff_latest.get("date", "")),
        "prompt_v": "v2-metaphors",
    }
    cached = await db.ai_dashboard_insight.find_one(cache_key)
    if cached and cached.get("insight"):
        return {"insight": cached["insight"], "cached": True}

    tsb = float(ff_latest.get("tsb", 0) or 0)
    ctl = float(ff_latest.get("ctl", 0) or 0)
    atl = float(ff_latest.get("atl", 0) or 0)
    efficiency = max(70, min(100, 85 + tsb * 1.05))
    run_dist = float(last_run.get("distance_km", 0) or 0)
    run_pace = last_run.get("avg_pace", "—") or "—"
    run_hr = int(last_run.get("avg_hr", 0) or 0)

    # Stato in parole (non numeri)
    if tsb > 10:
        stato = "molto fresco, picco prestativo"
    elif tsb > -5:
        stato = "equilibrio, carico/recupero bilanciati"
    elif tsb > -20:
        stato = "affaticato, adattamento in corso"
    else:
        stato = "sovraccarico, rischio infortunio alto"

    # 8 stili metafora diversi — l'AI ne sceglie uno ogni volta per variare
    import random as _rnd
    stili = [
        ("Motore & Benzina",
         "Parla come se il corpo fosse un motore: surriscaldamento, centralina, benzina, garage, folle, autostrada. Le 'calorie/sforzo' sono il carburante."),
        ("Cantiere & Costruzione",
         "Parla come se l'allenamento fosse un cantiere: demolizione dei vecchi limiti, polvere/mattoni = stanchezza, operai che costruiscono nella notte, fondamenta, cemento che si asciuga, muratori, mattoni."),
        ("Banca & Investimento",
         "Parla come se l'energia fosse denaro: conto energetico, debito, investimento, capitale, ritorno sull'investimento, conto in rosso, risparmio, interessi."),
        ("Batteria & Centralina",
         "Parla come se il corpo fosse un dispositivo elettronico: batteria scarica/piena, centralina che taglia la potenza, modalità risparmio energetico, ricarica, bluetooth, firmware."),
        ("Giardino & Crescita",
         "Parla come se l'allenamento fosse coltivare un giardino: semi piantati, radici profonde, potatura, acqua, crescita lenta, fioritura, stagione dormiente, giardiniere."),
        ("Orchestra & Musicista",
         "Parla come se il corpo fosse un musicista: strumenti accordati, prova generale, stonato, pausa tra due concerti, direttore d'orchestra, spartito, armonia."),
        ("Guerriero & Battaglia",
         "Parla come se il runner fosse un guerriero: battaglia vinta, scudo abbassato, armi da riparare, fucina, accampamento, cicatrici che rendono più forti, campo di addestramento."),
        ("Cuoco & Ricetta",
         "Parla come se l'allenamento fosse cucina: ingredienti, forno caldo, riposare l'impasto, lievitazione, ricetta perfetta, chef, tempo di cottura, sale quanto basta."),
    ]
    stile_nome, stile_desc = _rnd.choice(stili)

    prompt = f"""Sei un coach sportivo italiano creativo. Scrivi un consiglio (3-4 righe MAX, 50-70 parole) per un runner principiante.

STATO ATTUALE del runner: {stato}
ULTIMA CORSA: {run_dist:.1f}km a {run_pace}/km, FC media {run_hr}bpm

REGOLE TASSATIVE:
- NON usare MAI i termini tecnici: TSB, CTL, ATL, TRIMP, VO2, VDOT, banister, trainingpeaks
- NON nominare numeri come "70%", "-14.5", "fitness 25" — l'utente vede già i dati, tu dai il SIGNIFICATO
- Usa OBBLIGATORIAMENTE la metafora "{stile_nome}"
- {stile_desc}
- Inizia con una frase d'impatto (non "Oggi il tuo..." — varia!)
- Chiudi con un consiglio pratico per domani (riposo/leggero/medio/forte)
- Massimo 1 emoji, tono caldo e amichevole, seconda persona ("tu")
- NO preamboli tipo "Ecco il consiglio:", vai diretto al contenuto

Rispondi SOLO con il testo, niente titoli, niente virgolette."""

    try:
        insight = await _call_ai_async(prompt, max_tokens=300)
    except Exception as e:
        print(f"[AI-insight] all providers failed: {type(e).__name__}: {e}")
        return {"insight": None, "cached": False, "error": str(e)}

    try:
        await db.ai_dashboard_insight.update_one(
            cache_key,
            {"$set": {"insight": insight, "updated_at": datetime.utcnow(), **cache_key}},
            upsert=True,
        )
    except Exception as e:
        print(f"[AI-insight] cache write failed: {e}")

    return {"insight": insight, "cached": False}


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

def _runner_dna_signature(
    athlete_id: Optional[int],
    runs: list,
    ff_docs: list,
    garmin_csv_docs: list,
) -> tuple[str, dict]:
    latest_run = runs[-1] if runs else {}
    latest_ff = ff_docs[0] if ff_docs else {}
    latest_csv = max(
        garmin_csv_docs,
        key=lambda d: str(d.get("linked_at") or d.get("imported_at") or d.get("date") or ""),
        default={},
    )
    csv_metric_rows = [
        "|".join([
            str(doc.get("_id") or doc.get("id") or ""),
            str(doc.get("date") or ""),
            str(doc.get("matched_run_id") or ""),
            str(doc.get("avg_cadence_spm") or ""),
            str(doc.get("avg_ground_contact_time_ms") or ""),
            str(doc.get("avg_vertical_oscillation_cm") or ""),
            str(doc.get("avg_vertical_ratio_pct") or ""),
            str(doc.get("avg_stride_length_m") or ""),
        ])
        for doc in garmin_csv_docs
    ]
    payload = {
        "schema": RUNNER_DNA_SCHEMA_VERSION,
        "athlete_id": athlete_id,
        "run_count": len(runs),
        "last_run": {
            "id": str(latest_run.get("_id") or latest_run.get("id") or latest_run.get("strava_id") or ""),
            "date": latest_run.get("date"),
            "distance": latest_run.get("distance_km"),
            "duration": latest_run.get("duration_minutes"),
            "cadence": _cadence_spm_from_run(latest_run),
            "garmin_csv_id": latest_run.get("garmin_csv_id"),
        },
        "latest_csv": {
            "id": str(latest_csv.get("_id") or latest_csv.get("id") or ""),
            "date": latest_csv.get("date"),
            "imported_at": latest_csv.get("imported_at"),
            "linked_at": latest_csv.get("linked_at"),
        },
        "active_csv_count": len(garmin_csv_docs),
        "matched_csv_count": sum(1 for d in garmin_csv_docs if d.get("matched_run_id")),
        "csv_metrics": csv_metric_rows,
        "fitness": {
            "date": latest_ff.get("date"),
            "ctl": latest_ff.get("ctl"),
            "atl": latest_ff.get("atl"),
            "tsb": latest_ff.get("tsb"),
        },
    }
    raw = json.dumps(payload, sort_keys=True, default=str)
    signature = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    freshness = {
        "schema_version": RUNNER_DNA_SCHEMA_VERSION,
        "data_signature": signature,
        "last_run_date": latest_run.get("date"),
        "last_run_id": str(latest_run.get("_id") or latest_run.get("id") or latest_run.get("strava_id") or ""),
        "latest_garmin_csv_date": latest_csv.get("date"),
        "latest_garmin_csv_imported_at": latest_csv.get("imported_at"),
        "active_garmin_csv": len(garmin_csv_docs),
        "matched_garmin_csv": sum(1 for d in garmin_csv_docs if d.get("matched_run_id")),
        "fitness_date": latest_ff.get("date"),
        "auto_recalculated": True,
    }
    return signature, freshness


async def _runner_dna_light_signature(athlete_id: Optional[int], q: dict) -> tuple[str, dict]:
    csv_q = _garmin_csv_active_query(athlete_id) if athlete_id else {}
    latest_run, latest_ff, latest_csv, run_count, active_csv, matched_csv = await asyncio.gather(
        db.runs.find_one(
            q,
            {"date": 1, "distance_km": 1, "duration_minutes": 1, "avg_cadence": 1, "avg_cadence_spm": 1, "biomechanics": 1, "garmin_csv_id": 1, "strava_id": 1},
            sort=[("date", -1)],
        ),
        db.fitness_freshness.find_one(q, sort=[("date", -1)]),
        db.garmin_csv_data.find_one(
            csv_q,
            {"date": 1, "imported_at": 1, "linked_at": 1, "matched_run_id": 1, "avg_cadence_spm": 1},
            sort=[("imported_at", -1), ("linked_at", -1), ("date", -1)],
        ) if athlete_id else asyncio.sleep(0, result={}),
        db.runs.count_documents(q),
        db.garmin_csv_data.count_documents(csv_q) if athlete_id else asyncio.sleep(0, result=0),
        db.garmin_csv_data.count_documents({**csv_q, "matched_run_id": {"$nin": [None, ""]}}) if athlete_id else asyncio.sleep(0, result=0),
    )
    payload = {
        "schema": RUNNER_DNA_SCHEMA_VERSION,
        "athlete_id": athlete_id,
        "run_count": run_count,
        "last_run": {
            "id": str((latest_run or {}).get("_id") or (latest_run or {}).get("strava_id") or ""),
            "date": (latest_run or {}).get("date"),
            "distance": (latest_run or {}).get("distance_km"),
            "duration": (latest_run or {}).get("duration_minutes"),
            "cadence": _cadence_spm_from_run(latest_run or {}),
            "garmin_csv_id": (latest_run or {}).get("garmin_csv_id"),
        },
        "latest_csv": {
            "id": str((latest_csv or {}).get("_id") or ""),
            "date": (latest_csv or {}).get("date"),
            "imported_at": (latest_csv or {}).get("imported_at"),
            "linked_at": (latest_csv or {}).get("linked_at"),
            "cadence": (latest_csv or {}).get("avg_cadence_spm"),
        },
        "active_csv_count": active_csv,
        "matched_csv_count": matched_csv,
        "fitness": {
            "date": (latest_ff or {}).get("date"),
            "ctl": (latest_ff or {}).get("ctl"),
            "atl": (latest_ff or {}).get("atl"),
            "tsb": (latest_ff or {}).get("tsb"),
        },
    }
    raw = json.dumps(payload, sort_keys=True, default=str)
    signature = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    freshness = {
        "schema_version": RUNNER_DNA_SCHEMA_VERSION,
        "data_signature": signature,
        "last_run_date": (latest_run or {}).get("date"),
        "last_run_id": str((latest_run or {}).get("_id") or (latest_run or {}).get("strava_id") or ""),
        "latest_garmin_csv_date": (latest_csv or {}).get("date"),
        "latest_garmin_csv_imported_at": (latest_csv or {}).get("imported_at"),
        "active_garmin_csv": active_csv,
        "matched_garmin_csv": matched_csv,
        "fitness_date": (latest_ff or {}).get("date"),
        "auto_recalculated": True,
    }
    return signature, freshness


def _build_runner_dna_diagnostics(
    vdot_current: float,
    consistency_score: int,
    load_score: int,
    eff_score: int,
    biomech_score: int,
    avg_cadence: Optional[float],
    avg_gct: Optional[float],
    avg_vert_osc: Optional[float],
    avg_vert_ratio: Optional[float],
    zone_dist: dict,
    freq: float,
    ctl: float,
    tsb: float,
) -> dict:
    easy_pct = int(zone_dist.get("z1", 0) + zone_dist.get("z2", 0))
    strengths: list[str] = []
    weaknesses: list[str] = []
    priorities: list[str] = []

    if vdot_current >= 44:
        strengths.append(f"Motore aerobico solido: VDOT {vdot_current:.1f}.")
    else:
        weaknesses.append(f"Motore aerobico migliorabile: VDOT {vdot_current:.1f}.")
        priorities.append("Aumenta la base aerobica con 2 uscite facili a settimana.")

    if consistency_score >= 70:
        strengths.append(f"Costanza buona: {freq:.1f} corse/settimana.")
    else:
        weaknesses.append(f"Costanza irregolare: {freq:.1f} corse/settimana.")
        priorities.append("Stabilizza prima la frequenza: 3 allenamenti/settimana per 4 settimane.")

    if load_score >= 65:
        strengths.append(f"Capacita di carico in crescita: CTL {ctl:.1f}.")
    else:
        weaknesses.append(f"Carico cronico basso: CTL {ctl:.1f}.")
        priorities.append("Incrementa il volume con progressione moderata, non oltre +8% a settimana.")

    if eff_score >= 70:
        strengths.append("Efficienza cardiaca buona: produci velocita con costo controllato.")
    elif eff_score < 55:
        weaknesses.append("Efficienza cardiaca da migliorare: il passo costa troppi battiti.")
        priorities.append("Inserisci corsa facile davvero facile e un progressivo corto ogni 7-10 giorni.")

    if avg_cadence:
        if 165 <= avg_cadence <= 185:
            strengths.append(f"Cadenza efficace: {round(avg_cadence)} spm.")
        else:
            weaknesses.append(f"Cadenza fuori range ideale: {round(avg_cadence)} spm.")
            priorities.append("Lavora su passi piu rapidi e leggeri con 6 allunghi da 15 secondi.")

    if avg_gct and avg_gct > 280:
        weaknesses.append(f"Contatto al suolo alto: {round(avg_gct)} ms.")
        priorities.append("Aggiungi tecnica di corsa e salite brevi per migliorare reattivita.")
    elif avg_gct:
        strengths.append(f"Contatto al suolo controllato: {round(avg_gct)} ms.")

    if avg_vert_osc and avg_vert_osc > 10:
        weaknesses.append(f"Oscillazione verticale alta: {avg_vert_osc:.1f} cm.")
    if avg_vert_ratio and avg_vert_ratio > 10:
        weaknesses.append(f"Rapporto verticale alto: {avg_vert_ratio:.1f}%.")

    if easy_pct >= 75:
        strengths.append(f"Distribuzione facile buona: {easy_pct}% in Z1/Z2.")
    else:
        weaknesses.append(f"Troppo lavoro medio/forte: solo {easy_pct}% in Z1/Z2.")
        priorities.append("Porta almeno il 75% del tempo in Z1/Z2 per assorbire meglio il carico.")

    if tsb < -20:
        weaknesses.append(f"Stress recente elevato: TSB {tsb:.1f}.")
        priorities.append("Programma 24-48 ore leggere prima del prossimo lavoro intenso.")

    if biomech_score < 55 and not any("tecnica" in p.lower() for p in priorities):
        priorities.append("Dedica 10 minuti post-riscaldamento a tecnica, mobilita e allunghi.")

    if not strengths:
        strengths.append("Hai dati sufficienti per costruire un profilo dinamico affidabile.")
    if not weaknesses:
        weaknesses.append("Nessuna carenza critica: il prossimo salto dipende da continuita e precisione.")
    if not priorities:
        priorities.append("Mantieni il carico attuale e rivaluta dopo il prossimo sync Strava/Garmin.")

    return {
        "strengths": strengths[:4],
        "weaknesses": weaknesses[:4],
        "priorities": priorities[:4],
    }


def _build_unlock_plan(
    vdot_current: float,
    vdot_ceiling: float,
    weekly_km: float,
    freq: float,
    easy_pct: int,
) -> dict:
    """Piano CONCRETO per sbloccare il margine VDOT: km, sedute, ritmi, ETA.

    Ritmi da Daniels (frazione di VO2max → velocità). Progressione volume +8%/
    settimana con scarico ogni 4ª. ETA dal tasso realistico di crescita VDOT
    per un amatore che allena bene: ~0.10-0.20 punti/settimana.
    """
    def _pace_at(pct: float) -> Optional[int]:
        vo2 = vdot_current * pct
        disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
        if disc < 0:
            return None
        v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
        return int(round(1000 / (v / 60))) if v > 0 else None

    def _fmt(sec: Optional[int]) -> str:
        return f"{sec // 60}:{sec % 60:02d}" if sec else "—"

    gain = max(0.0, round(vdot_ceiling - vdot_current, 1))
    t_pace = _pace_at(0.88)          # soglia (~1h race pace)
    i_pace = _pace_at(0.98)          # VO2max / ~5K
    e_lo, e_hi = _pace_at(0.72), _pace_at(0.62)  # forbice del facile

    cur_km = max(15.0, weekly_km or 20.0)
    target_km = int(min(58, max(cur_km + 8, round(cur_km * 1.35 / 5) * 5)))
    # settimane per arrivare al volume target a +8%/sett + 1 scarico ogni 4
    grow_weeks = 0
    k = cur_km
    while k < target_km and grow_weeks < 20:
        k *= 1.08
        grow_weeks += 1
    grow_weeks += grow_weeks // 3  # scarichi

    # ETA sul VDOT: 0.10-0.20 punti/settimana → forbice
    eta_min = max(4, int(round(gain / 0.20)))
    eta_max = min(52, max(eta_min + 2, int(round(gain / 0.10))))
    today = dt.date.today()
    d_min = today + dt.timedelta(weeks=eta_min)
    d_max = today + dt.timedelta(weeks=eta_max)
    MONTHS_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
    eta_label = f"{MONTHS_IT[d_min.month - 1]} {d_min.year} – {MONTHS_IT[d_max.month - 1]} {d_max.year}"

    steps = [
        {
            "title": f"Volume: da ~{int(round(cur_km))} a {target_km} km/sett",
            "detail": (
                f"Aggiungi ~8% a settimana ({int(round(cur_km))} → {int(round(cur_km * 1.08))} → "
                f"{int(round(cur_km * 1.08 ** 2))} km…), con 1 settimana di scarico (−25%) ogni 4. "
                f"A questo ritmo arrivi a {target_km} km/sett in ~{grow_weeks} settimane. "
                f"Distribuisci su {max(3, int(round(freq)))}-{max(4, int(round(freq)) + 1)} uscite."
            ),
        },
        {
            "title": f"Soglia: 1 seduta/sett a {_fmt(t_pace)}/km",
            "detail": (
                f"Parti da 2×10′ a ritmo soglia ({_fmt(t_pace)}/km, sforzo 'comodo-duro' tenibile ~1h) "
                f"con 2′ di recupero, e allunga di 2-3′ a settimana fino a 30-35′ totali "
                f"(es. 3×12′ o 25-30′ continui). È la seduta che sposta di più il VDOT."
            ),
        },
        {
            "title": f"Facile davvero facile: {_fmt(e_lo)}-{_fmt(e_hi)}/km",
            "detail": (
                f"Tutte le uscite non di qualità a {_fmt(e_lo)}-{_fmt(e_hi)}/km (conversazione piena). "
                f"Oggi sei al {easy_pct}% del tempo in Z1/Z2: portalo ad almeno il 75% "
                f"per assorbire il volume senza accumulare fatica."
            ),
        },
        {
            "title": f"Qualità VO2: ogni 7-10 giorni a {_fmt(i_pace)}/km",
            "detail": (
                f"Alterna 5×1000 a {_fmt(i_pace)}/km (recupero 2′ jog) e un progressivo corto "
                f"(8 km con gli ultimi 2 a {_fmt(t_pace)}/km). Una sola di queste a settimana: "
                f"la qualità funziona solo se il resto è davvero facile."
            ),
        },
    ]
    return {
        "gain": gain,
        "target_vdot": round(vdot_ceiling, 1),
        "eta_weeks_min": eta_min,
        "eta_weeks_max": eta_max,
        "eta_label": eta_label,
        "steps": steps,
    }


@app.get("/api/runner-dna")
async def get_runner_dna():
    """Dynamic athletic profile from Strava plus authoritative Garmin CSV telemetry."""
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}

    if athlete_id:
        await _ensure_fitness_freshness_current(athlete_id)

    data_signature, data_freshness = await _runner_dna_light_signature(athlete_id, q)
    cached = await db.runner_dna_cache.find_one({"athlete_id": athlete_id})
    if (
        cached
        and cached.get("data_signature") == data_signature
        and cached.get("schema_version") == RUNNER_DNA_SCHEMA_VERSION
        and cached.get("dna_data")
    ):
        return {"dna": cached["dna_data"]}

    runs = await db.runs.find(q, {"streams": 0, "polyline": 0}).sort("date", 1).to_list(1000)
    runs = [_normalise_run_quality_fields(dict(run)) for run in runs]
    profile = await db.profile.find_one(q) or {}
    ff_docs = await db.fitness_freshness.find(q).sort("date", -1).to_list(30)
    garmin_csv_docs = []
    if athlete_id:
        garmin_csv_docs = await db.garmin_csv_data.find(
            _garmin_csv_active_query(athlete_id),
            garmin_csv_projection(),
        ).sort("date", 1).to_list(3000)

    if len(runs) < 5:
        return JSONResponse({"error": "not_enough_data"}, status_code=400)

    matched_csv_ids = {
        str(run.get("garmin_csv_id") or (run.get("biomechanics") or {}).get("garmin_csv_id") or "")
        for run in runs
    }
    telemetry_runs = list(runs)
    for doc in garmin_csv_docs:
        csv_id = str(doc.get("_id") or doc.get("id") or "")
        if csv_id and csv_id not in matched_csv_ids:
            telemetry_runs.append(_garmin_csv_doc_to_run_like(doc))

    total_runs = len(runs)
    total_km = sum(float(r.get("distance_km") or 0) for r in runs)
    max_hr = int(profile.get("max_hr", 190) or 190)
    resting_hr = int(profile.get("resting_hr", 50) or 50)
    age = int(profile.get("age", 30) or 30)

    hr_runs = [r for r in runs if (r.get("avg_hr") or 0) > 0]
    avg_hr_all = _avg_number([r.get("avg_hr") for r in hr_runs], 0) or 0
    cadence_values = [_cadence_spm_from_run(r) for r in telemetry_runs]
    avg_cad_all = _avg_number(cadence_values, 0) or 0

    total_sec = sum(float(r.get("duration_minutes") or 0) * 60 for r in runs)
    avg_pace_sec_km = total_sec / total_km if total_km > 0 else 0

    zones = {"z1": 0.0, "z2": 0.0, "z3": 0.0, "z4": 0.0, "z5": 0.0}
    for run in hr_runs:
        pct = (float(run["avg_hr"]) / max_hr) * 100 if max_hr else 0
        dur = float(run.get("duration_minutes") or 0)
        if pct < 65:
            zones["z1"] += dur
        elif pct < 77:
            zones["z2"] += dur
        elif pct < 84:
            zones["z3"] += dur
        elif pct < 91:
            zones["z4"] += dur
        else:
            zones["z5"] += dur
    total_zone = sum(zones.values()) or 1
    zone_dist = {k: round(v / total_zone * 100) for k, v in zones.items()}

    # VDOT: stessa fonte canonica della dashboard (/api/vdot/paces) —
    # field test recente se presente, altrimenti _calc_vdot sulle sole corse
    # outdoor GPS (il set di runner-dna include anche tapis roulant/no-GPS,
    # che gonfiano il VDOT e creavano mismatch col valore in dashboard).
    vdot_runs = [
        r for r in runs
        if not r.get("is_treadmill")
        and (
            r.get("has_gps")
            or r.get("polyline")
            or (r.get("start_latlng") or [None])[0] is not None
        )
    ]
    active_vdot, _from_ft = await _get_active_vdot(athlete_id, vdot_runs or runs, max_hr, resting_hr)
    vdot_current = float(active_vdot or 28.0)

    cutoff_old = (dt.date.today() - dt.timedelta(weeks=24)).isoformat()
    older_runs = [r for r in (vdot_runs or runs) if str(r.get("date", "")) < cutoff_old]
    older_vdot = _calc_vdot(older_runs, max_hr, weeks_window=16, resting_hr=resting_hr) if len(older_runs) >= 3 else None
    vdot_delta = round(vdot_current - older_vdot, 1) if older_vdot else None

    try:
        first_run_d = dt.date.fromisoformat(str(runs[0]["date"])[:10])
        last_run_d = dt.date.fromisoformat(str(runs[-1]["date"])[:10])
        weeks_active = max(1.0, (last_run_d - first_run_d).days / 7)
    except Exception:
        weeks_active = 1.0

    # Uscite/settimana: giorni DISTINTI con almeno una corsa nelle ultime 12
    # settimane. Conteggiare i singoli doc gonfia il valore (warmup + lavoro
    # nello stesso giorno = 2-3 attività) e la media lifetime non riflette
    # l'abitudine attuale.
    try:
        freq_cutoff = (dt.date.today() - dt.timedelta(weeks=12)).isoformat()
        recent_dates = {str(r.get("date", ""))[:10] for r in runs if str(r.get("date", "")) >= freq_cutoff}
        recent_dates.discard("")
        if recent_dates:
            span_days = (dt.date.today() - dt.date.fromisoformat(min(recent_dates))).days
            freq_weeks = max(1.0, min(12.0, span_days / 7))
            freq = len(recent_dates) / freq_weeks
        else:
            freq = 0.0
    except Exception:
        freq = 0.0

    consistency_score = int(max(0, min(100, round((freq / 4.0) * 100))))

    eff_index_val = 0.0
    if avg_hr_all > 0 and avg_pace_sec_km > 0:
        speed_mpm = 1000 / avg_pace_sec_km * 60
        eff_index_val = speed_mpm / avg_hr_all
    eff_score = _score_range(eff_index_val, 0.9, 1.65) if eff_index_val else 45

    ctl = float(ff_docs[0].get("ctl", 0.0) or 0.0) if ff_docs else 0.0
    atl = float(ff_docs[0].get("atl", 0.0) or 0.0) if ff_docs else 0.0
    tsb = float(ff_docs[0].get("tsb", 0.0) or 0.0) if ff_docs else 0.0

    vert_osc_values = [_bio_value(r, "vo") for r in telemetry_runs]
    vert_ratio_values = [_bio_value(r, "vr") for r in telemetry_runs]
    gct_values = [_bio_value(r, "gct") for r in telemetry_runs]
    stride_values = [_bio_value(r, "stride") for r in telemetry_runs]

    def _count_available(values):
        return len([v for v in values if v is not None])

    avg_vert_osc = _avg_number(vert_osc_values, 1)
    avg_vert_ratio = _avg_number(vert_ratio_values, 1)
    avg_gct = _avg_number(gct_values, 0)
    avg_stride = _avg_number(stride_values, 2)

    cadence_score = _score_centered(avg_cad_all or None, 174, 28)
    biomech_parts = [cadence_score]
    if avg_gct is not None:
        biomech_parts.append(_score_lower_better(avg_gct, 200, 330))
    if avg_vert_osc is not None:
        biomech_parts.append(_score_lower_better(avg_vert_osc, 6, 12))
    if avg_vert_ratio is not None:
        biomech_parts.append(_score_lower_better(avg_vert_ratio, 6, 12))
    if avg_stride is not None:
        biomech_parts.append(_score_range(avg_stride, 0.85, 1.35))
    biomech_score = int(_avg_number(biomech_parts, 0) or 50)

    aerobic_score = _score_range(vdot_current, 28, 55)
    load_score = _score_range(ctl, 10, 70)
    current_strength = int(round(
        aerobic_score * 0.30
        + consistency_score * 0.20
        + load_score * 0.20
        + eff_score * 0.18
        + biomech_score * 0.12
    ))

    age_penalty = max(0.0, (age - 35) * 0.12)
    ceiling_gain = max(3.0, (100 - current_strength) / 12 + (70 - min(70, ctl)) / 28 - age_penalty)
    vdot_ceiling = round(max(vdot_current + 2.0, min(58.0, vdot_current + ceiling_gain)), 1)
    potential_pct = min(99, round((vdot_current / vdot_ceiling) * 100))
    improvement_potential = int(max(1, min(100, round(100 - current_strength + (vdot_ceiling - vdot_current) * 7))))

    ai_data = _algorithmic_dna(
        vdot=vdot_current,
        consistency_score=consistency_score,
        eff_score=eff_score,
        ctl=ctl,
        tsb=tsb,
        zone_dist=zone_dist,
        freq=freq,
        age=age,
    )

    diagnostics = _build_runner_dna_diagnostics(
        vdot_current=vdot_current,
        consistency_score=consistency_score,
        load_score=load_score,
        eff_score=eff_score,
        biomech_score=biomech_score,
        avg_cadence=avg_cad_all or None,
        avg_gct=avg_gct,
        avg_vert_osc=avg_vert_osc,
        avg_vert_ratio=avg_vert_ratio,
        zone_dist=zone_dist,
        freq=freq,
        ctl=ctl,
        tsb=tsb,
    )
    # Piano di sblocco dettagliato (km, sedute, ritmi, ETA) dal volume recente.
    try:
        km_cutoff = (dt.date.today() - dt.timedelta(days=28)).isoformat()
        recent_km = sum(
            float(r.get("distance_km") or 0)
            for r in runs
            if str(r.get("date", ""))[:10] >= km_cutoff
        )
        weekly_km_recent = recent_km / 4.0
    except Exception:
        weekly_km_recent = 0.0
    easy_pct_now = int(zone_dist.get("z1", 0) + zone_dist.get("z2", 0))
    diagnostics["unlock_plan"] = _build_unlock_plan(
        vdot_current=vdot_current,
        vdot_ceiling=vdot_ceiling,
        weekly_km=weekly_km_recent,
        freq=freq,
        easy_pct=easy_pct_now,
    )
    ai_data["strengths"] = diagnostics["strengths"]
    ai_data["gaps"] = diagnostics["weaknesses"]
    ai_data["coach_verdict"] = (
        f"Forza attuale {current_strength}/100 e margine {improvement_potential}/100. "
        f"Il profilo si aggiorna automaticamente dopo ogni sync Strava o import Garmin CSV."
    )
    ai_data["unlock_message"] = " ".join(diagnostics["priorities"][:2])

    pace_str = f"{int(avg_pace_sec_km // 60)}:{int(avg_pace_sec_km % 60):02d}/km" if avg_pace_sec_km > 0 else "N/D"
    dna_scores = {
        "aerobic_engine": aerobic_score,
        "biomechanics": biomech_score,
        "consistency": consistency_score,
        "load_capacity": load_score,
        "efficiency": eff_score,
    }

    dna = {
        "profile": {
            "level": ai_data.get("profile_level", ""),
            "type": ai_data.get("profile_type", ""),
            "archetype_description": ai_data.get("archetype_description", ""),
            "vdot_current": round(vdot_current, 1),
            "vdot_delta": vdot_delta,
        },
        "stats": {
            "avg_pace": pace_str,
            "avg_hr": int(avg_hr_all) if avg_hr_all else 0,
            "avg_cadence": int(avg_cad_all) if avg_cad_all else 0,
            "zone_distribution": zone_dist,
            "total_runs": total_runs,
            "total_km": round(total_km, 1),
            "weeks_active": round(weeks_active),
        },
        "performance": {
            "trend_status": ai_data.get("trend_status", ""),
            "trend_detail": "Aggiornato da firma dati Strava + Garmin CSV + fitness freshness.",
            "total_km": round(total_km, 1),
        },
        "consistency": {
            "score_pct": consistency_score,
            "label": ai_data.get("consistency_label", ""),
            "runs_per_week": round(freq, 1),
        },
        "efficiency": {
            "score_pct": int(eff_score),
            "label": ai_data.get("efficiency_label", ""),
            "cadence": int(avg_cad_all) if avg_cad_all else 0,
        },
        "current_state": {
            "form_label": ai_data.get("form_label", ""),
            "fitness_ctl": round(ctl, 1),
            "atl": round(atl, 1),
            "tsb": round(tsb, 1),
        },
        "potential": {
            "vdot_ceiling": vdot_ceiling,
            "potential_pct": potential_pct,
            "ideal_distance": ai_data.get("ideal_distance", ""),
            "predictions": _predict_race(vdot_ceiling),
            "current_predictions": _predict_race(vdot_current),
        },
        "ai_coach": {
            "coach_verdict": ai_data.get("coach_verdict", ""),
            "strengths": diagnostics["strengths"],
            "gaps": diagnostics["weaknesses"],
            "unlock_message": ai_data.get("unlock_message", ""),
        },
        "dna_scores": dna_scores,
        "scores": {
            "current_strength": current_strength,
            "improvement_potential": improvement_potential,
            "breakdown": [
                {"key": "aerobic_engine", "label": "Motore aerobico", "score": aerobic_score},
                {"key": "consistency", "label": "Costanza", "score": consistency_score},
                {"key": "load_capacity", "label": "Capacita di carico", "score": load_score},
                {"key": "efficiency", "label": "Efficienza", "score": eff_score},
                {"key": "biomechanics", "label": "Biomeccanica", "score": biomech_score},
            ],
        },
        "diagnostics": diagnostics,
        "running_dynamics": {
            "vertical_oscillation_cm": avg_vert_osc,
            "vertical_ratio_pct": avg_vert_ratio,
            "ground_contact_ms": avg_gct,
            "stride_length_m": avg_stride,
            "sample_runs": len(telemetry_runs),
            "cadence_runs": _count_available(cadence_values),
            "vertical_oscillation_runs": _count_available(vert_osc_values),
            "vertical_ratio_runs": _count_available(vert_ratio_values),
            "ground_contact_runs": _count_available(gct_values),
            "stride_runs": _count_available(stride_values),
        },
        "data_freshness": data_freshness,
    }

    await db.runner_dna_cache.update_one(
        {"athlete_id": athlete_id},
        {"$set": {
            "athlete_id": athlete_id,
            "schema_version": RUNNER_DNA_SCHEMA_VERSION,
            "data_signature": data_signature,
            "dna_data": dna,
            "updated_at": dt.datetime.now().isoformat(),
        }},
        upsert=True,
    )
    return {"dna": dna}


@app.get("/api/runner-dna-legacy")
async def get_runner_dna_legacy():
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
    resting_hr = int(profile.get("resting_hr", 50) or 50)
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
    vdot_hist        = _calc_vdot_with_history(runs, max_hr, weeks_window=8, resting_hr=resting_hr)
    vdot_from_runs   = vdot_hist.get("current")
    vdot_from_be     = _vdot_from_best_efforts(be_efforts)
    vdot_current     = max(vdot_from_runs or 28.0, vdot_from_be or 28.0)

    # Reliability band centred on the surfaced VDOT (confounder-aware, see
    # _run_vdot_confidence). Lets the UI show "52 ±1.5 · MEDIA" instead of a
    # falsely precise single number.
    vdot_band        = vdot_hist.get("band")
    vdot_confidence  = vdot_hist.get("confidence")
    vdot_conf_label  = vdot_hist.get("confidence_label")
    vdot_range_low   = round(vdot_current - vdot_band, 1) if vdot_band else None
    vdot_range_high  = round(vdot_current + vdot_band, 1) if vdot_band else None

    cutoff_old   = (date.today() - timedelta(weeks=24)).isoformat()
    older_runs   = [r for r in runs if r.get("date", "") < cutoff_old]
    older_vdot   = _calc_vdot(older_runs, max_hr, weeks_window=16, resting_hr=resting_hr) if len(older_runs) >= 3 else None
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
    lm_vdot     = _calc_vdot(lm_runs, max_hr, weeks_window=4, resting_hr=resting_hr) if len(lm_runs) >= 2 else None
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
            "vdot_confidence":       vdot_confidence,
            "vdot_confidence_label": vdot_conf_label,
            "vdot_band":             vdot_band,
            "vdot_range_low":        vdot_range_low,
            "vdot_range_high":       vdot_range_high,
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
    tokens = await _get_active_strava_token()
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


@app.post("/api/admin/reclassify-runs")
async def reclassify_runs(apply: bool = False, fetch_laps: bool = False, laps_limit: int = 60):
    """Riclassifica run_type di tutte le corse con il detector strutturale v2.

    Usa dati GIÀ in DB (streams + laps + nome) → nessuna chiamata Strava per la
    classificazione. Distingue ripetute da tempo continuo guardando la struttura.

    Query params:
      - apply=false (default): DRY-RUN, ritorna solo il diff senza scrivere.
      - apply=true: scrive run_type + classify_evidence nei doc modificati.
      - fetch_laps=true: scarica le laps Strava per run che ne sono prive
        (max laps_limit, rate-limit aware) prima di riclassificare.

    Salta i run con manual_override=True (run_type manuale ha priorità).
    """
    athlete_id = await _get_athlete_id()
    q: dict = {"athlete_id": athlete_id} if athlete_id else {}

    # Opzionale: backfill laps da Strava per run che non le hanno
    laps_fetched = 0
    if fetch_laps:
        tokens = await _get_active_strava_token()
        if tokens:
            tokens = await _refresh_token_if_needed(tokens)
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            need = await db.runs.find(
                {**q, "strava_id": {"$exists": True},
                 "$or": [{"laps": {"$exists": False}}, {"laps": {"$size": 0}}]}
            ).sort("date", -1).to_list(laps_limit)
            async with httpx.AsyncClient(timeout=30.0) as http:
                for run in need:
                    sid = run.get("strava_id")
                    if not sid:
                        continue
                    try:
                        r = await http.get(
                            f"https://www.strava.com/api/v3/activities/{sid}/laps",
                            headers=headers,
                        )
                        if r.status_code == 200:
                            laps = [{
                                "distance": lp.get("distance"),
                                "moving_time": lp.get("moving_time"),
                                "elapsed_time": lp.get("elapsed_time"),
                                "average_speed": lp.get("average_speed"),
                                "average_heartrate": lp.get("average_heartrate"),
                                "lap_index": lp.get("lap_index"),
                            } for lp in r.json()]
                            await db.runs.update_one({"_id": run["_id"]}, {"$set": {"laps": laps}})
                            laps_fetched += 1
                    except Exception:
                        pass

    # Scan + riclassifica (solo dati in DB)
    cursor = db.runs.find(q)
    scanned = 0
    skipped_override = 0
    changes = []
    async for run in cursor:
        scanned += 1
        if run.get("manual_override"):
            skipped_override += 1
            continue
        try:
            new_type, evidence = _classify_run_v2(run)
        except Exception as e:
            continue
        old_type = run.get("run_type")
        if new_type != old_type:
            changes.append({
                "date": (run.get("start_date_local") or run.get("date") or "")[:10],
                "name": run.get("name"),
                "distance_km": run.get("distance_km"),
                "avg_pace": run.get("avg_pace"),
                "old": old_type,
                "new": new_type,
                "evidence": evidence,
            })
            if apply:
                await db.runs.update_one(
                    {"_id": run["_id"]},
                    {"$set": {"run_type": new_type, "classify_evidence": evidence}},
                )

    # conteggi transizioni
    from collections import Counter as _Counter
    trans = _Counter((c["old"], c["new"]) for c in changes)
    return {
        "ok": True,
        "applied": apply,
        "scanned": scanned,
        "skipped_manual_override": skipped_override,
        "laps_fetched": laps_fetched,
        "changed": len(changes),
        "transitions": {f"{k[0]}->{k[1]}": v for k, v in trans.most_common()},
        "changes": sorted(changes, key=lambda c: c["date"]),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  SUB-20 PLAN — AUTO SESSION EVALUATION (kikkoderisoSub20)
# ═══════════════════════════════════════════════════════════════════════════════
# Confronta una qualità eseguita col prescritto dal piano, NORMALIZZANDO per
# condizioni reali: pendenza (GAP asimmetrico), temperatura+umidità (heat
# slowdown). Estrae le rep dai laps/streams, dà verdetto AVANTI/IN LINEA/INDIETRO,
# propone il % di successo, stima il VDOT implicito e la finestra in cui la seduta
# produrrà effetto sulla performance (supercompensazione).

def _pace_to_sec(p) -> Optional[int]:
    """'3:58' → 238. None su input invalido."""
    try:
        if isinstance(p, (int, float)):
            return int(p)
        parts = str(p).split(":")
        if len(parts) != 2:
            return None
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return None


def _extract_reps_from_streams(streams: list, duration_minutes: float,
                               min_rep_m: float = 250.0) -> list:
    """Dettaglio per-rep dai streams: [{dist_m, dur_s, pace_sec, hr_avg, hr_max}].

    Stessa segmentazione del detector (_workout_structure_from_streams): 2-means
    sui pace, blocchi 'lavoro' = cluster veloce. Qui restituisce i dettagli di
    OGNI rep (passo, durata, HR) per il confronto col prescritto.
    """
    st = streams or []
    dur_s = (duration_minutes or 0) * 60
    n = len(st)
    if n < 12 or dur_s <= 0:
        return []
    ds = [s.get("d") for s in st if isinstance(s, dict)]
    hrs = [s.get("hr") for s in st if isinstance(s, dict)]
    alts = [s.get("alt") for s in st if isinstance(s, dict)]
    if len(ds) < 12:
        return []
    for i in range(len(ds)):
        if ds[i] is None:
            ds[i] = ds[i - 1] if i > 0 else 0.0
    n = len(ds)
    dt = dur_s / (n - 1)
    pace = []
    for i in range(n - 1):
        dd = ds[i + 1] - ds[i]
        pace.append(999.0 if dd <= 0.3 else 1000.0 * dt / dd)
    pace.append(pace[-1] if pace else 999.0)
    w = max(2, int(round(15.0 / dt)))
    sp = _median_filter(pace, w)
    moving = [p for p in sp if p < 900]
    if len(moving) < 12:
        return []
    cf, cs = _two_means_split(moving)
    thr = (cf + cs) / 2.0
    work = [1 if (p < thr and p < 900) else 0 for p in sp]
    blocks = []
    i = 0
    while i < n:
        v = work[i]
        j = i
        while j < n and work[j] == v:
            j += 1
        blocks.append([v, i, j])
        i = j
    merged = []
    for b in blocks:
        seg_t = (b[2] - b[1]) * dt
        if merged and seg_t < 20:
            merged[-1][2] = b[2]
        else:
            merged.append(b[:])
    reps = []
    for b in merged:
        if b[0] != 1:
            continue
        i0, i1 = b[1], b[2]
        seg_t = (i1 - i0) * dt
        seg_d = ds[min(i1, n - 1)] - ds[i0]
        if seg_t < 20 or seg_d < min_rep_m:
            continue
        block_hr = [hrs[k] for k in range(i0, min(i1, len(hrs))) if hrs[k]]
        a_start = alts[i0] if i0 < len(alts) and alts[i0] is not None else None
        ae = min(i1, len(alts) - 1)
        a_end = alts[ae] if ae >= 0 and alts[ae] is not None else None
        elev_m = round(a_end - a_start, 1) if (a_start is not None and a_end is not None) else None
        grade_pct = (elev_m / seg_d * 100.0) if (elev_m is not None and seg_d > 0) else None
        reps.append({
            "dist_m": round(seg_d),
            "dur_s": round(seg_t),
            "pace_sec": round(1000.0 * seg_t / seg_d) if seg_d > 0 else None,
            "elev_m": elev_m,
            "grade_pct": round(grade_pct, 2) if grade_pct is not None else None,
            "hr_avg": round(sum(block_hr) / len(block_hr)) if block_hr else None,
            "hr_max": max(block_hr) if block_hr else None,
        })
    return reps


def _extract_reps_from_laps(laps: list) -> list:
    """Rep dai laps Strava (gold standard): cluster veloce = lavoro."""
    if not laps:
        return []
    items = []
    for lp in laps:
        spd = lp.get("average_speed") or 0
        dist = lp.get("distance") or 0
        mt = lp.get("moving_time") or lp.get("elapsed_time") or 0
        pace = (1000.0 / spd) if spd > 0 else None
        if pace is None or dist < 120 or mt < 15:
            continue
        items.append((pace, dist, mt, lp.get("average_heartrate")))
    if len(items) < 2:
        return []
    cf, cs = _two_means_split([it[0] for it in items])
    thr = (cf + cs) / 2.0
    reps = []
    for pace, dist, mt, hr in items:
        if pace <= thr:
            reps.append({
                "dist_m": round(dist), "dur_s": round(mt),
                "pace_sec": round(pace),
                "elev_m": None, "grade_pct": None,
                "hr_avg": round(hr) if hr else None, "hr_max": None,
            })
    return reps


async def _fetch_run_weather(lat, lng, date_str, hour_start=None, hour_end=None):
    """Open-Meteo per la corsa. Mirror logica frontend: forecast (past_days) per
    run ≤9 giorni fa, altrimenti archive.

    Se forniti hour_start + hour_end (durata corsa nota), restituisce la MEDIA
    sulle ore coperte dalla corsa — più rappresentativa di un singolo snapshot,
    soprattutto all'alba quando la temp varia 4°+ in un'ora.
    """
    if lat is None or lng is None or not date_str:
        return None
    from datetime import date as _date
    try:
        y, m, d = [int(x) for x in date_str[:10].split("-")]
        days_ago = (dt.datetime.utcnow().date() - _date(y, m, d)).days
    except Exception:
        days_ago = 999
    use_forecast = 0 <= days_ago <= 9
    base = {
        "latitude": str(lat), "longitude": str(lng),
        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature",
        "timezone": "auto",
    }
    if use_forecast:
        params = {**base, "past_days": "10", "forecast_days": "1"}
        url = "https://api.open-meteo.com/v1/forecast"
    else:
        params = {**base, "start_date": date_str[:10], "end_date": date_str[:10]}
        url = "https://archive-api.open-meteo.com/v1/archive"
    try:
        async with httpx.AsyncClient(timeout=20.0) as http:
            r = await http.get(url, params=params)
            if r.status_code != 200:
                return None
            j = r.json()
    except Exception:
        return None
    hourly = j.get("hourly") or {}
    times = hourly.get("time") or []
    temps = hourly.get("temperature_2m") or []
    hums = hourly.get("relative_humidity_2m") or []
    apps = hourly.get("apparent_temperature") or []
    if not times:
        return None

    # Raccoglie tutti gli indici delle ore coperte (start..end inclusi)
    hours_wanted = set()
    if hour_start is not None:
        if hour_end is None:
            hour_end = hour_start
        h = hour_start
        while True:
            hours_wanted.add(min(23, max(0, h)))
            if h >= hour_end:
                break
            h += 1
    else:
        hours_wanted.add(8)

    idxs = []
    for idx, t in enumerate(times):
        if t[:10] != date_str[:10]:
            continue
        th = int(t[11:13]) if len(t) >= 13 else 0
        if th in hours_wanted:
            idxs.append(idx)
    if not idxs:
        for idx, t in enumerate(times):
            if t[:10] == date_str[:10]:
                idxs.append(idx)
                break

    def _avg(arr):
        vals = [arr[i] for i in idxs if i < len(arr) and arr[i] is not None]
        return (sum(vals) / len(vals)) if vals else None

    return {
        "temp_c": _avg(temps),
        "humidity": _avg(hums),
        "apparent_c": _avg(apps),
        "source": "forecast" if use_forecast else "archive",
        "hours_used": sorted(hours_wanted),
    }


async def _run_weather_fields(run_doc: dict) -> dict:
    """Meteo Open-Meteo persistito sul run: temperature / humidity / weather.

    Media oraria sulle ore coperte dalla corsa (start..end da start_date_local
    + durata), stessa logica del sub-20 eval. Abilita: correzione caldo nel
    VDOT (_environmental_pace_adjustment), niente penalita confidenza "caldo
    estivo non correggibile", e vista Clima & Ritmo senza fetch client-side.
    Non-fatale: ritorna {} se mancano posizione/data o l'API e' giu'.
    """
    latlng = run_doc.get("start_latlng") or []
    lat = latlng[0] if len(latlng) >= 2 else None
    lng = latlng[1] if len(latlng) >= 2 else None
    date_str = run_doc.get("date")
    if lat is None or lng is None or not date_str:
        return {}
    sdl = run_doc.get("start_date_local") or ""
    hh = int(sdl[11:13]) if len(sdl) >= 13 and sdl[11:13].isdigit() else None
    mm = int(sdl[14:16]) if len(sdl) >= 16 and sdl[14:16].isdigit() else 0
    dur_min = float(run_doc.get("duration_minutes") or 0)
    hour_start = hour_end = None
    if hh is not None:
        # Due campioni orari piu' vicini al PUNTO MEDIO della corsa: i dati
        # Open-Meteo sono istantanei a HH:00, e una 07:25->07:47 sta tra il
        # campione 07:00 (piu' freddo) e 08:00 — lo snapshot dell'ora di start
        # legge 1-2°C in meno di quel che il runner ha sentito.
        mid_min = hh * 60 + mm + dur_min / 2
        hour_start = min(23, int(mid_min // 60))
        hour_end = min(23, max(hour_start, int(round(mid_min / 60))))
    w = await _fetch_run_weather(lat, lng, date_str, hour_start, hour_end)
    if not w or w.get("temp_c") is None:
        return {}
    return {
        "temperature": round(w["temp_c"], 1),
        "humidity": round(w["humidity"]) if w.get("humidity") is not None else None,
        "weather": {
            "temp_c": round(w["temp_c"], 1),
            "humidity": round(w["humidity"], 1) if w.get("humidity") is not None else None,
            "apparent": round(w["apparent_c"], 1) if w.get("apparent_c") is not None else None,
            "source": w.get("source"),
            "hours_used": w.get("hours_used"),
        },
    }


@app.post("/api/weather/backfill")
async def backfill_run_weather(limit: int = 60):
    """Arricchisce di meteo i run che ne sono privi (recenti prima).

    Idempotente: salta i run con temperature gia' valorizzata. Batch limitato
    per restare nei rate limit Open-Meteo e nei timeout request Render.
    Invalida le cache analytics/DNA cosi' VDOT e previsioni si ricalcolano
    con la correzione caldo attiva.
    """
    athlete_id = await _get_athlete_id()
    q: dict = {
        "$or": [{"temperature": {"$exists": False}}, {"temperature": None}],
        "start_latlng.1": {"$exists": True},
        "is_treadmill": {"$ne": True},
    }
    if athlete_id:
        q["athlete_id"] = athlete_id
    limit = max(1, min(200, int(limit)))
    runs = await db.runs.find(q).sort("date", -1).to_list(limit)
    enriched, failed = 0, 0
    for r in runs:
        try:
            fields = await _run_weather_fields(r)
        except Exception as e:
            print(f"[weather-backfill] {r.get('date')}: {e}")
            fields = {}
        if fields:
            await db.runs.update_one({"_id": r["_id"]}, {"$set": fields})
            enriched += 1
        else:
            failed += 1
    if athlete_id and enriched:
        await _invalidate_analytics_cache(athlete_id)
        await _invalidate_runner_dna_cache(athlete_id)
    return {"ok": True, "scanned": len(runs), "enriched": enriched, "no_data": failed}


def _sub20_suggest_pct(avg_raw, target, reps_done, reps_prescribed, rep_paces) -> Optional[int]:
    """Propone il % successo (— /50/70/90/100) da esecuzione RAW vs prescritto."""
    if not avg_raw or not target:
        return None
    tiers = [0, 50, 70, 90, 100]
    diff = avg_raw - target  # negativo = più veloce del target
    if diff <= 3:
        base = 100
    elif diff <= 8:
        base = 90
    elif diff <= 15:
        base = 70
    else:
        base = 50
    # penale fade: ultima rep >5% più lenta della prima
    if len(rep_paces) >= 2 and rep_paces[-1] > rep_paces[0] * 1.05:
        base = tiers[max(0, tiers.index(base) - 1)]
    # completamento parziale
    done_ratio = reps_done / max(1, reps_prescribed)
    if done_ratio < 0.6:
        base = min(base, 50)
    elif done_ratio < 1.0:
        base = min(base, 70)
    return base


def _sub20_adaptation_window(date_str: str, rep_m: float) -> dict:
    """Finestra di supercompensazione: quando la seduta produce effetto."""
    from datetime import date as _date, timedelta
    try:
        y, m, d = [int(x) for x in date_str[:10].split("-")]
        base = _date(y, m, d)
    except Exception:
        return {}
    if rep_m >= 1600:
        lo, hi, kind = 12, 16, "resistenza specifica / soglia"
    else:
        lo, hi, kind = 10, 12, "VO2max"
    return {
        "absorb": "24–48h",
        "peak_from": (base + timedelta(days=lo)).isoformat(),
        "peak_to": (base + timedelta(days=hi)).isoformat(),
        "kind": kind,
        "note": (f"Stimolo {kind}: assorbito in 24–48h. Beneficio su performance "
                 f"tra +{lo} e +{hi} giorni (supercompensazione)."),
    }


def _pbp_adj_sec(grade_pct: float) -> float:
    """PBP (passo in base alla pendenza) ALLINEATO a Strava, per matchare la
    colonna che l'utente vede nei parziali.

    Calibrato sui dati reali Strava: +0.5% → ~3.5s/km più veloce (≈7 s/km/%),
    −0.9% → ~5s/km più lento (≈5.6 s/km/%). Ritorna i sec/km da sottrarre al
    passo grezzo per ottenere il PBP. NB: distinto dal _grade_adjustment_sec
    globale (modello Minetti più aggressivo, usato per VDOT) — qui serve solo
    la coerenza VISIVA con Strava.
    """
    if grade_pct >= 0:
        return grade_pct * 7.0
    return grade_pct * 5.6  # negativo → PBP più lento


def _reps_from_laps(laps: list, streams: list) -> list:
    """Rep dai LAP ufficiali Strava (= i parziali che vede l'utente).

    Passo/durata dal lap; dislivello per-lap calcolato slice-ando lo stream di
    altitudine sul range di distanza cumulata del lap. Cluster veloce = lavoro.
    """
    if not laps:
        return []
    items = []
    cum = 0.0
    for lp in laps:
        dist = lp.get("distance") or 0
        mt = lp.get("moving_time") or lp.get("elapsed_time") or 0
        spd = lp.get("average_speed") or 0
        pace = (1000.0 / spd) if spd > 0 else ((mt / (dist / 1000.0)) if dist > 0 else None)
        start_d = cum
        cum += dist
        items.append({"pace": pace, "dist": dist, "mt": mt,
                      "hr": lp.get("average_heartrate"), "start_d": start_d, "end_d": cum})
    valid = [it for it in items if it["pace"] and it["dist"] >= 120 and it["mt"] >= 15]
    if len(valid) < 2:
        return []
    cf, cs = _two_means_split([it["pace"] for it in valid])
    thr = (cf + cs) / 2.0
    ds = [s.get("d") for s in streams] if streams else []
    alts = [s.get("alt") for s in streams] if streams else []

    def _alt_at(dist_m):
        if not ds:
            return None
        for k in range(len(ds)):
            if ds[k] is not None and ds[k] >= dist_m:
                return alts[k] if k < len(alts) else None
        return alts[-1] if alts else None

    reps = []
    for it in valid:
        if it["pace"] > thr:
            continue  # recupero
        a0 = _alt_at(it["start_d"])
        a1 = _alt_at(it["end_d"])
        elev = round(a1 - a0, 1) if (a0 is not None and a1 is not None) else None
        grade = (elev / it["dist"] * 100.0) if (elev is not None and it["dist"] > 0) else None
        reps.append({
            "dist_m": round(it["dist"]),
            "dur_s": round(it["mt"]),
            "pace_sec": round(it["pace"]),
            "elev_m": elev,
            "grade_pct": round(grade, 2) if grade is not None else None,
            "hr_avg": round(it["hr"]) if it["hr"] else None,
            "hr_max": None,
        })
    return reps


async def _ensure_run_laps(run: dict) -> list:
    """Ritorna i lap del run; se mancano in DB li scarica live da Strava e li salva."""
    laps = run.get("laps") or []
    if laps:
        return laps
    sid = run.get("strava_id")
    if not sid:
        return []
    try:
        tokens = await _get_active_strava_token()
        if not tokens:
            return []
        tokens = await _refresh_token_if_needed(tokens)
        async with httpx.AsyncClient(timeout=20.0) as http:
            r = await http.get(
                f"https://www.strava.com/api/v3/activities/{sid}/laps",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if r.status_code != 200:
                return []
            laps = [{
                "distance": lp.get("distance"),
                "moving_time": lp.get("moving_time"),
                "elapsed_time": lp.get("elapsed_time"),
                "average_speed": lp.get("average_speed"),
                "average_heartrate": lp.get("average_heartrate"),
                "lap_index": lp.get("lap_index"),
            } for lp in r.json()]
            if laps:
                await db.runs.update_one({"_id": run["_id"]}, {"$set": {"laps": laps}})
    except Exception:
        return run.get("laps") or []
    return laps


@app.post("/api/sub20/evaluate-session")
async def sub20_evaluate_session(payload: dict = Body(...)):
    """Valuta una qualità del piano Sub-20 contro il prescritto, normalizzando
    per pendenza + temperatura + umidità.

    Body: { date, reps, rep_m, target_pace_sec, window_days? }
    """
    from datetime import date as _date, timedelta
    try:
        center_str = str(payload.get("date") or "")[:10]
        y, m, d = [int(x) for x in center_str.split("-")]
        center = _date(y, m, d)
    except Exception:
        return {"matched": False, "error": "bad_date"}
    reps_prescribed = int(payload.get("reps") or 0)
    rep_m = float(payload.get("rep_m") or 1000)
    target_pace_sec = int(payload.get("target_pace_sec") or 0)
    window_days = int(payload.get("window_days") or 2)
    manual_temp = payload.get("manual_temp_c")  # override utente: cosa vede su Strava
    manual_humidity = payload.get("manual_humidity")

    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id} if athlete_id else {}
    lo = (center - timedelta(days=window_days)).isoformat()
    hi = (center + timedelta(days=window_days)).isoformat()

    # SOLO sessioni di QUALITÀ (intervals). Niente fallback a corse facili:
    # se non c'è una qualità in questa finestra → non valutare nulla.
    quality = []
    async for r in db.runs.find({**q, "date": {"$gte": lo, "$lte": hi}}):
        if r.get("is_treadmill"):
            continue
        if r.get("run_type") != "intervals":
            continue
        quality.append(r)
    if not quality:
        return {"matched": False, "reason": "no_quality"}

    def _score(r):
        rd = (r.get("date") or "")[:10]
        try:
            yy, mm, dd = [int(x) for x in rd.split("-")]
            return abs((_date(yy, mm, dd) - center).days)
        except Exception:
            return 99
    quality.sort(key=_score)
    run = quality[0]

    # Rep dai LAP ufficiali Strava (= i parziali che vede l'utente); scarica
    # live se mancano. Fallback: segmentazione streams.
    laps = await _ensure_run_laps(run)
    reps = _reps_from_laps(laps, run.get("streams") or []) or \
        _extract_reps_from_streams(run.get("streams") or [], run.get("duration_minutes"))
    if not reps:
        return {"matched": True, "run_id": str(run.get("_id")),
                "run_date": run.get("date"), "reps": [], "error": "no_reps"}

    rep_paces = [rp["pace_sec"] for rp in reps if rp.get("pace_sec")]
    avg_raw = sum(rep_paces) / len(rep_paces) if rep_paces else None
    net_elev = sum((sp.get("elevation_difference") or 0) for sp in (run.get("splits") or []))

    # ── meteo: preferisci temperatura DISPOSITIVO (Garmin/Strava average_temp),
    #    è quella che vede l'utente su Strava. Open-Meteo per umidità + fallback. ──
    latlng = run.get("start_latlng") or []
    lat = latlng[0] if len(latlng) >= 2 else None
    lng = latlng[1] if len(latlng) >= 2 else None
    # Intervallo orario coperto dalla corsa: start + durata → media oraria,
    # invece di uno snapshot. All'alba la temp può variare 4° in un'ora.
    sdl = run.get("start_date_local") or ""
    hh = int(sdl[11:13]) if len(sdl) >= 13 and sdl[11:13].isdigit() else None
    mm = int(sdl[14:16]) if len(sdl) >= 16 and sdl[14:16].isdigit() else 0
    dur_min = float(run.get("duration_minutes") or 0)
    hour_start = hour_end = None
    if hh is not None:
        start_min = hh * 60 + mm
        end_min = int(start_min + dur_min)
        hour_start = start_min // 60
        hour_end = min(23, end_min // 60)

    device_temp = run.get("device_temp_c")
    weather = await _fetch_run_weather(lat, lng, run.get("date"), hour_start, hour_end)
    om_temp = weather.get("temp_c") if weather else None
    humidity = weather.get("humidity") if weather else None
    # Cascata di priorità:
    # 1) override MANUALE per seduta (vince su tutto: l'utente vede Strava 18°)
    # 2) Open-Meteo 2m air temp (fisicamente corretto, calibrato sulla cella)
    # 3) Garmin average_temp SOLO se ≤22°C (sopra = sensore polso scaldato,
    #    inaffidabile — gonfia il credito caldo e quindi il VDOT)
    temp_source = None
    if manual_temp is not None:
        temp_c = float(manual_temp)
        temp_source = "manual"
    elif om_temp is not None:
        temp_c = om_temp
        temp_source = weather.get("source") if weather else "open-meteo"
    elif device_temp is not None and device_temp <= 22:
        temp_c = device_temp
        temp_source = "strava_device"
    else:
        temp_c = None
    if manual_humidity is not None:
        humidity = float(manual_humidity)
    apparent_c = _apparent_temp_c(temp_c, humidity) if temp_c is not None else None
    heat_frac = _heat_slowdown_frac(temp_c, humidity, 5.0) if temp_c is not None else 0.0
    heat_sec = (avg_raw or 0) * heat_frac

    # ── arricchisci ogni rep: PBP (passo in base alla pendenza) + passo a temp ideale ──
    for rp in reps:
        praw = rp.get("pace_sec")
        if praw is None:
            rp["pbp_sec"] = None
            rp["ideal_sec"] = None
            continue
        g = rp.get("grade_pct")
        rp["pbp_sec"] = round(praw - _pbp_adj_sec(g)) if g is not None else praw
        rp["ideal_sec"] = round(praw - heat_sec)

    # normalizzato = PBP (pendenza) − credito caldo, per-rep
    norm_paces = [rp["pbp_sec"] - heat_sec for rp in reps if rp.get("pbp_sec") is not None]
    norm_avg = sum(norm_paces) / len(norm_paces) if norm_paces else None
    grade_adj_avg = (sum((rp["pbp_sec"] - rp["pace_sec"]) for rp in reps
                         if rp.get("pbp_sec") is not None and rp.get("pace_sec") is not None)
                     / len(rep_paces)) if rep_paces else 0

    delta = (norm_avg - target_pace_sec) if (norm_avg and target_pace_sec) else None
    if delta is None:
        verdict = "ND"
    elif delta <= -5:
        verdict = "AVANTI"
    elif delta <= 5:
        verdict = "IN_LINEA"
    else:
        verdict = "INDIETRO"

    reps_done = len(rep_paces)
    pct = _sub20_suggest_pct(avg_raw, target_pace_sec, reps_done, reps_prescribed, rep_paces)
    vdot_impl = _vdot_from_race(3.0, norm_avg * 3.0) if norm_avg else None
    adaptation = _sub20_adaptation_window(run.get("date"), rep_m)

    return {
        "matched": True,
        "run_id": str(run.get("_id")),
        "run_date": run.get("date"),
        "run_name": run.get("name"),
        "run_type": run.get("run_type"),
        "reps": reps,
        "reps_done": reps_done,
        "reps_prescribed": reps_prescribed,
        "avg_raw_sec": round(avg_raw) if avg_raw else None,
        "target_pace_sec": target_pace_sec,
        "conditions": {
            "temp_c": round(temp_c, 1) if temp_c is not None else None,
            "humidity": round(humidity) if humidity is not None else None,
            "apparent_c": round(apparent_c, 1) if apparent_c is not None else None,
            "net_elev_m": round(net_elev, 1),
            "grade_adj_sec": round(grade_adj_avg),
            "heat_adj_sec": round(heat_sec),
            "temp_source": temp_source,
            "weather_source": weather.get("source") if weather else None,
            "hours_used": weather.get("hours_used") if weather else None,
        },
        "normalized_avg_sec": round(norm_avg) if norm_avg else None,
        "delta_sec": round(delta) if delta is not None else None,
        "verdict": verdict,
        "suggested_pct": pct,
        "vdot_implied": round(vdot_impl, 1) if vdot_impl else None,
        "adaptation": adaptation,
    }


# ── Stato sedute piano Sub-20 (effettuato / fallito) — persistente su DB ──────
@app.get("/api/sub20/status")
async def get_sub20_status():
    """Esiti + RPE + partenza del piano scelti dall'utente:
    statuses   = { 'YYYY-MM-DD': 'done' | 'failed' }
    rpe        = { 'YYYY-MM-DD': 'facile' | 'giusto' | 'duro' }
    start_date = 'YYYY-MM-DD' (martedì settimana 1) | None → default lato client
    L'RPE alimenta l'auto-adattamento del piano (motore lato client).
    """
    athlete_id = await _get_athlete_id()
    doc = await db.sub20_status.find_one({"athlete_id": athlete_id})
    return {
        "statuses": (doc or {}).get("statuses", {}),
        "rpe": (doc or {}).get("rpe", {}),
        "start_date": (doc or {}).get("start_date"),
    }


@app.put("/api/sub20/status")
async def set_sub20_status(payload: dict = Body(...)):
    """Aggiorna esito, RPE e/o data di partenza del piano.

    Chiavi indipendenti (si aggiorna solo ciò che è presente nel payload):
      status     ∈ {'done','failed'} — null/altro per togliere (richiede 'date')
      rpe        ∈ {'facile','giusto','duro'} — null/altro per togliere (richiede 'date')
      start_date = 'YYYY-MM-DD' — null/altro per tornare al default
    """
    athlete_id = await _get_athlete_id()
    q = {"athlete_id": athlete_id}

    # start_date è config del piano, indipendente dalle sedute.
    if "start_date" in payload:
        sd = payload.get("start_date")
        if isinstance(sd, str) and len(sd) == 10:
            await db.sub20_status.update_one(q, {"$set": {"start_date": sd}}, upsert=True)
        else:
            await db.sub20_status.update_one(q, {"$unset": {"start_date": ""}}, upsert=True)

    # status / rpe sono per-seduta e richiedono una data valida.
    if "status" in payload or "rpe" in payload:
        date = str(payload.get("date") or "")[:10]
        if not date or len(date) != 10:
            return JSONResponse({"error": "bad_date"}, status_code=400)
        if "status" in payload:
            status = payload.get("status")
            if status in ("done", "failed"):
                await db.sub20_status.update_one(q, {"$set": {f"statuses.{date}": status}}, upsert=True)
            else:
                await db.sub20_status.update_one(q, {"$unset": {f"statuses.{date}": ""}}, upsert=True)
        if "rpe" in payload:
            rpe = payload.get("rpe")
            if rpe in ("facile", "giusto", "duro"):
                await db.sub20_status.update_one(q, {"$set": {f"rpe.{date}": rpe}}, upsert=True)
            else:
                await db.sub20_status.update_one(q, {"$unset": {f"rpe.{date}": ""}}, upsert=True)

    doc = await db.sub20_status.find_one(q)
    return {
        "ok": True,
        "statuses": (doc or {}).get("statuses", {}),
        "rpe": (doc or {}).get("rpe", {}),
        "start_date": (doc or {}).get("start_date"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  CONQUISTA D'ITALIA — regioni conquistate (gamification)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/conquests")
async def get_conquests():
    """Elenco degli id-regione conquistati dall'utente."""
    athlete_id = await _get_athlete_id()
    doc = await db.conquests.find_one({"athlete_id": athlete_id})
    return {"conquered": (doc or {}).get("conquered", [])}


@app.put("/api/conquests")
async def set_conquests(payload: dict = Body(...)):
    """Conquista o rilascia una regione. action ∈ {'conquer','release'}."""
    athlete_id = await _get_athlete_id()
    region = str(payload.get("region") or "").strip()[:40]
    action = payload.get("action")
    if not region:
        return JSONResponse({"error": "bad_region"}, status_code=400)
    q = {"athlete_id": athlete_id}
    if action == "conquer":
        await db.conquests.update_one(q, {"$addToSet": {"conquered": region}}, upsert=True)
    elif action == "release":
        await db.conquests.update_one(q, {"$pull": {"conquered": region}}, upsert=True)
    else:
        return JSONResponse({"error": "bad_action"}, status_code=400)
    doc = await db.conquests.find_one(q)
    return {"ok": True, "conquered": (doc or {}).get("conquered", [])}


# ═══════════════════════════════════════════════════════════════════════════════
#  IMPOSTAZIONI UTENTE — obiettivo km settimanale (sincronizzato su DB)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/user/weekly-goal")
async def get_weekly_goal():
    """Obiettivo km settimanale scelto dall'utente (None → default lato client)."""
    athlete_id = await _get_athlete_id()
    doc = await db.user_settings.find_one({"athlete_id": athlete_id})
    return {"weekly_km_goal": (doc or {}).get("weekly_km_goal")}


@app.put("/api/user/weekly-goal")
async def set_weekly_goal(payload: dict = Body(...)):
    """Salva l'obiettivo km settimanale (1-300)."""
    athlete_id = await _get_athlete_id()
    try:
        g = float(payload.get("weekly_km_goal"))
    except (TypeError, ValueError):
        return JSONResponse({"error": "bad_goal"}, status_code=400)
    g = max(1.0, min(300.0, round(g)))
    await db.user_settings.update_one(
        {"athlete_id": athlete_id}, {"$set": {"weekly_km_goal": g}}, upsert=True
    )
    return {"ok": True, "weekly_km_goal": g}


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
@limiter.limit("30/minute")
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
        db.runs.find(q, {
            "date": 1, "name": 1, "run_type": 1, "notes": 1,
            "distance_km": 1, "duration_minutes": 1, "avg_hr": 1, "avg_pace": 1,
            "splits": 1, "temperature": 1, "apparent_temperature": 1,
            "humidity": 1, "wind_speed": 1, "weather": 1,
        })
            .sort("date", -1).to_list(100),
    )

    profile = profile_doc or {}
    ff = ff_latest or {}
    last_run = last_run_doc or {}

    # Compute VDOT
    max_hr = int(profile.get("max_hr", 190))
    resting_hr = int(profile.get("resting_hr", 50))
    vdot = _calc_vdot(recent_runs_docs, max_hr, resting_hr=resting_hr)

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
    """Parse Garmin CSV numbers with dot or comma decimals/thousands."""
    if val is None:
        return None
    text = str(val).strip()
    if not text or text == "--":
        return None
    text = (
        text.replace("\u00a0", "")
        .replace(" ", "")
        .replace("%", "")
        .replace("bpm", "")
        .replace("W", "")
    )
    text = re.sub(r"[^0-9,.\-]", "", text)
    if not text or text in {"-", ".", ","}:
        return None
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        if re.fullmatch(r"-?\d{1,3}(,\d{3})+", text):
            text = text.replace(",", "")
        else:
            text = text.replace(",", ".")
    try:
        return float(text)
    except (ValueError, TypeError):
        return None


def _parse_garmin_int(val: str) -> Optional[int]:
    """Parse an integer string, handling '--'."""
    number = _parse_garmin_number(val)
    if number is None:
        return None
    return int(round(number))


def _range_or_none(value: Optional[float], lo: float, hi: float, digits: int = 0):
    """Keep imported metrics only when they are physiologically plausible."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number < lo or number > hi:
        return None
    return round(number, digits) if digits > 0 else int(round(number))


def _normalise_strava_cadence_spm(value: Optional[float]) -> Optional[int]:
    """Strava running cadence is often steps from one foot, so values <120 become SPM."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    spm = number * 2 if number < 120 else number
    return _range_or_none(spm, 50, 240)


def _normalise_cadence_spm(value: Optional[float]) -> Optional[int]:
    """Legacy wrapper: normalise Strava-style cadence to steps per minute."""
    return _normalise_strava_cadence_spm(value)


def _normalise_garmin_cadence_spm(value: Optional[float]) -> Optional[int]:
    """Garmin CSV cadence is authoritative; only repair legacy half-cadence values."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    spm = number * 2 if 45 <= number < 120 else number
    return _range_or_none(spm, 50, 240)


def _cadence_spm_from_run(run: dict) -> Optional[int]:
    """Read canonical cadence SPM from a run, preserving legacy compatibility."""
    bio = run.get("biomechanics") or {}
    for value, source in (
        (bio.get("avg_cadence_spm"), "spm"),
        (run.get("avg_cadence_spm"), "spm"),
        (run.get("avg_cadence"), "legacy"),
    ):
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if number <= 0:
            continue
        if source == "legacy":
            return _normalise_strava_cadence_spm(number)
        return _range_or_none(number, 50, 240)
    return None


def _avg_number(values: list, digits: int = 1):
    clean = []
    for value in values:
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(number):
            clean.append(number)
    if not clean:
        return None
    result = sum(clean) / len(clean)
    return round(result, digits) if digits > 0 else int(round(result))


def _score_range(value: Optional[float], low: float, high: float) -> int:
    if value is None:
        return 45
    return int(max(0, min(100, round((float(value) - low) / (high - low) * 100))))


def _score_lower_better(value: Optional[float], excellent: float, poor: float) -> int:
    if value is None:
        return 50
    return int(max(0, min(100, round((poor - float(value)) / (poor - excellent) * 100))))


def _score_centered(value: Optional[float], ideal: float, tolerance: float) -> int:
    if value is None:
        return 50
    return int(max(0, min(100, round(100 - (abs(float(value) - ideal) / tolerance) * 100))))


def _garmin_csv_fingerprint(doc: dict) -> str:
    """Stable duplicate key for manually imported Garmin CSV rows."""
    raw = "|".join([
        str(doc.get("athlete_id") or ""),
        str(doc.get("date") or ""),
        f"{float(doc.get('distance_km') or 0):.2f}",
        f"{float(doc.get('duration_minutes') or 0):.2f}",
        str(doc.get("titolo") or "").strip().lower(),
    ])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _garmin_biomechanics_from_doc(doc: dict) -> dict:
    """Extract the authoritative biomechanics values from a Garmin CSV row."""
    bio = {
        "avg_ground_contact_time_ms": doc.get("avg_ground_contact_time_ms"),
        "avg_vertical_oscillation_cm": doc.get("avg_vertical_oscillation_cm"),
        "avg_vertical_ratio_pct": doc.get("avg_vertical_ratio_pct"),
        "avg_stride_length_m": doc.get("avg_stride_length_m"),
        "avg_cadence_spm": doc.get("avg_cadence_spm"),
        "source": "garmin_csv_import",
        "garmin_csv_id": str(doc.get("_id") or doc.get("id") or ""),
    }
    return {k: v for k, v in bio.items() if v is not None}


def _garmin_csv_active_query(athlete_id: int) -> dict:
    return {"athlete_id": athlete_id, "inactive_duplicate": {"$ne": True}}


def _normalised_garmin_csv_fields(doc: dict) -> dict:
    raw = doc.get("raw") or {}

    def _raw_number(key: str, current_key: str):
        parsed = _parse_garmin_number(raw.get(key, ""))
        return parsed if parsed is not None else doc.get(current_key)

    avg_cad_raw = _raw_number("Cadenza di corsa media", "avg_cadence_spm")
    max_cad_raw = _raw_number("Cadenza di corsa max", "max_cadence_spm")

    fields = {
        "avg_cadence_spm": _normalise_garmin_cadence_spm(avg_cad_raw),
        "max_cadence_spm": _normalise_garmin_cadence_spm(max_cad_raw),
        "avg_ground_contact_time_ms": _range_or_none(
            _raw_number("Tempo medio di contatto con il suolo", "avg_ground_contact_time_ms"),
            120, 450,
        ),
        "avg_vertical_oscillation_cm": _range_or_none(
            _raw_number("Oscillazione verticale media", "avg_vertical_oscillation_cm"),
            3, 20, 1,
        ),
        "avg_vertical_ratio_pct": _range_or_none(
            _raw_number("Rapporto verticale medio", "avg_vertical_ratio_pct"),
            3, 20, 1,
        ),
        "avg_stride_length_m": _range_or_none(
            _raw_number("Lunghezza media passo", "avg_stride_length_m"),
            0.4, 2.5, 2,
        ),
        "avg_hr": _range_or_none(
            _raw_number("FC Media", "avg_hr"),
            35, 240,
        ),
        "max_hr": _range_or_none(
            _raw_number("FC max", "max_hr"),
            35, 245,
        ),
        "avg_power_w": _range_or_none(
            _raw_number("Potenza media", "avg_power_w"),
            1, 800,
        ),
        "max_power_w": _range_or_none(
            _raw_number("Potenza max", "max_power_w"),
            1, 1200,
        ),
    }

    if fields["avg_hr"] and fields["max_hr"] and fields["max_hr"] < fields["avg_hr"]:
        fields["max_hr"] = fields["avg_hr"]

    fields["fingerprint"] = _garmin_csv_fingerprint({**doc, **fields})
    return fields


def _garmin_csv_quality_score(doc: dict) -> tuple:
    metric_keys = [
        "avg_cadence_spm", "avg_ground_contact_time_ms",
        "avg_vertical_oscillation_cm", "avg_vertical_ratio_pct",
        "avg_stride_length_m", "avg_hr", "avg_power_w",
    ]
    metric_count = sum(1 for key in metric_keys if doc.get(key) is not None)
    matched = 1 if doc.get("match_status") == "matched" and doc.get("matched_run_id") else 0
    return (matched, metric_count, str(doc.get("linked_at") or ""), str(doc.get("imported_at") or ""))


async def _repair_garmin_csv_docs(athlete_id: int) -> dict:
    latest = await db.garmin_csv_data.find_one(
        {"athlete_id": athlete_id},
        {"imported_at": 1, "linked_at": 1},
        sort=[("imported_at", -1), ("linked_at", -1)],
    )
    latest_key = "|".join([
        str((latest or {}).get("imported_at") or ""),
        str((latest or {}).get("linked_at") or ""),
    ])
    checkpoint_key = {
        "athlete_id": athlete_id,
        "key": "garmin_csv_repair",
        "schema_version": GARMIN_CSV_REPAIR_VERSION,
    }
    checkpoint = await db.maintenance_state.find_one(checkpoint_key)
    if checkpoint and checkpoint.get("latest_key") == latest_key:
        return {"checked": 0, "corrected": 0, "duplicates_inactivated": 0, "corrected_ids": [], "skipped": True}

    docs = await db.garmin_csv_data.find({"athlete_id": athlete_id}).to_list(5000)
    result = {"checked": len(docs), "corrected": 0, "duplicates_inactivated": 0, "corrected_ids": []}
    if not docs:
        await db.maintenance_state.update_one(
            checkpoint_key,
            {"$set": {**checkpoint_key, "latest_key": latest_key, "updated_at": dt.datetime.now().isoformat()}},
            upsert=True,
        )
        return result

    groups: dict[str, list] = {}
    for doc in docs:
        fields = _normalised_garmin_csv_fields(doc)
        group_key = fields["fingerprint"]
        value_fields = {k: v for k, v in fields.items() if k != "fingerprint"}
        changed = any(doc.get(key) != value for key, value in value_fields.items())
        doc.update(fields)
        groups.setdefault(group_key, []).append(doc)
        if changed:
            await db.garmin_csv_data.update_one({"_id": doc["_id"]}, {"$set": value_fields})
            result["corrected"] += 1
            result["corrected_ids"].append(doc["_id"])

    for group_key, group_docs in groups.items():
        winner = max(group_docs, key=_garmin_csv_quality_score)
        duplicates = [doc for doc in group_docs if doc["_id"] != winner["_id"]]
        for doc in duplicates:
            duplicate_of = str(winner["_id"])
            needs_duplicate_update = (
                doc.get("active") is not False
                or doc.get("inactive_duplicate") is not True
                or doc.get("duplicate_of") != duplicate_of
                or doc.get("match_status") != "duplicate"
                or doc.get("fingerprint") is not None
            )
            if needs_duplicate_update:
                await db.garmin_csv_data.update_one(
                    {"_id": doc["_id"]},
                    {
                        "$set": {
                            "active": False,
                            "inactive_duplicate": True,
                            "duplicate_of": duplicate_of,
                            "match_status": "duplicate",
                        },
                        "$unset": {"fingerprint": ""},
                    },
                )
            if needs_duplicate_update and not doc.get("inactive_duplicate"):
                result["duplicates_inactivated"] += 1
        for doc in group_docs:
            if doc["_id"] != winner["_id"]:
                continue
            needs_winner_update = (
                doc.get("active") is not True
                or doc.get("inactive_duplicate") is not False
                or doc.get("fingerprint") != group_key
                or doc.get("duplicate_of") is not None
            )
            if needs_winner_update:
                await db.garmin_csv_data.update_one(
                    {"_id": doc["_id"]},
                    {
                        "$set": {"active": True, "inactive_duplicate": False, "fingerprint": group_key},
                        "$unset": {"duplicate_of": ""},
                    },
                )

    await db.maintenance_state.update_one(
        checkpoint_key,
        {"$set": {**checkpoint_key, "latest_key": latest_key, "updated_at": dt.datetime.now().isoformat()}},
        upsert=True,
    )
    return result


def _match_confidence(csv_doc: dict, run_doc: dict) -> float:
    """Score Garmin CSV -> Strava run match by date, distance, duration and title."""
    score = 0.0
    csv_date = _analytics_date(csv_doc.get("date"))
    run_date = _analytics_date(run_doc.get("date"))
    if csv_date and run_date:
        day_delta = abs((csv_date - run_date).days)
        if day_delta == 0:
            score += 0.20
        elif day_delta == 1:
            score += 0.12

    csv_dist = float(csv_doc.get("distance_km") or 0)
    run_dist = float(run_doc.get("distance_km") or 0)
    if csv_dist > 0 and run_dist > 0:
        dist_delta = abs(csv_dist - run_dist)
        score += max(0.0, 0.45 * (1 - dist_delta / max(csv_dist * 0.10, 0.25)))

    csv_duration = float(csv_doc.get("duration_minutes") or 0)
    run_duration = float(run_doc.get("duration_minutes") or 0)
    csv_pace = csv_doc.get("avg_pace_sec") or _parse_pace_sec(csv_doc.get("avg_pace"))
    run_pace = _parse_pace_sec(run_doc.get("avg_pace"))
    if csv_duration <= 0 and csv_pace and csv_dist > 0:
        csv_duration = csv_dist * csv_pace / 60
    if csv_duration > 0 and run_duration > 0:
        dur_delta = abs(csv_duration - run_duration)
        score += max(0.0, 0.30 * (1 - dur_delta / max(csv_duration * 0.12, 3.0)))

    if csv_pace and run_pace:
        pace_delta = abs(float(csv_pace) - float(run_pace))
        score += max(0.0, 0.15 * (1 - pace_delta / max(float(csv_pace) * 0.08, 20.0)))

    title = str(csv_doc.get("titolo") or "").lower()
    name = str(run_doc.get("name") or "").lower()
    if title and name:
        title_tokens = {t for t in re.split(r"\W+", title) if len(t) > 3}
        name_tokens = {t for t in re.split(r"\W+", name) if len(t) > 3}
        if title_tokens and name_tokens:
            overlap = len(title_tokens & name_tokens) / max(1, len(title_tokens | name_tokens))
            score += min(0.05, overlap * 0.05)

    return round(min(score, 1.0), 3)


async def _find_matching_run_for_garmin_csv(athlete_id: int, csv_doc: dict) -> tuple[Optional[dict], float, str]:
    """Find a high-confidence Strava run for a Garmin CSV row."""
    date_str = csv_doc.get("date")
    csv_date = _analytics_date(date_str)
    if not csv_date:
        return None, 0.0, "no_date"
    date_window = [(csv_date + dt.timedelta(days=offset)).isoformat() for offset in (-1, 0, 1)]

    candidates = await db.runs.find({
        "athlete_id": athlete_id,
        "date": {"$in": date_window},
        "is_treadmill": {"$ne": True},
    }).to_list(50)
    if not candidates:
        return None, 0.0, "no_match"

    scored = sorted(
        [(run, _match_confidence(csv_doc, run)) for run in candidates],
        key=lambda item: item[1],
        reverse=True,
    )
    best_run, best_score = scored[0]
    second_score = scored[1][1] if len(scored) > 1 else 0.0
    if best_score < 0.70:
        return None, best_score, "low_confidence"
    if second_score and best_score - second_score < 0.05:
        return None, best_score, "ambiguous"
    return best_run, best_score, "matched"


async def _enrich_run_from_garmin_csv(run_doc: dict, csv_doc: dict, confidence: float) -> bool:
    """Patch a Strava run with Garmin CSV biomechanics while keeping raw CSV separate."""
    biomechanics = _garmin_biomechanics_from_doc(csv_doc)
    if not any(k.startswith("avg_") for k in biomechanics):
        return False

    set_fields = {
        "biomechanics": {
            **(run_doc.get("biomechanics") or {}),
            **biomechanics,
            "match_confidence": confidence,
        },
        "garmin_csv_id": str(csv_doc.get("_id")),
    }

    if biomechanics.get("avg_ground_contact_time_ms") is not None:
        set_fields["avg_ground_contact_time"] = biomechanics["avg_ground_contact_time_ms"]
    if biomechanics.get("avg_vertical_oscillation_cm") is not None:
        set_fields["avg_vertical_oscillation"] = biomechanics["avg_vertical_oscillation_cm"]
    if biomechanics.get("avg_vertical_ratio_pct") is not None:
        set_fields["avg_vertical_ratio"] = biomechanics["avg_vertical_ratio_pct"]
    if biomechanics.get("avg_stride_length_m") is not None:
        set_fields["avg_stride_length"] = biomechanics["avg_stride_length_m"]
    if biomechanics.get("avg_cadence_spm") is not None:
        set_fields["avg_cadence"] = biomechanics["avg_cadence_spm"]
        set_fields["avg_cadence_spm"] = biomechanics["avg_cadence_spm"]

    await db.runs.update_one({"_id": run_doc["_id"]}, {"$set": set_fields})
    await db.garmin_csv_data.update_one(
        {"_id": csv_doc["_id"]},
        {"$set": {
            "matched_run_id": str(run_doc["_id"]),
            "match_confidence": confidence,
            "match_status": "matched",
            "linked_at": dt.datetime.now().isoformat(),
        }},
    )
    return True


async def _link_garmin_csv_docs(athlete_id: int) -> dict:
    """Link imported Garmin CSV rows to Strava runs and enrich biomechanics."""
    repair = await _repair_garmin_csv_docs(athlete_id)
    total_active = await db.garmin_csv_data.count_documents(_garmin_csv_active_query(athlete_id))
    corrected_ids = repair.get("corrected_ids", [])
    process_query = {
        **_garmin_csv_active_query(athlete_id),
        "$or": [
            {"match_status": {"$exists": False}},
            {"match_status": {"$in": ["new"]}},
        ],
    }
    if corrected_ids:
        process_query["$or"].append({"_id": {"$in": corrected_ids}})
    docs = await db.garmin_csv_data.find(process_query).sort("date", -1).to_list(750)
    result = {
        "ok": True,
        "total_csv": total_active,
        "processable_csv": len(docs),
        "repaired": repair.get("corrected", 0),
        "duplicates_inactivated": repair.get("duplicates_inactivated", 0),
        "matched": 0,
        "enriched": 0,
        "already_linked": 0,
        "unmatched": 0,
        "ambiguous": 0,
        "low_confidence": 0,
        "no_csv": total_active == 0,
        "status_counts": {},
        "message": "",
        "errors": [],
    }

    for doc in docs:
        try:
            if doc.get("match_status") == "matched" and doc.get("matched_run_id"):
                run = None
                try:
                    from bson import ObjectId
                    run = await db.runs.find_one({"_id": ObjectId(doc["matched_run_id"]), "athlete_id": athlete_id})
                except Exception:
                    run = None
                if run:
                    result["already_linked"] += 1
                    result["status_counts"]["already_linked"] = result["status_counts"].get("already_linked", 0) + 1
                    if await _enrich_run_from_garmin_csv(run, doc, float(doc.get("match_confidence") or 1.0)):
                        result["enriched"] += 1
                    continue

            run, confidence, status = await _find_matching_run_for_garmin_csv(athlete_id, doc)
            result["status_counts"][status] = result["status_counts"].get(status, 0) + 1
            if not run:
                if status == "ambiguous":
                    result["ambiguous"] += 1
                elif status == "low_confidence":
                    result["low_confidence"] += 1
                    result["unmatched"] += 1
                else:
                    result["unmatched"] += 1
                await db.garmin_csv_data.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"match_status": status, "match_confidence": confidence}},
                )
                continue

            result["matched"] += 1
            if await _enrich_run_from_garmin_csv(run, doc, confidence):
                result["enriched"] += 1
        except Exception as e:
            result["errors"].append(str(e))

    await _invalidate_analytics_cache(athlete_id)
    await _invalidate_runner_dna_cache(athlete_id)
    if result["total_csv"] == 0:
        result["message"] = "Nessun CSV Garmin importato in Activities."
    elif result["processable_csv"] == 0:
        result["message"] = f"{result['total_csv']} CSV Garmin attivi gia allineati."
    elif result["enriched"] > 0:
        aligned = result["matched"] + result["already_linked"]
        result["message"] = f"{aligned} CSV abbinati, {result['enriched']} corse arricchite."
    elif result["already_linked"] > 0:
        result["message"] = f"{result['already_linked']} CSV Garmin gia collegati e riallineati."
    elif result["matched"] > 0:
        result["message"] = f"{result['matched']} CSV abbinati, ma nessun nuovo campo biomeccanico da arricchire."
    elif result["ambiguous"] > 0:
        result["message"] = "CSV trovati, ma il match e ambiguo: controlla data, distanza e durata."
    else:
        result["message"] = "CSV trovati, ma nessuna corsa Strava compatibile entro +/-1 giorno."
    return result


@app.post("/api/garmin/csv-import")
@limiter.limit("20/minute")
async def garmin_csv_import(request: Request):
    """Import Garmin CSV rows, dedupe raw data, then link telemetry to Strava runs."""
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)

    body = await request.json()
    runs_data = body.get("runs", [])
    
    if not runs_data:
        return JSONResponse({"error": "no_runs_provided"}, status_code=400)

    imported = 0
    skipped = 0
    duplicates = 0
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
            if (not duration_minutes or duration_minutes <= 0) and pace_sec and distanza_km:
                duration_minutes = distanza_km * pace_sec / 60

            # Build document for garmin_csv_data collection
            doc = {
                "athlete_id": athlete_id,
                "source": "garmin_csv_import",
                "imported_at": dt.datetime.now().isoformat(),
                "active": True,
                "inactive_duplicate": False,
                # Core fields
                "titolo": titolo if titolo else None,
                "date": date_part,
                "distance_km": distanza_km,
                "duration_minutes": duration_minutes,
                "avg_pace": avg_pace,
                "avg_pace_sec": pace_sec,
                # Heart rate
                "avg_hr": _range_or_none(fc_media, 35, 240),
                "max_hr": _range_or_none(fc_max, 35, 245),
                # Running dynamics (Garmin)
                "avg_vertical_oscillation_cm": _range_or_none(oscillazione_verticale, 3, 20, 1),
                "avg_vertical_ratio_pct": _range_or_none(rapporto_verticale, 3, 20, 1),
                "avg_ground_contact_time_ms": _range_or_none(tempo_contatto, 120, 450),
                "avg_stride_length_m": _range_or_none(lunghezza_passo, 0.4, 2.5, 2),
                # Cadence
                "avg_cadence_spm": _normalise_garmin_cadence_spm(cadenza_media),
                "max_cadence_spm": _normalise_garmin_cadence_spm(cadenza_max),
                # Elevation
                "elevation_gain_m": ascesa,
                "elevation_loss_m": discesa,
                "min_elevation_m": quota_min,
                "max_elevation_m": quota_max,
                # Power
                "avg_power_w": _range_or_none(potenza_media, 1, 800),
                "max_power_w": _range_or_none(potenza_max, 1, 1200),
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

            doc["fingerprint"] = _garmin_csv_fingerprint(doc)
            existing = await db.garmin_csv_data.find_one({
                "athlete_id": athlete_id,
                "fingerprint": doc["fingerprint"],
            })
            if existing:
                duplicates += 1
                skipped += 1
                continue

            await db.garmin_csv_data.insert_one(doc)
            imported += 1

        except Exception as e:
            errors.append(f"Errore riga {imported + skipped + 1}: {str(e)}")
            continue

    link_result = await _link_garmin_csv_docs(athlete_id)

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "duplicates": duplicates,
        "repaired": link_result.get("repaired", 0),
        "duplicates_inactivated": link_result.get("duplicates_inactivated", 0),
        "matched": link_result.get("matched", 0),
        "enriched": link_result.get("enriched", 0),
        "unmatched": link_result.get("unmatched", 0),
        "ambiguous": link_result.get("ambiguous", 0),
        "low_confidence": link_result.get("low_confidence", 0),
        "message": link_result.get("message", ""),
        "total_received": len(runs_data),
        "collection": "garmin_csv_data",
        "errors": (errors + link_result.get("errors", []))[:10],
    }


@app.post("/api/garmin/csv-link")
async def garmin_csv_link():
    """Relink already imported Garmin CSV telemetry to Strava runs."""
    athlete_id = await _get_athlete_id()
    if not athlete_id:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)
    return await _link_garmin_csv_docs(athlete_id)


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
        await _invalidate_analytics_cache(athlete_id)
        await _invalidate_runner_dna_cache(athlete_id)
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
        "inactive_duplicate": {"$ne": True},
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
