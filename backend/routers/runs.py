"""
Runs router (list + detail + splits + weather persistence).

Estratto da server.py (round 8 — #15 god file split continuation).

Endpoints:
- GET /api/runs                      → lista corse (proietta out streams pesanti)
- GET /api/runs/{run_id}             → dettaglio singola corsa
- GET /api/runs/{run_id}/splits      → solo splits di una corsa
- GET /api/runs/{run_id}/intervals   → parziali (laps → streams → splits) + PBP
- POST /api/runs/backfill-laps       → riscarica i giri da Strava per corse vecchie
- POST /api/runs/weather/bulk        → snapshot meteo di N corse in una chiamata
- GET /api/runs/{run_id}/weather     → snapshot meteo salvato
- POST /api/runs/{run_id}/weather    → salva snapshot meteo
"""
from typing import Optional

from fastapi import APIRouter, Depends, Body
from fastapi.responses import JSONResponse

# Layout-resilient imports
try:
    from deps import get_db, get_athlete_id, oid, oids, normalise_run_quality_fields, _import_server
    from intervals import build_intervals
except ImportError:  # pragma: no cover
    from backend.deps import get_db, get_athlete_id, oid, oids, normalise_run_quality_fields, _import_server  # type: ignore
    from backend.intervals import build_intervals  # type: ignore

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


# ─── Parziali / ripetute ─────────────────────────────────────────────────────
async def _find_run(db, run_id: str):
    from bson import ObjectId
    try:
        return await db.runs.find_one({"_id": ObjectId(run_id)})
    except Exception:
        if run_id.isdigit():
            return await db.runs.find_one({"strava_id": int(run_id)})
        return None


@router.get("/api/runs/{run_id}/intervals")
async def get_run_intervals(run_id: str, db=Depends(get_db)):
    """Parziali di una corsa, dalla fonte migliore disponibile.

    Ritorna `source` così la UI può dire all'utente se sta guardando i giri
    veri dell'orologio o una segmentazione ricavata: sono cose diverse e
    spacciarle per uguali sarebbe fuorviante.
    """
    doc = await _find_run(db, run_id)
    if not doc:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return build_intervals(doc)


@router.post("/api/runs/backfill-laps")
async def backfill_laps(
    payload: dict = Body(default={}),
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    """Riscarica da Strava i giri delle corse che ne sono prive.

    Il sync salva i giri solo per le attività NUOVE (`if existing: continue`),
    quindi tutto lo storico importato prima che il codice esistesse non li ha:
    su questo database 98 sedute di ripetute su 98 e solo 3 con i giri.

    Rate limit Strava: 200 richieste/15 min e 2000/giorno. Il default di 40 per
    chiamata sta largo; si ripete finché `remaining` non arriva a zero.

    Body: { "limit": 40, "only_intervals": true }
    """
    server = _import_server()
    limit = max(1, min(int(payload.get("limit", 40) or 40), 100))
    only_intervals = bool(payload.get("only_intervals", True))

    query: dict = {
        "strava_id": {"$exists": True, "$ne": None},
        "$or": [{"laps": {"$exists": False}}, {"laps": {"$size": 0}}, {"laps": None}],
    }
    # Senza questo filtro il backfill lavorerebbe anche sulle corse degli altri
    # atleti collegati, bruciando il rate limit Strava per dati che non servono.
    if athlete_id:
        query["athlete_id"] = athlete_id
    if only_intervals:
        query["run_type"] = "intervals"

    remaining = await db.runs.count_documents(query)
    candidates = await db.runs.find(query).sort("date", -1).to_list(length=limit)
    if not candidates:
        return {"ok": True, "updated": 0, "failed": 0, "remaining": 0, "done": True}

    tokens = await server._get_active_strava_token()
    if not tokens:
        return JSONResponse({"error": "strava_not_connected"}, status_code=400)
    tokens = await server._refresh_token_if_needed(tokens)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    import httpx
    updated, failed, rate_limited = 0, 0, False
    async with httpx.AsyncClient(timeout=30.0) as http:
        for doc in candidates:
            strava_id = doc.get("strava_id")
            try:
                resp = await http.get(
                    f"https://www.strava.com/api/v3/activities/{strava_id}/laps",
                    headers=headers,
                )
                if resp.status_code == 429:
                    rate_limited = True
                    break
                if resp.status_code != 200:
                    failed += 1
                    continue
                laps_data = [{
                    "distance": lp.get("distance"),
                    "moving_time": lp.get("moving_time"),
                    "elapsed_time": lp.get("elapsed_time"),
                    "average_speed": lp.get("average_speed"),
                    "average_heartrate": lp.get("average_heartrate"),
                    "max_heartrate": lp.get("max_heartrate"),
                    "total_elevation_gain": lp.get("total_elevation_gain"),
                    "lap_index": lp.get("lap_index"),
                } for lp in resp.json()]

                update: dict = {"laps": laps_data}
                # Con i giri in mano la classificazione strutturale diventa
                # affidabile: si rilancia sul documento aggiornato.
                try:
                    merged = {**doc, "laps": laps_data}
                    rt, ev = server._classify_run_v2(merged)
                    update["run_type"] = rt
                    update["classify_evidence"] = ev
                except Exception:
                    pass
                # Il GAP a livello corsa mancava su 476 corse su 500.
                if doc.get("gap_pace_sec") is None:
                    gap = server._gap_pace_seconds(doc)
                    if gap:
                        update["gap_pace_sec"] = gap
                        update["gap_pace"] = server._format_secs(gap)

                await db.runs.update_one({"_id": doc["_id"]}, {"$set": update})
                updated += 1
            except Exception:
                failed += 1

    return {
        "ok": True,
        "updated": updated,
        "failed": failed,
        "remaining": max(0, remaining - updated),
        "rate_limited": rate_limited,
        "done": not rate_limited and remaining - updated <= 0,
    }


# ─── Weather persistence ─────────────────────────────────────────────────────
# NB: la rotta bulk va dichiarata PRIMA di quelle parametriche, altrimenti
# FastAPI potrebbe risolvere "weather" come {run_id}.
@router.post("/api/runs/weather/bulk")
async def get_runs_weather_bulk(payload: dict = Body(...), db=Depends(get_db)):
    """Snapshot meteo di più corse in una sola chiamata.

    Il widget dashboard e la vista Normalizzatore chiedono il meteo di decine di
    corse: una GET per corsa significherebbe decine di round-trip a ogni load.

    Body: { "run_ids": ["<id>", ...] }  →  { "weather": { "<id>": {...} } }
    """
    run_ids = payload.get("run_ids") or []
    if not isinstance(run_ids, list):
        return JSONResponse({"error": "run_ids must be a list"}, status_code=400)
    run_ids = [str(r) for r in run_ids if r][:500]
    if not run_ids:
        return {"weather": {}}

    docs = await db.run_weather.find({"run_id": {"$in": run_ids}}).to_list(length=len(run_ids))
    return {"weather": {doc["run_id"]: oid(doc) for doc in docs}}


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
