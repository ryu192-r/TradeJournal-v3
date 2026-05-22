"""Lifecycle analytics endpoint regressions."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.daily_journal import DailyJournal
from app.models.execution_grade import ExecutionGrade
from app.models.trade import Trade
from app.routers.lifecycle_analytics import composite_discipline_score, revenge_trades


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


def _trade(**overrides):
    data = {
        "symbol": "RELIANCE",
        "direction": "LONG",
        "entry_price": Decimal("100.00"),
        "exit_price": Decimal("110.00"),
        "quantity": 10,
        "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
        "exit_time": datetime.fromisoformat("2025-01-13T10:00:00"),
        "status": "closed",
        "pnl": Decimal("100.00"),
    }
    data.update(overrides)
    return Trade(**data)


def test_revenge_trades_empty_payload(db_session):
    assert revenge_trades(None, None, 4, db_session) == {
        "revenge_trades": [],
        "total_flagged": 0,
        "avg_pnl_flagged": None,
        "avg_pnl_unflagged": None,
    }


def test_revenge_trades_one_non_flagged_trade(db_session):
    db_session.add(_trade())
    db_session.commit()

    data = revenge_trades(None, None, 4, db_session)

    assert data["revenge_trades"] == []
    assert data["total_flagged"] == 0
    assert data["avg_pnl_flagged"] is None
    assert data["avg_pnl_unflagged"] == 100.0


def test_revenge_trades_flags_trade_after_loss_inside_window(db_session):
    db_session.add(
        _trade(
            symbol="LOSS",
            exit_price=Decimal("90.00"),
            pnl=Decimal("-100.00"),
        )
    )
    flagged = _trade(
        symbol="BOUNCE",
        exit_price=Decimal("105.00"),
        entry_time=datetime.fromisoformat("2025-01-13T11:00:00"),
        exit_time=datetime.fromisoformat("2025-01-13T11:30:00"),
        pnl=Decimal("50.00"),
    )
    db_session.add(flagged)
    db_session.commit()

    data = revenge_trades(None, None, 4, db_session)

    assert data["total_flagged"] == 1
    assert data["avg_pnl_flagged"] == 50.0
    assert data["avg_pnl_unflagged"] == -100.0
    assert data["revenge_trades"][0]["trade_id"] == flagged.id
    assert data["revenge_trades"][0]["flagged_reason"] == "window"
    assert data["revenge_trades"][0]["hours_after_loss"] == 1.5


def test_discipline_score_empty_payload(db_session):
    data = composite_discipline_score(None, None, db_session)

    assert data == {
        "overall_score": None,
        "components": {},
        "grade": None,
        "insights": [],
    }


def test_discipline_score_combines_behavioral_components(db_session):
    trade = _trade(stop_price=Decimal("95.00"), target_price=Decimal("115.00"), exit_reason="target")
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    db_session.add(ExecutionGrade(trade_id=trade.id, overall_grade="A"))
    db_session.add(DailyJournal(date=trade.entry_time.date(), mood_rating=4, discipline_rating=5))
    db_session.commit()

    data = composite_discipline_score(None, None, db_session)

    assert data["overall_score"] == 100.0
    assert data["grade"] == "A"
    assert data["components"] == {
        "execution_grade": 100.0,
        "stop_discipline": 100.0,
        "plan_adherence": 100.0,
        "journal_consistency": 100.0,
        "revenge_resistance": 100.0,
    }
