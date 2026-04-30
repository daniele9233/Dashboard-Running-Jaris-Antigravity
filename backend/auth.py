"""
Auth scaffold (round 8 — #1 multi-tenant prep).

STATUS: scaffold, NON attivo. Single-tenant funziona invariato.
ATTIVAZIONE: vedi `OPS-SETUP.md` o `MISSING-PIECES.md` sezione #1.

DESIGN scelto: JWT custom (no managed provider lock-in).
Alternative valutate:
  - Clerk: managed, fast (15 min), MA $25/mo dopo 10k MAU + lock-in.
  - Supabase Auth: gratis 50k MAU + Postgres incluso, MA cambio DB (Mongo→PG).
  - Auth0: enterprise, costoso.
  - JWT custom + bcrypt: 2-3 giorni dev, controllo totale, free.

Vincono i requisiti del progetto:
  - DB resta Mongo (no migration).
  - Frontend già su Render (no nuovi servizi).
  - Single-tenant oggi → multi-tenant domani senza vendor lock-in.

PATTERN MIGRATION (quando attivare):
  1. pip install python-jose[cryptography] passlib[bcrypt]
  2. Aggiungere a requirements.txt
  3. Configurare env var JWT_SECRET (256-bit random)
  4. Aggiungere collection `users` in Mongo
  5. Creare router/auth.py: POST /api/auth/register, /api/auth/login
  6. Sostituire `get_athlete_id` (deps.py) con `get_current_user_id`
  7. Aggiungere `user_id` a TUTTE le collection esistenti via migration script
  8. Frontend: AuthProvider + LoginPage (vedi src/context/AuthContext.tsx scaffold)

Oggi `get_current_user_id` ritorna sempre `"default"` → backward-compat con
single-tenant esistente. Quando flippi env `AUTH_ENABLED=true` → estrae da JWT.
"""
import os
from typing import Optional

from fastapi import Header, HTTPException, status

# ── Feature flag ──────────────────────────────────────────────────────────────
# Quando true, gli endpoint richiedono Authorization: Bearer <jwt>.
# Default: false → comportamento single-tenant invariato.
AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "false").lower() == "true"

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"


# ── User identification ───────────────────────────────────────────────────────

DEFAULT_USER_ID = "default"  # single-tenant fallback


async def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Estrae user_id dal JWT Authorization header. Se AUTH_ENABLED=false →
    ritorna `DEFAULT_USER_ID`. Se true e header mancante/invalido → 401.

    Usage in router (dopo activation):

        @router.get("/api/profile")
        async def get_profile(
            user_id: str = Depends(get_current_user_id),
            db = Depends(get_db),
        ):
            doc = await db.profile.find_one({"user_id": user_id})
            return oid(doc)
    """
    if not AUTH_ENABLED:
        return DEFAULT_USER_ID

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = authorization.removeprefix("Bearer ").strip()

    # JWT decode (commentato finché python-jose non è installato)
    # try:
    #     from jose import jwt, JWTError
    #     payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    #     user_id = payload.get("sub")
    #     if not user_id:
    #         raise HTTPException(401, "Token missing 'sub' claim")
    #     return user_id
    # except JWTError as e:
    #     raise HTTPException(401, f"Invalid token: {e}")

    # Stub: rifiuta tutto se AUTH_ENABLED=true ma jose non installato
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="AUTH_ENABLED=true but JWT library not installed. Run: pip install python-jose[cryptography]",
    )


# ── Backward-compat helper ────────────────────────────────────────────────────

async def get_user_scope_query(user_id: str) -> dict:
    """
    Query Mongo scoping per user. Usata in tutti gli endpoint.
    Single-tenant: ritorna {} (no filter, comportamento attuale).
    Multi-tenant: ritorna {"user_id": user_id}.
    """
    if not AUTH_ENABLED:
        return {}
    return {"user_id": user_id}


# ── Migration script entry point (placeholder) ────────────────────────────────

async def migrate_assign_default_user(db) -> dict:
    """
    Migration one-shot: assegna user_id="legacy" a tutti i documenti esistenti
    nelle collection. Da eseguire UNA volta prima di flippare AUTH_ENABLED.

    Usage:
        python -c "from auth import migrate_assign_default_user; ..."

    Restituisce un report con count per collection.
    """
    collections = [
        "runs", "profile", "user_layout", "strava_tokens", "garmin_csv_data",
        "analytics_cache", "runner_dna_cache", "training_plan", "gct_analysis",
        "recovery_checkins", "fitness_freshness",
    ]
    report = {}
    for coll_name in collections:
        coll = db[coll_name]
        # Aggiunge user_id="legacy" a tutti i doc che non lo hanno
        result = await coll.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": "legacy"}},
        )
        report[coll_name] = {
            "modified": result.modified_count,
            "matched": result.matched_count,
        }
    return report
