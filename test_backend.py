
import httpx
import json

url = "https://dani-backend-ea0s.onrender.com/api/jarvis/chat"
payload = {"transcript": "Jarvis apri dashboard"}

try:
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
