# ADR-015: Alembic Database Migrations

## Status
Accepted

## Context
Tables were auto-created via `Base.metadata.create_all()` on startup. This works for development but is unsafe for production — adding columns, renaming tables, or changing types requires dropping and recreating the entire DB.

## Decision
Use Alembic for versioned, reversible schema migrations. On startup, the app runs `alembic upgrade head`. If alembic fails, it falls back to `create_all` for development convenience.

The initial migration (`001_initial_baseline`) is a baseline marker. Existing databases should run `alembic stamp head` to mark themselves as up-to-date before applying future migrations.

## Consequences
- ✅ Versioned schema changes with rollback support
- ✅ Safe production deployments — no data loss on schema changes
- ✅ Migration history is tracked in code
- ⚠️ Requires `alembic` dependency in production
- ⚠️ Initial migration must be stamped on existing databases

## Implementation
- `backend/alembic/` — migration scripts and configuration
- `backend/app/main.py` — `run_migrations()` on startup
- `backend/Dockerfile` — alembic installed via requirements.txt
- Baseline: `alembic/versions/001_initial_baseline.py`
