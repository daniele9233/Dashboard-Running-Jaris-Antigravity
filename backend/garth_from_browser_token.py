"""
Salva un token Garmin OAuth estratto dal browser su MongoDB.

Come usarlo:
1. Vai su connect.garmin.com (devi essere loggato)
2. Apri F12 → Network → ricarica la pagina
3. Cerca una richiesta a connectapi.garmin.com
4. Copia il valore di: Authorization: Bearer <TOKEN>
5. Incollalo nella variabile ACCESS_TOKEN qui sotto
6. Esegui: python garth_from_browser_token.py
"""

import os, asyncio
import motor.motor_asyncio as motor
import garth
from dotenv import load_dotenv

load_dotenv()

# ── INCOLLA QUI IL TOKEN DAL BROWSER ──────────────────────────────────────────
ACCESS_TOKEN = "INCOLLA_QUI_IL_TOKEN_BEARER"
# ─────────────────────────────────────────────────────────────────────────────

GARMIN_EMAIL = os.environ.get("GARMIN_EMAIL", "")
MONGO_URL    = os.environ.get("MONGO_URL", "")
DB_NAME      = os.environ.get("DB_NAME", "DANIDB")

async def main():
    print("Costruzione client garth da token browser...")

    # Crea un OAuth2Token direttamente dal bearer token
    from garth.auth_tokens import OAuth2Token
    import time

    token = OAuth2Token(
        scope="",
        jti="",
        token_type="Bearer",
        access_token=ACCESS_TOKEN,
        refresh_token="",
        expires_in=3600,
        expires_at=int(time.time()) + 3600,
        refresh_token_expires_in=7776000,
        refresh_token_expires_at=int(time.time()) + 7776000,
    )

    gc = garth.Client()
    gc.oauth2_token = token

    # Smoke test
    try:
        resp = gc.connectapi("/userprofile-service/userprofile/personal-information")
        print(f"✅ Token valido! Utente: {resp.get('displayName', 'N/A')}")
    except Exception as e:
        print(f"❌ Token non valido: {e}")
        return

    # Salva su MongoDB
    token_dump = gc.dumps()
    client = motor.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.garmin_tokens.update_one(
        {"email": GARMIN_EMAIL},
        {"$set": {"email": GARMIN_EMAIL, "token_dump": token_dump}},
        upsert=True,
    )
    print(f"✅ Token salvato su MongoDB per {GARMIN_EMAIL}")
    print("Ora il Garmin Sync funzionerà senza bisogno di login!")

asyncio.run(main())
