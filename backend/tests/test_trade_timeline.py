"""Trade timeline regressions."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.trade import Trade
from app.models.trade_timeline import TradeTimeline, VALID_EVENT_TYPES
from app.routers.trades import soft_delete_trade, update_trade
from app.schemas.trade import TradeUpdate
from app.schemas.trade_timeline import TimelineEventCreate


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
        "quantity": Decimal("10"),
        "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
        "status": "open",
        "stop_price": Decimal("95.00"),
        "target_price": Decimal("120.00"),
    }
    data.update(overrides)
    return Trade(**data)


def test_trade_deleted_is_valid_timeline_event_type():
    assert "trade_deleted" in VALID_EVENT_TYPES
    assert TimelineEventCreate(event_type="trade_deleted").event_type == "trade_deleted"


def test_soft_delete_records_trade_deleted_timeline_event(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    soft_delete_trade(trade.id, db_session)

    event = db_session.query(TradeTimeline).filter(TradeTimeline.trade_id == trade.id).one()
    assert event.event_type == "trade_deleted"
    assert event.note == "Trade deleted"


def test_update_trade_timeline_preserves_previous_stop_and_target(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    update_trade(
        trade.id,
        TradeUpdate(stop_price=Decimal("97.50"), target_price=Decimal("130.00")),
        db_session,
    )

    events = {
        e.event_type: e
        for e in db_session.query(TradeTimeline)
        .filter(TradeTimeline.trade_id == trade.id)
        .all()
    }
    assert events["stop_updated"].old_value == "95.00000000"
    assert events["stop_updated"].new_value == "97.50"
    assert events["target_updated"].old_value == "120.00000000"
    assert events["target_updated"].new_value == "130.00"
