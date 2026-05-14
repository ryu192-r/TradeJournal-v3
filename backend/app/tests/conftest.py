"""Shared pytest fixtures for backend tests.

Hits the running Docker backend on port 8000 via httpx.
This avoids the shared in-memory rate limiter state that TestClient causes.
"""

import sys
import os
import time

_app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

import pytest
import httpx


# ── Live server fixtures (hit Docker backend on port 8000) ──────

LIVE_BASE = "http://localhost:8000"


@pytest.fixture()
def http():
    """Return an httpx.Client hitting the live backend."""
    with httpx.Client(base_url=LIVE_BASE, timeout=10.0) as c:
        yield c


# Backward compatibility: alias `client` → `http`
@pytest.fixture()
def client(http):
    yield http


@pytest.fixture()
def registered_user_live(http):
    """Register a unique test user against the live backend."""
    ts = int(time.time() * 1000)
    email = f"test.{ts}@example.com"
    password = "TestPass123!"

    resp = http.post("/api/v1/auth/register", json={
        "email": email,
        "full_name": "Test User",
        "password": password,
    })
    assert resp.status_code == 201, f"Register failed: {resp.status_code} {resp.text}"
    data = resp.json()

    return {
        "email": email,
        "password": password,
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
    }


# Backward compatibility: alias `registered_user` → `registered_user_live`
@pytest.fixture()
def registered_user(registered_user_live):
    yield registered_user_live


# Backward compatibility: alias `auth_headers` → `auth_headers_live`
@pytest.fixture()
def auth_headers(registered_user):
    """Return Authorization header dict with valid Bearer token."""
    return {"Authorization": f"Bearer {registered_user['access_token']}"}


@pytest.fixture()
def auth_headers_live(registered_user_live):
    """Return Authorization header dict with valid Bearer token."""
    return {"Authorization": f"Bearer {registered_user_live['access_token']}"}


@pytest.fixture()
def sample_trade_data():
    """Return a valid trade creation payload."""
    return {
        "symbol": "TESTCO",
        "direction": "LONG",
        "entry_price": "3500.00",
        "exit_price": "3550.00",
        "quantity": "10",
        "entry_time": "2026-01-15T09:30:00",
        "fees": "10.00",
        "setup": "breakout",
        "status": "draft",
    }


@pytest.fixture()
def db_session():
    """Dummy fixture for tests that need it (hash verification test).

    Uses the live backend's DB via psycopg2 directly.
    """
    from sqlalchemy import create_engine
    from app.core.config import settings
    engine = create_engine(settings.DATABASE_URL)
    from sqlalchemy.orm import Session
    with Session(engine) as s:
        yield s
        engine.dispose()
