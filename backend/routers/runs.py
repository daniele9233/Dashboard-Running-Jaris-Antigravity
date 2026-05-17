"""
Runs router (list + detail + splits + effort).

Estratto da server.py (round 8 — #15 god file split continuation).

Endpoints:
- GET   /api/runs                      → lista corse (proietta out streams pesanti)
- GET   /api/runs/{run_id}             → dettaglio singola corsa
- GET   /api/runs/{run_id}/splits      → solo splits di una corsa
- PATCH /api/runs/{run_id}/effort      → set perceived effort (RPE 1-10)
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
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
    runs = await cursor.to_list(length=500)
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


@router.patch("/api/runs/{run_id}/effort")
async def set_run_effort(
    run_id: str,
    payload: dict = Body(...),
    db=Depends(get_db),
):
    """Set perceived effort (RPE 1-10) sulla corsa.

    Body: {"perceived_effort": 1-10 | null}
    null = rimuove valore. Usato per calibrare VDOT/zone Daniels:
      - effort 6-8 = vero T sustainable
      - effort 9-10 = race max (peak VDOT)
      - <6 = easy/recovery (non per VDOT/T calc)
    """
    from bson import ObjectId
    eff = payload.get("perceived_effort")
    # Validate: None o int 1-10
    if eff is not None:
        try:
            eff = int(eff)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="perceived_effort must be int 1-10 or null")
        if eff < 1 or eff > 10:
            raise HTTPException(status_code=400, detail="perceived_effort must be in [1,10]")

    # Find run by ObjectId or strava_id
    query = None
    try:
        query = {"_id": ObjectId(run_id)}
    except Exception:
        if run_id.isdigit():
            query = {"strava_id": int(run_id)}
    if not query:
        raise HTTPException(status_code=400, detail="invalid run_id")

    result = await db.runs.update_one(query, {"$set": {"perceived_effort": eff}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="run not found")
    return {"ok": True, "perceived_effort": eff}
