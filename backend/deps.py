"""
Dependency injection helpers per FastAPI router estratti da server.py.

Uso (dentro un router):
    from fastapi import Depends
    from backend.deps import get_db, get_athlete_id

    @router.get("/api/profile")
    async def get_profile(
        db = Depends(get_db),
        athlete_id: int | None = Depends(get_athlete_id),
    ):
        q = {"athlete_id": athlete_id} if athlete_id else {}
        return await db.profile.find_one(q)

PATTERN MIGRATION (round 5+ — #15 server.py split):
    1. Creare router in `backend/routers/<dominio>.py`.
    2. Iniettare deps tramite `Depends(get_db)` invece di import diretto da server.
    3. server.py registra `app.include_router(<dominio>.router)`.
    4. Quando tutti i router sono estratti, `server.py` resta ~200 righe
       (app + lifespan + middleware + include_router).

NOTE: in mancanza di vera DI (state in app.state), oggi `get_db()` re-importa
da `server` lazy. È accettabile finché lo split è in progress. Quando server.py
sarà fully split, sostituire con `request.app.state.db`.
"""
from typing import Optional


def _import_server():
    """Layout-resilient import: prova `server` (CWD=backend/, Render prod) poi `backend.server` (dev)."""
    try:
        import server as _s  # noqa: PLC0415
        return _s
    except ImportError:  # pragma: no cover
        from backend import server as _s  # type: ignore  # noqa: PLC0415
        return _s


async def get_db():
    """Restituisce l'istanza Mongo db. Late import per evitare circular."""
    return _import_server().db


async def get_athlete_id() -> Optional[int]:
    """Restituisce athlete_id dell'utente attivo (single-tenant: ultimo Strava token).

    Quando arriva l'auth (#1 deferred), questa funzione leggerà da JWT/cookie
    invece che dal "ultimo token salvato".
    """
    return await _import_server()._get_athlete_id()


async def get_publish_event():
    """Pubblica evento SSE (per notifiche sync_complete / training_adapted).

    Restituisce la funzione `publish_event(payload: dict)`. Late import per
    evitare circolarità.
    """
    return _import_server().publish_event


# ── Helpers diretti (non Depends — usati lato router come funzioni) ───────────

def oid(doc):
    """Mongo _id → string id field."""
    return _import_server().oid(doc)


def oids(docs):
    return _import_server().oids(docs)


def normalise_run_quality_fields(run_doc: dict) -> dict:
    return _import_server()._normalise_run_quality_fields(run_doc)
