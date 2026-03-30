"""
Genera un token Garmin OAuth e lo salva su MongoDB via /api/garmin/save-token.

Esegui UNA SOLA VOLTA quando Garmin non è in rate-limit.
Dopo, il backend riusa il token automaticamente per sempre.

Usage:
    python garth_generate_token.py
"""

import os, requests
from dotenv import load_dotenv
load_dotenv()

GARMIN_EMAIL    = os.environ.get("GARMIN_EMAIL", "")
GARMIN_PASSWORD = os.environ.get("GARMIN_PASSWORD", "")
BACKEND_URL     = os.environ.get("BACKEND_URL", "http://localhost:8000")

print(f"Login Garmin come {GARMIN_EMAIL}...")

from garminconnect import Garmin
client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
client.login()
print("Login OK")

token_dump = client.garth.dumps()
print(f"Token generato ({len(token_dump)} chars)")

print(f"\nInvio token al backend {BACKEND_URL}/api/garmin/save-token ...")
resp = requests.post(
    f"{BACKEND_URL}/api/garmin/save-token",
    json={"token_dump": token_dump},
    timeout=15,
)
print(f"Status: {resp.status_code}")
print(resp.json())
