"""
Supplements tracking router.

Persistenza configurazione integrazione (start date per supplemento) su MongoDB.
Sostituisce localStorage per multi-device sync.

Endpoints:
- GET  /api/supplements                → config supplementi (start_date, enabled per supplement)
- PUT  /api/supplements/:sup_id        → update start_date (o enabled flag) di un singolo supplemento

Schema documento MongoDB (collection: `supplements_config`):
{
  "athlete_id": int | None,
  "supplements": {
    "creatine":     { "start_date": "YYYY-MM-DD", "enabled": bool, "updated_at": datetime },
    "beta-alanine": { "start_date": "YYYY-MM-DD", "enabled": bool, "updated_at": datetime },
  },
  "updated_at": datetime,
}
"""
import datetime as dt
import re
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

try:
    from deps import get_db, get_athlete_id, oid
except ImportError:  # pragma: no cover
    from backend.deps import get_db, get_athlete_id, oid  # type: ignore

router = APIRouter(tags=["supplements"])

# Supplementi supportati. Espandibile in futuro.
SUPPORTED_SUPPLEMENTS = {"creatine", "beta-alanine"}

# Default start dates (usati al primo accesso se l'utente non ha mai salvato nulla)
DEFAULT_CONFIG = {
    "creatine":     {"start_date": "2026-05-12", "enabled": True},
    "beta-alanine": {"start_date": "2026-05-15", "enabled": True},
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _valid_date(s: str) -> bool:
    if not isinstance(s, str) or not _DATE_RE.match(s):
        return False
    try:
        dt.datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _athlete_query(athlete_id: Optional[int]) -> dict:
    return {"athlete_id": athlete_id} if athlete_id else {"athlete_id": None}


def _build_merged(sup: dict) -> dict:
    """Merge sup dict con default, include checked_days."""
    merged: dict = {}
    for key in SUPPORTED_SUPPLEMENTS:
        entry = sup.get(key) or {}
        raw_days = entry.get("checked_days") or []
        # Deduplica e ordina
        checked_days = sorted(list(set(d for d in raw_days if isinstance(d, str))))
        merged[key] = {
            "start_date":   entry.get("start_date") or DEFAULT_CONFIG[key]["start_date"],
            "enabled":      entry.get("enabled") if isinstance(entry.get("enabled"), bool) else DEFAULT_CONFIG[key]["enabled"],
            "checked_days": checked_days,
        }
    return merged


@router.get("/api/supplements")
async def get_supplements(
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    """Ritorna config supplementi. Se nessuna config salvata, ritorna default."""
    q = _athlete_query(athlete_id)
    doc = await db.supplements_config.find_one(q)
    if not doc:
        default_with_checks = {k: {**v, "checked_days": []} for k, v in DEFAULT_CONFIG.items()}
        return {"supplements": default_with_checks}

    sup = doc.get("supplements") or {}
    return {"supplements": _build_merged(sup)}


@router.put("/api/supplements/{sup_id}")
async def update_supplement(
    sup_id: str,
    request: Request,
    db=Depends(get_db),
    athlete_id: Optional[int] = Depends(get_athlete_id),
):
    """
    Aggiorna start_date, enabled e/o singolo check giornaliero di un supplemento.
    Body: {
      "start_date": "YYYY-MM-DD"?,
      "enabled": bool?,
      "check_date": "YYYY-MM-DD"?,   # giorno da spuntare/deselezionare
      "checked": bool?,               # true=aggiungi, false=rimuovi
    }
    """
    if sup_id not in SUPPORTED_SUPPLEMENTS:
        return JSONResponse({"error": f"unknown_supplement: {sup_id}"}, status_code=400)

    body = await request.json()
    set_payload: dict = {}

    if "start_date" in body:
        sd = body["start_date"]
        if not _valid_date(sd):
            return JSONResponse({"error": "invalid_start_date_format (expected YYYY-MM-DD)"}, status_code=400)
        set_payload[f"supplements.{sup_id}.start_date"] = sd
        set_payload[f"supplements.{sup_id}.updated_at"] = dt.datetime.utcnow()

    if "enabled" in body:
        enabled = body["enabled"]
        if not isinstance(enabled, bool):
            return JSONResponse({"error": "invalid_enabled_value (expected bool)"}, status_code=400)
        set_payload[f"supplements.{sup_id}.enabled"] = enabled
        set_payload[f"supplements.{sup_id}.updated_at"] = dt.datetime.utcnow()

    # Day-check toggle
    check_date = body.get("check_date")
    checked    = body.get("checked")
    has_toggle = check_date is not None and checked is not None

    if has_toggle:
        if not _valid_date(str(check_date)):
            return JSONResponse({"error": "invalid_check_date (expected YYYY-MM-DD)"}, status_code=400)
        if not isinstance(checked, bool):
            return JSONResponse({"error": "invalid_checked_value (expected bool)"}, status_code=400)

    if not set_payload and not has_toggle:
        return JSONResponse({"error": "no_valid_fields_to_update"}, status_code=400)

    q = _athlete_query(athlete_id)

    # Apply $set for field updates
    if set_payload:
        set_payload["updated_at"] = dt.datetime.utcnow()
        await db.supplements_config.update_one(
            q,
            {"$set": set_payload, "$setOnInsert": {"athlete_id": athlete_id}},
            upsert=True,
        )

    # Apply check toggle via $addToSet / $pull
    if has_toggle:
        # Ensure doc exists
        await db.supplements_config.update_one(
            q, {"$setOnInsert": {"athlete_id": athlete_id}}, upsert=True
        )
        if checked:
            await db.supplements_config.update_one(
                q, {"$addToSet": {f"supplements.{sup_id}.checked_days": check_date}}
            )
        else:
            await db.supplements_config.update_one(
                q, {"$pull": {f"supplements.{sup_id}.checked_days": check_date}}
            )

    # Ritorna config aggiornata completa
    doc = await db.supplements_config.find_one(q)
    sup = (doc or {}).get("supplements") or {}
    return {"supplements": _build_merged(sup)}
