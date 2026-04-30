"""
Backend smoke tests — minimum-viable insurance contro deploy regression.

LEZIONE LEARNED (round 7): round 5 ha pushato `from backend.routers import ...`
in server.py. Render usa `rootDir: backend` (CWD=backend/) → import fallisce →
build silenziosamente rotta → backend bloccato a vecchia versione 24+ ore.

Questi test girano in CI con CWD=root (`cd backend && pytest`) E in modalità
Render-simulato. Bloccano il merge se l'app non parte.

Run:
    pytest backend/test_smoke.py -v

CI:
    `.github/workflows/ci.yml` ora gira pytest backend/ SENZA continue-on-error.
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"


# ── 1. Render layout: app deve caricarsi con CWD=backend/ ──────────────────────

def test_app_loads_in_render_layout():
    """Simula `rootDir: backend` di Render: CWD=backend/, modulo `backend` invisibile."""
    result = subprocess.run(
        [sys.executable, "-c", "from server import app; print(len(app.routes))"],
        cwd=str(BACKEND_DIR),
        env={**os.environ, "MONGO_URL": os.environ.get("MONGO_URL", "mongodb://localhost:27017")},
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"Backend import failed in Render layout (CWD=backend/).\n"
        f"STDERR:\n{result.stderr}\n"
        f"STDOUT:\n{result.stdout}"
    )
    n_routes = int(result.stdout.strip())
    assert n_routes >= 50, f"Expected >=50 routes, got {n_routes}"


def test_app_loads_in_dev_layout():
    """Simula dev locale: CWD=root, import via `from backend.server import app`."""
    result = subprocess.run(
        [sys.executable, "-c", "import sys; sys.path.insert(0, '.'); from backend.server import app; print(len(app.routes))"],
        cwd=str(REPO_ROOT),
        env={**os.environ, "MONGO_URL": os.environ.get("MONGO_URL", "mongodb://localhost:27017")},
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"Backend import failed in dev layout (CWD=root).\n"
        f"STDERR:\n{result.stderr}"
    )


# ── 2. Endpoint smoke (TestClient) ────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient. Mongo non è realmente raggiunto (lifespan non triggerato)."""
    sys.path.insert(0, str(BACKEND_DIR))
    from fastapi.testclient import TestClient
    from server import app  # type: ignore

    return TestClient(app)


def test_health_root(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["app"] == "Altrove"


def test_version_endpoint(client):
    """/api/version deve includere `timestamp` (round 5 router)."""
    r = client.get("/api/version")
    assert r.status_code == 200
    body = r.json()
    assert "version" in body
    assert "timestamp" in body, "timestamp field missing — routers/health.py not registered?"
    assert "analytics_schema_version" in body


def test_sse_endpoint_registered(client):
    """/api/events/stream deve esistere (round 5 SSE)."""
    # Non possiamo davvero consumarlo (long-poll), ma OPTIONS o HEAD verifica esistenza
    r = client.options("/api/events/stream")
    # Anche un 405 va bene: significa che l'endpoint esiste, solo non accetta OPTIONS
    assert r.status_code in (200, 204, 405), f"SSE endpoint missing: HTTP {r.status_code}"


def test_routes_critical_present(client):
    """Sanity: tutti gli endpoint critici sono registrati."""
    routes = [r.path for r in client.app.routes if hasattr(r, "path")]
    critical = [
        "/api/version",
        "/api/strava/sync",
        "/api/runs",
        "/api/dashboard",
        "/api/profile",
        "/api/training-plan",
        "/api/vdot/paces",
        "/api/events/stream",
    ]
    missing = [c for c in critical if c not in routes]
    assert not missing, f"Critical routes missing: {missing}"
