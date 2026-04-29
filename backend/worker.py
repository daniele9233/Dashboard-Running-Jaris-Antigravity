"""
Async background worker scaffold (round 6 — #16 sync queue plan).

STATUS: scaffold/stub. Non attivo in production. Quando sarà tempo:
  1. pip install arq  (aggiungere a requirements.txt)
  2. Servizio Redis su Render (addon o Upstash free)
  3. Aggiungere env var REDIS_URL
  4. Avviare worker process: arq backend.worker.WorkerSettings
  5. Sostituire le chiamate sync inline (`POST /api/strava/sync`) con enqueue.

PERCHÉ: lo Strava OAuth callback chiama syncStrava() inline. Su utenti con
1000+ corse il sync prende >30s = timeout HTTP su Render free tier. Una queue
async risolve perché:
  - HTTP returns 202 + task_id immediato.
  - Worker fa il sync in background con retry exponential backoff.
  - Frontend polling di GET /api/sync/status/:task_id mostra progress.
  - Eventi SSE già implementati (round 5) → notifica UI quando done.

DESIGN:
  Provider: arq (async Redis, integra con FastAPI).
  Alternative valutate:
    - Celery: matura ma sync (asyncio incompat).
    - RQ: simple ma niente async native.
    - Dramatiq: redis ma buon supporto async.
  arq vince: 100% async, footprint minimo, integrato con asyncio.

CODE BELOW: placeholder runtime — arq decorator commentati per non rompere
import se arq non è installato. Decommentare al deploy.
"""
from typing import Optional, Any


# Stub placeholder — sostituire con `from arq.connections import RedisSettings` quando attivo
class _StubRedisSettings:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


# from arq import cron
# from arq.connections import RedisSettings
# from backend.server import db, publish_event  # late, when wiring


# ── TASK DEFINITIONS ──────────────────────────────────────────────────────────

async def strava_sync_task(ctx: dict, athlete_id: Optional[int] = None) -> dict[str, Any]:
    """Sync Strava activities in background.

    ctx: arq context (db pool, redis, etc.)
    athlete_id: scoping per multi-tenant (#1 deferred).

    Replicare la logica di `strava_sync()` in server.py, ma in worker context.
    Pubblicare eventi SSE via `publish_event` per progress.
    """
    # TODO quando attivo:
    # from backend.server import publish_event
    # await publish_event({"type": "sync_started", "source": "strava"})
    # ... fetch + upsert ...
    # await publish_event({"type": "sync_complete", "source": "strava", "count": n})
    return {"status": "stub", "synced": 0}


async def garmin_sync_task(ctx: dict, athlete_id: Optional[int] = None, limit: int = 50) -> dict[str, Any]:
    """Sync Garmin activities in background. Stub."""
    return {"status": "stub", "synced": 0}


async def training_adapt_task(ctx: dict, athlete_id: Optional[int] = None) -> dict[str, Any]:
    """Adapt training plan after sync. Stub."""
    return {"status": "stub", "triggered": 0}


# ── WORKER SETTINGS ───────────────────────────────────────────────────────────

# Decommentare quando arq è installato:
#
# class WorkerSettings:
#     functions = [strava_sync_task, garmin_sync_task, training_adapt_task]
#     redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://localhost:6379"))
#     max_jobs = 5  # parallelismo limitato per non saturare Strava API
#     job_timeout = 300  # 5 min per task (default 5 minuti)
#     max_tries = 3  # retry exponential backoff
#
#     # Cron jobs scheduled (quando vorrai sync periodici)
#     cron_jobs = [
#         # cron(strava_sync_task, hour=6, minute=0),  # daily 6 AM
#     ]


# ── HELPER PER ENQUEUE DA ENDPOINT ────────────────────────────────────────────

async def enqueue_strava_sync(athlete_id: Optional[int] = None) -> str:
    """Enqueue una task Strava sync e ritorna il task_id.

    Da chiamare in `POST /api/strava/sync` invece di `await strava_sync()`:

        @app.post("/api/strava/sync")
        async def strava_sync_enqueue(athlete_id = Depends(get_athlete_id)):
            task_id = await enqueue_strava_sync(athlete_id)
            return {"task_id": task_id, "status": "queued"}

    Stub: ritorna ID fittizio finché arq non è wired.
    """
    return "stub-task-id"


# ── STATUS ENDPOINT (frontend polling) ────────────────────────────────────────
#
# In `routers/sync.py` (futuro):
#
#     @router.get("/api/sync/status/{task_id}")
#     async def sync_status(task_id: str):
#         job = Job(task_id, redis=...)
#         status = await job.status()  # queued|in_progress|complete|failed
#         result = await job.result(timeout=0) if status == "complete" else None
#         return {"task_id": task_id, "status": status, "result": result}
