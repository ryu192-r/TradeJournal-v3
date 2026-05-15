# ADR-010: SQLAlchemy Sync Engine (Not Async)

## Status
Accepted

## Context
FastAPI is async-capable, but the app is a single-user trading journal with low concurrency requirements. Async SQLAlchemy adds complexity (async session management, async drivers, async test fixtures).

## Decision
Backend uses SQLAlchemy 2.0 **sync** engine with `pool_pre_ping=True`. Database sessions created per-request via `SessionLocal()` dependency injection. Tables auto-created on startup via `Base.metadata.create_all(bind=engine)`.

## Consequences
- ✅ Simpler code — no async/await for DB operations, no async test fixtures
- ✅ Tests easily override to SQLite using `dependency_overrides[get_db]`
- ✅ `pool_pre_ping=True` detects stale connections (important for PostgreSQL)
- ⚠️ DB operations block the event loop — limits concurrency (acceptable for single-user)
- ⚠️ Adding async endpoints that use DB would require separate async engine
- ⚠️ `Base.metadata.create_all` at import time — tables created before first request

## Implementation
- `backend/app/db/database.py` — `create_engine(settings.DATABASE_URL, pool_pre_ping=True)`
- `backend/app/main.py` — `Base.metadata.create_all(bind=engine)` at import time
- `backend/tests/conftest.py` — `dependency_overrides[get_db]` swaps to SQLite test engine
