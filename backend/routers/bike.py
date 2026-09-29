"""
Bike router — sedute in bici, lette solo dal widget DETRAINING.

Arrivano dal sync Strava (`_bike_session_from_strava` in server.py) e vivono
nella loro collezione: non entrano in corse, km settimanali, carico, VDOT né
statistiche. Servono a stimare quanto la bici tiene il motore aerobico nei
giorni senza corsa.

Endpoints:
- GET /api/bike-sessions → tutte le sedute, dalla più recente
"""
from typing import Optional

from fastapi import APIRouter, Depends

# Layout-resilient imports
try:
    from deps import get_db, get_athlete_id, oids
except ImportError:  # pragma: no cover
    from backend.deps import get_db, get_athlete_id, oids  # type: ignore

router = APIRouter(tags=["bike"])


@router.get("/api/bike-sessions")
async def get_bike_sessions(
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    q = {"athlete_id": athlete_id} if athlete_id else {}
    docs = await db.bike_sessions.find(q).sort("date", -1).to_list(length=None)
    return {"sessions": oids(docs)}
