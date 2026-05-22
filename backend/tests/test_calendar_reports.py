from datetime import date, datetime
from decimal import Decimal

import pytest

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.daily_journal import DailyJournal
from app.models.emotion_log import EmotionLog
from app.models.performance_os import DailyWorkflow
from app.models.trade import Trade
from app.routers.calendar import get_calendar_month
from app.routers.reports import get_weekly_report


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
    )
    db_session.add(trade)
    db_session.flush()
    db_session.add(EmotionLog(trade_id=trade.id, emotion="revenge", timestamp=datetime(2026, 5, 4, 10, 0)))
    db_session.add(DailyJournal(date=date(2026, 5, 4), post_trade_notes="Reviewed", discipline_rating=3, rules_violated="Chased"))
    db_session.add(DailyWorkflow(date=date(2026, 5, 4), phase="review", pre_market_done=True, execution_done=True))
    db_session.commit()

    payload = get_calendar_month(month="2026-05", db=db_session)

    assert payload["summary"]["trade_count"] == 1
    day = next(d for d in payload["days"] if d["date"] == "2026-05-04")
    assert day["net_pnl"] == "100.00"
    assert day["journal_done"] is True
    assert "emotional-trading" in day["warnings"]
    assert "rule-violation" in day["warnings"]


def test_reports_weekly_returns_deterministic_sections(db_session):
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
        )
    )
    db_session.add(DailyJournal(date=date(2026, 5, 5), discipline_rating=4))
    db_session.commit()

    payload = get_weekly_report(week_start=date(2026, 5, 4), db=db_session)

    assert payload["period"] == "weekly"
    assert payload["summary"]["net_pnl"] == "-50.00"
    assert payload["setup_report"][0]["setup"] == "Pullback"
    assert payload["behavior_report"]["journal_days"] == 1
    assert "csv" in payload["export_formats"]
