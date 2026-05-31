"""Pytest configuration: test DB override, fixtures for client and auth tokens."""

import os

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("RATE_LIMIT_OFF", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")

import pytest
import anyio
import httpx
from sqlalchemy.orm import close_all_sessions

import fastapi.dependencies.utils as fastapi_dependencies
import fastapi.routing as fastapi_routing
import starlette.routing as starlette_routing
import starlette.concurrency as starlette_concurrency


async def _run_sync_inline(func, *args, **kwargs):
    """Test sandbox: anyio.to_thread.run_sync hangs after sync call returns."""
    return func(*args, **kwargs)


async def _anyio_run_sync_inline(func, *args, abandon_on_cancel=False, cancellable=None, limiter=None):
    """Inline AnyIO thread offload in tests; product code still uses threads."""
    return func(*args)


anyio.to_thread.run_sync = _anyio_run_sync_inline
fastapi_dependencies.run_in_threadpool = _run_sync_inline
fastapi_routing.run_in_threadpool = _run_sync_inline
starlette_routing.run_in_threadpool = _run_sync_inline
starlette_concurrency.run_in_threadpool = _run_sync_inline

from app.db.database import Base, get_db
from app.db.database import engine as real_engine
from app.main import app as _real_app


def _reset_test_database() -> None:
    """Fresh schema for each test — close sessions so SQLite drop_all is reliable."""
    import app.models  # noqa: F401 — register all tables on Base.metadata

    close_all_sessions()
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)


async def __get_db_test():
    from app.db.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_real_app.dependency_overrides[get_db] = __get_db_test


class ASGISyncClient:
    """Sync facade over httpx ASGITransport.

    Starlette TestClient uses anyio.from_thread portals. In this sandbox those
    portals block before dispatch, so tests drive ASGI in the current thread.
    """

    def __init__(self, app):
        self.app = app
        self.cookies = httpx.Cookies()

    def request(self, method: str, url: str, **kwargs):
        async def _request():
            transport = httpx.ASGITransport(app=self.app, raise_app_exceptions=True)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://testserver",
                cookies=self.cookies,
            ) as async_client:
                response = await async_client.request(method, url, **kwargs)
                self.cookies.update(async_client.cookies)
                return response

        return anyio.run(_request)

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs):
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs):
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs):
        return self.request("DELETE", url, **kwargs)

    def close(self) -> None:
        return None


@pytest.fixture(scope="function", autouse=True)
def _fresh_test_database():
    """One schema reset per test — avoids stale test.db and fixture ordering bugs."""
    _reset_test_database()
    yield
    close_all_sessions()
    Base.metadata.drop_all(bind=real_engine)


@pytest.fixture(scope="session")
def app():
    return _real_app


@pytest.fixture(scope="function")
def client(app):
    """HTTPX sync facade backed by per-test fresh DB (see _fresh_test_database)."""
    http = ASGISyncClient(app)
    try:
        yield http
    finally:
        http.close()


@pytest.fixture(scope="function")
def auth_user_token(client) -> str:
    """Register a test user and return their access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "pytest@example.com", "full_name": "Pytest", "password": "pyt12345"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


@pytest.fixture(scope="function")
def db_session():
    """Direct DB session; schema reset handled by _fresh_test_database autouse."""
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
