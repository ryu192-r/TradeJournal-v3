"""Performance OS user ownership — isolation + migration backfill policy."""

import importlib.util
from datetime import date
from itertools import count

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text

import app.models  # noqa: F401 — register all models on Base.metadata
from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.performance_os import DailyWorkflow, MonthlyReview, WeeklyReview
from app.models.user import User
from app.routers.performance_os import (
    DailyWorkflowUpdate,
    EnrichMonthlyRequest,
    EnrichWeeklyRequest,
    WorkflowEnsureRequest,
    enrich_monthly_review,
    enrich_weekly_review,
    ensure_workflow,
    get_monthly_review,
    get_weekly_review,
    get_workflow_by_date,
    update_workflow,
)

_MIG_PATH = (
    __import__("pathlib").Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "011_performance_os_user_ownership.py"
)
_mig_spec = importlib.util.spec_from_file_location("migration_011", _MIG_PATH)
mig = importlib.util.module_from_spec(_mig_spec)
_mig_spec.loader.exec_module(mig)

_email_counter = count(1)


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=real_engine)


def _make_user(db_session):
    user = User(
        email=f"perf_{next(_email_counter)}@example.com",
        full_name="Perf User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


# ── User isolation (router) ───────────────────────────────────────────


def test_daily_workflow_isolated_per_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    d = "2025-06-02"
    db_session.commit()

    wf_a = ensure_workflow(WorkflowEnsureRequest(date=d), db_session, user_a)
    wf_b = ensure_workflow(WorkflowEnsureRequest(date=d), db_session, user_b)

    assert wf_a.id != wf_b.id
    assert wf_a.date == wf_b.date


def test_weekly_review_isolated_per_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    ws = "2025-06-02"
    db_session.commit()

    rev_a = enrich_weekly_review(EnrichWeeklyRequest(week_start=ws), db_session, user_a)
    rev_b = enrich_weekly_review(EnrichWeeklyRequest(week_start=ws), db_session, user_b)

    assert rev_a.id != rev_b.id
    assert rev_a.week_start == rev_b.week_start


def test_monthly_review_isolated_per_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    month = "2025-06"
    db_session.commit()

    rev_a = enrich_monthly_review(EnrichMonthlyRequest(month=month), db_session, user_a)
    rev_b = enrich_monthly_review(EnrichMonthlyRequest(month=month), db_session, user_b)

    assert rev_a.id != rev_b.id
    assert rev_a.month == rev_b.month


def test_user_cannot_read_other_daily_workflow(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    target = date(2025, 6, 3)
    db_session.commit()

    ensure_workflow(WorkflowEnsureRequest(date=target.isoformat()), db_session, user_a)

    with pytest.raises(HTTPException) as exc:
        get_workflow_by_date(target, db_session, user_b)
    assert exc.value.status_code == 404


def test_user_cannot_update_other_daily_workflow(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    target = date(2025, 6, 4)
    db_session.commit()

    wf_a = ensure_workflow(WorkflowEnsureRequest(date=target.isoformat()), db_session, user_a)
    wf_b = update_workflow(
        target,
        DailyWorkflowUpdate(pre_market_notes="user B notes"),
        db_session,
        user_b,
    )

    assert wf_b.id != wf_a.id
    row_a = db_session.query(DailyWorkflow).filter(DailyWorkflow.id == wf_a.id).one()
    assert row_a.pre_market_notes is None
    assert wf_b.pre_market_notes == "user B notes"


def test_enrich_weekly_scoped_to_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    ws = "2025-06-09"
    db_session.commit()

    enrich_weekly_review(EnrichWeeklyRequest(week_start=ws), db_session, user_a)

    with pytest.raises(HTTPException) as exc:
        get_weekly_review(date.fromisoformat(ws), db_session, user_b)
    assert exc.value.status_code == 404


def test_enrich_monthly_scoped_to_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    month = "2025-07"
    db_session.commit()

    enrich_monthly_review(EnrichMonthlyRequest(month=month), db_session, user_a)

    with pytest.raises(HTTPException) as exc:
        get_monthly_review(month, db_session, user_b)
    assert exc.value.status_code == 404


def test_no_global_date_only_queries_in_router():
    import inspect
    from app.routers import performance_os as router_mod

    source = inspect.getsource(router_mod)
    assert "DailyWorkflow.user_id" in source
    assert "WeeklyReview.user_id" in source
    assert "MonthlyReview.user_id" in source


def test_all_perf_os_rows_have_user_id(db_session):
    user = _make_user(db_session)
    db_session.commit()
    ensure_workflow(WorkflowEnsureRequest(date="2025-06-10"), db_session, user)
    enrich_weekly_review(EnrichWeeklyRequest(week_start="2025-06-09"), db_session, user)
    enrich_monthly_review(EnrichMonthlyRequest(month="2025-06"), db_session, user)

    for model in (DailyWorkflow, WeeklyReview, MonthlyReview):
        rows = db_session.query(model).all()
        assert rows
        assert all(r.user_id == user.id for r in rows)


# ── Migration backfill policy ───────────────────────────────────────────


def _legacy_table_engine():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                email VARCHAR NOT NULL,
                full_name VARCHAR,
                hashed_password VARCHAR NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE daily_workflows (
                id INTEGER PRIMARY KEY,
                date DATE NOT NULL,
                phase VARCHAR(20) DEFAULT 'pre_market'
            )
        """))
        conn.execute(text(
            "CREATE UNIQUE INDEX ix_daily_workflows_date ON daily_workflows (date)"
        ))
    return engine


def _legacy_with_null_user_id_row(engine, user_rows: list[tuple] | None = None):
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE daily_workflows ADD COLUMN user_id INTEGER"))
        for email, name, pwd in user_rows or []:
            conn.execute(
                text(
                    "INSERT INTO users (email, full_name, hashed_password) "
                    "VALUES (:email, :name, :pwd)"
                ),
                {"email": email, "name": name, "pwd": pwd},
            )
        conn.execute(text(
            "INSERT INTO daily_workflows (date, phase, user_id) "
            "VALUES ('2025-01-01', 'pre_market', NULL)"
        ))


def test_migration_backfill_single_user():
    engine = _legacy_table_engine()
    _legacy_with_null_user_id_row(
        engine,
        [("solo@example.com", "Solo", "hash")],
    )
    conn = engine.connect()
    mig.backfill_user_id(conn, "daily_workflows")
    assert mig.count_null_user_id_rows(conn, "daily_workflows") == 0
    uid = conn.execute(text("SELECT user_id FROM daily_workflows")).scalar()
    assert uid == 1
    conn.close()


def test_migration_backfill_multi_user_raises():
    engine = _legacy_table_engine()
    _legacy_with_null_user_id_row(
        engine,
        [("a@x.com", "A", "h"), ("b@x.com", "B", "h")],
    )
    conn = engine.connect()
    with pytest.raises(RuntimeError, match="Cannot assign orphan rows"):
        mig.backfill_user_id(conn, "daily_workflows")
    conn.close()


def test_migration_empty_table_zero_users_safe():
    engine = _legacy_table_engine()
    conn = engine.connect()
    mig.backfill_user_id(conn, "daily_workflows")
    assert mig.count_null_user_id_rows(conn, "daily_workflows") == 0
    conn.close()


def test_migration_zero_users_with_rows_raises():
    engine = _legacy_table_engine()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE daily_workflows ADD COLUMN user_id INTEGER"))
        conn.execute(text(
            "INSERT INTO daily_workflows (date, phase, user_id) "
            "VALUES ('2025-01-01', 'pre_market', NULL)"
        ))
    conn = engine.connect()
    with pytest.raises(RuntimeError, match="no users exist"):
        mig.backfill_user_id(conn, "daily_workflows")
    conn.close()
