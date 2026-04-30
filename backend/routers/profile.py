"""
Profile + user layout router.

Estratto da server.py (round 8 — #15 god file split continuation).
Pattern: Depends per db + athlete_id (vedi backend/deps.py).

Endpoints:
- GET   /api/profile        → user profile
- PATCH /api/profile        → update profile (returns updated doc)
- GET   /api/user/layout    → dashboard layouts + hidden_keys
- PUT   /api/user/layout    → save layouts + hidden_keys
"""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

# Layout-resilient imports (Render rootDir=backend vs dev root)
try:
    from deps import get_db, get_athlete_id, oid
except ImportError:  # pragma: no cover
    from backend.deps import get_db, get_athlete_id, oid  # type: ignore

router = APIRouter(tags=["profile"])


# ── PROFILE ───────────────────────────────────────────────────────────────────

@router.get("/api/profile")
async def get_profile(
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    q = {"athlete_id": athlete_id} if athlete_id else {}
    doc = await db.profile.find_one(q)
    if not doc:
        return JSONResponse({"error": "no_profile"}, status_code=404)
    return oid(doc)


@router.patch("/api/profile")
async def update_profile(
    request: Request,
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    body = await request.json()
    body.pop("id", None)
    body.pop("_id", None)
    q = {"athlete_id": athlete_id} if athlete_id else {}
    await db.profile.update_one(q, {"$set": body}, upsert=True)
    doc = await db.profile.find_one(q)
    return oid(doc)


# ── USER LAYOUT (dashboard grid persistence) ──────────────────────────────────

@router.get("/api/user/layout")
async def get_user_layout(
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    q = {"athlete_id": athlete_id} if athlete_id else {"athlete_id": None}
    doc = await db.user_layout.find_one(q)
    if not doc:
        return {"layouts": None, "hidden_keys": []}
    hidden = doc.get("hidden_keys") or []
    if not isinstance(hidden, list):
        hidden = []
    return {
        "layouts": doc.get("layouts"),
        "hidden_keys": [h for h in hidden if isinstance(h, str)],
    }


@router.put("/api/user/layout")
async def put_user_layout(
    request: Request,
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    body = await request.json()
    layouts = body.get("layouts")
    hidden_keys_in = body.get("hidden_keys")
    update: dict = {"layouts": layouts, "updated_at": dt.datetime.utcnow()}
    if isinstance(hidden_keys_in, list):
        update["hidden_keys"] = [k for k in hidden_keys_in if isinstance(k, str)]
    q = {"athlete_id": athlete_id} if athlete_id else {"athlete_id": None}
    await db.user_layout.update_one(q, {"$set": update}, upsert=True)
    return {"ok": True}
