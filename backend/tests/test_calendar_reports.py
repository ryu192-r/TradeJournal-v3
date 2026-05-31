from datetime import date, datetime
from decimal import Decimal
from itertools import count

import pytest

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.daily_journal import DailyJournal
from app.models.emotion_log import EmotionLog
from app.models.performance_os import DailyWorkflow
from app.models.trade import Trade
from app.models.user import User
from app.routers.calendar import get_calendar_month
from app.routers.reports import get_weekly_report
from app.utils.trade_dates import get_trade_session_date, weekday_from_session_date

_email_counter = count(1)


def _make_user(db_session):
    user = User(
        email=f"test_{next(_email_counter)}@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


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


def test_calendar_month_returns_day_rollups(db_session):
    user = _make_user(db_session)
    trade = Trade(
        symbol="TCS",
        entry_price=Decimal("100"),
        exit_price=Decimal("110"),
        quantity=Decimal("10"),
        entry_time=datetime(2026, 5, 4, 9, 30),
        exit_time=datetime(2026, 5, 4, 15, 15),
        pnl=Decimal("100"),
        status="closed",
        setup="EP",
        user_id=user.id,
    )
    db_session.add(trade)
    db_session.flush()
    db_session.add(EmotionLog(trade_id=trade.id, emotion="revenge", timestamp=datetime(2026, 5, 4, 10, 0)))
    db_session.add(DailyJournal(date=date(2026, 5, 4), post_trade_notes="Reviewed", discipline_rating=3, rules_violated="Chased", user_id=user.id))
    db_session.add(DailyWorkflow(date=date(2026, 5, 4), phase="review", pre_market_done=True, execution_done=True, user_id=user.id))
    db_session.commit()

    payload = get_calendar_month(month="2026-05", db=db_session, current_user=user)

    assert payload["summary"]["trade_count"] == 1
    day = next(d for d in payload["days"] if d["date"] == "2026-05-04")
    assert day["net_pnl"] == "100.00"
    assert day["journal_done"] is True
    assert "emotional-trading" in day["warnings"]
    assert "rule-violation" in day["warnings"]


def test_calendar_monday_trade_not_on_prior_sunday(db_session):
    """Regression: entry on Monday must not appear on previous Sunday."""
    user = _make_user(db_session)
    # 2025-11-24 is Monday; 2025-11-23 is Sunday
    trade = Trade(
        symbol="RELIANCE",
        entry_price=Decimal("100"),
        exit_price=Decimal("110"),
        quantity=Decimal("10"),
        entry_time=datetime(2025, 11, 24, 9, 30),
        exit_time=datetime(2025, 11, 24, 15, 15),
        pnl=Decimal("100"),
        status="closed",
        user_id=user.id,
    )
    db_session.add(trade)
    db_session.commit()

    assert get_trade_session_date(trade) == date(2025, 11, 24)
    assert weekday_from_session_date(date(2025, 11, 24)) == 1

    payload = get_calendar_month(month="2025-11", db=db_session, current_user=user)
    sunday = next(d for d in payload["days"] if d["date"] == "2025-11-23")
    monday = next(d for d in payload["days"] if d["date"] == "2025-11-24")

    assert sunday["trade_count"] == 0
    assert monday["trade_count"] == 1
    assert len(monday["trades"]) == 1


def test_reports_weekly_returns_deterministic_sections(db_session):
    user = _make_user(db_session)
    db_session.add(
        Trade(
            symbol="INFY",
            entry_price=Decimal("200"),
            exit_price=Decimal("190"),
            quantity=Decimal("5"),
            entry_time=datetime(2026, 5, 5, 9, 30),
            exit_time=datetime(2026, 5, 5, 15, 15),
            pnl=Decimal("-50"),
            status="closed",
            setup="Pullback",
            user_id=user.id,
        )
    )
    db_session.add(DailyJournal(date=date(2026, 5, 5), discipline_rating=4, user_id=user.id))
    db_session.commit()

    payload = get_weekly_report(week_start=date(2026, 5, 4), db=db_session, current_user=user)

    assert payload["period"] == "weekly"
    assert payload["summary"]["net_pnl"] == "-50.00"
    assert payload["setup_report"][0]["setup"] == "Pullback"
    assert payload["behavior_report"]["journal_days"] == 1
    assert "csv" in payload["export_formats"]
