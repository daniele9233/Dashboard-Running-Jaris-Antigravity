"""
Health & version router.

Esempio canonico di estrazione router da `server.py` (round 5 — #15 god file split).
Endpoints senza dipendenze su DB / state → zero rischio circular import.

PATTERN (per i futuri router):
    1. Crea `backend/routers/<dominio>.py` con `router = APIRouter()`.
    2. Sposta gli endpoint con `@router.<method>(...)` invece di `@app.<method>(...)`.
    3. In `server.py` aggiungi `from backend.routers import <dominio>` e
       `app.include_router(<dominio>.router)`.
    4. Per dipendenze condivise (db, helpers) usa late import o estrai in
       `backend/deps.py` (vedi REPORT-TECNICO sezione round 5).
"""
import os
import datetime as dt

from fastapi import APIRouter

router = APIRouter(tags=["health"])

# Costanti versione esposte: tenute sincronizzate manualmente con server.py.
# Quando server.py sarà completamente splittato, spostare qui le costanti.
APP_VERSION = (
    os.environ.get("RENDER_GIT_COMMIT")
    or os.environ.get("GIT_COMMIT")
    or os.environ.get("COMMIT_SHA")
    or "local"
)
ANALYTICS_SCHEMA_VERSION = "pro-v9-2026-04-19"


@router.get("/")
async def health():
    return {"status": "ok", "app": "Altrove"}


@router.get("/api/version")
async def api_version():
    return {
        "status": "ok",
        "app": "Altrove",
        "version": APP_VERSION,
        "analytics_schema_version": ANALYTICS_SCHEMA_VERSION,
        "service": os.environ.get("RENDER_SERVICE_NAME") or "local",
        "timestamp": dt.datetime.utcnow().isoformat() + "Z",
    }
