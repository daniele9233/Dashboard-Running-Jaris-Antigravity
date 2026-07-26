"""
Runs router (list + detail + splits + weather persistence).

Estratto da server.py (round 8 — #15 god file split continuation).

Endpoints:
- GET /api/runs                      → lista corse (proietta out streams pesanti)
- GET /api/runs/{run_id}             → dettaglio singola corsa
- GET /api/runs/{run_id}/splits      → solo splits di una corsa
- GET /api/runs/{run_id}/weather     → snapshot meteo salvato
- POST /api/runs/{run_id}/weather    → salva snapshot meteo
"""
from typing import Optional

from fastapi import APIRouter, Depends, Body
from fastapi.responses import JSONResponse

# Layout-resilient imports
try:
    from deps import get_db, get_athlete_id, oid, oids, normalise_run_quality_fields
except ImportError:  # pragma: no cover
    from backend.deps import get_db, get_athlete_id, oid, oids, normalise_run_quality_fields  # type: ignore

router = APIRouter(tags=["runs"])


@router.get("/api/runs")
async def get_runs(
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    q = {"athlete_id": athlete_id} if athlete_id else {}
    # Exclude heavy fields (streams) from list endpoint to save memory
    projection = {"streams": 0}
    cursor = db.runs.find(q, projection).sort("date", -1)
    # length=None → tutte le corse (niente cap a 500: il totale corse/km su Profile
    # e i calcoli di gamification/statistiche devono riflettere l'intera cronologia)
    runs = await cursor.to_list(length=None)
    runs = [normalise_run_quality_fields(dict(run)) for run in runs]
    return {"runs": oids(runs)}


@router.get("/api/runs/{run_id}")
async def get_run(run_id: str, db=Depends(get_db)):
    from bson import ObjectId
    try:
        doc = await db.runs.find_one({"_id": ObjectId(run_id)})
    except Exception:
        doc = await db.runs.find_one({"strava_id": int(run_id)}) if run_id.isdigit() else None
    if not doc:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return oid(normalise_run_quality_fields(doc))


@router.get("/api/runs/{run_id}/splits")
async def get_run_splits(run_id: str, db=Depends(get_db)):
    from bson import ObjectId
    try:
        doc = await db.runs.find_one({"_id": ObjectId(run_id)}, {"splits": 1})
    except Exception:
        doc = await db.runs.find_one({"strava_id": int(run_id)}, {"splits": 1}) if run_id.isdigit() else None
    if not doc:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return {"splits": doc.get("splits", [])}


# ─── Weather persistence ─────────────────────────────────────────────────────
@router.get("/api/runs/{run_id}/weather")
async def get_run_weather(run_id: str, db=Depends(get_db)):
    from bson import ObjectId

    doc = await db.run_weather.find_one({"run_id": run_id})
    if not doc:
        return JSONResponse({"weather": None}, status_code=200)
    return {"weather": oid(doc)}


@router.post("/api/runs/{run_id}/weather")
async def post_run_weather(
    run_id: str,
    payload: dict = Body(...),
    db=Depends(get_db),
):
    existing = await db.run_weather.find_one({"run_id": run_id})
    if existing:
        await db.run_weather.update_one(
            {"run_id": run_id},
            {"$set": {
                "temperature": payload.get("temperature"),
                "humidity": payload.get("humidity"),
                "apparent_temperature": payload.get("apparent_temperature"),
                "dewpoint": payload.get("dewpoint"),
                "wind_speed": payload.get("wind_speed"),
                "source": payload.get("source", "manual"),
                "estimated_hour": payload.get("estimated_hour"),
                "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
            }},
        )
        return {"ok": True, "updated": True}
    await db.run_weather.insert_one({
        "run_id": run_id,
        "temperature": payload.get("temperature"),
        "humidity": payload.get("humidity"),
        "apparent_temperature": payload.get("apparent_temperature"),
        "dewpoint": payload.get("dewpoint"),
        "wind_speed": payload.get("wind_speed"),
        "source": payload.get("source", "manual"),
        "estimated_hour": payload.get("estimated_hour"),
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
        "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
    })
    return {"ok": True, "inserted": True}
