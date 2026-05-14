"""Pytest configuration: test DB override, fixtures for client and auth tokens."""

import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Disable rate limiting for all tests
os.environ["RATE_LIMIT_OFF"] = "true"

from app.db.database import Base, get_db
from app.main import app as _real_app
from app.core.security import get_password_hash
from app.models.user import User


def __get_db_test():
    from app.db.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_real_app.dependency_overrides[get_db] = __get_db_test


@pytest.fixture(scope="session")
def app():
    return _real_app


@pytest.fixture(scope="function") 
def client(app):
    """HTTPX sync client with fresh empty SQLite DB per test."""
    from app.db.database import engine as real_engine, Base
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)

    import httpx
    from httpx import WSGITransport
    transport = WSGITransport(app=app)
    with httpx.Client(transport=transport, base_url="http://test") as c:
        yield c

    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)

    import httpx
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    with httpx.Client(transport=transport, base_url="http://test") as c:
        yield c

    Base.metadata.drop_all(bind=real_engine)


@pytest.fixture(scope="function")
def auth_user_token(client) -> str:
    """Register a test user and return their access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "pytest@example.com", "full_name": "Pytest", "password": "pyt12345"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]
