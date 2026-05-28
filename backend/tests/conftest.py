"""Pytest configuration: test DB override, fixtures for client and auth tokens."""

import os

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("RATE_LIMIT_OFF", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")

import pytest
from app.db.database import Base, get_db
from app.db.database import engine as real_engine
from app.main import app as _real_app


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
    """HTTPX sync client with fresh empty DB per test."""
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)

    from starlette.testclient import TestClient
    c = TestClient(app)
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