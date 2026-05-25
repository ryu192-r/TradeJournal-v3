"""Partial exit regressions."""

from datetime import datetime
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.partial_exit import PartialExit
from app.models.trade import Trade
from app.routers.partial_exit import _remaining_qty, create_partial_exit, delete_partial_exit, list_partial_exits
from app.schemas.partial_exit import PartialExitCreate


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


def _trade(quantity: str = "10"):
    return Trade(
        symbol="RELIANCE",
        direction="LONG",
        entry_price=Decimal("100.00"),
        quantity=Decimal(quantity),
        entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
        status="open",
    )


def _payload(qty: str):
    return PartialExitCreate(
        qty=Decimal(qty),
        exit_price=Decimal("110.00"),
        exit_time=datetime.fromisoformat("2025-01-13T10:00:00"),
    )


def test_partial_exit_allows_less_than_remaining_quantity(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    entry = create_partial_exit(trade.id, _payload("4"), db_session)

    assert entry.qty == Decimal("4")
    assert isinstance(entry.created_at, datetime)
    assert _remaining_qty(trade, db_session) == Decimal("6.00000000")


def test_partial_exit_rejects_full_remaining_quantity(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    with pytest.raises(HTTPException) as exc:
        create_partial_exit(trade.id, _payload("10"), db_session)

    assert exc.value.status_code == 400
    assert "Use full close for remaining quantity" in exc.value.detail
    assert _remaining_qty(trade, db_session) == Decimal("10.00000000")


def test_partial_exit_rejects_final_remaining_after_prior_partial(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    db_session.add(
        PartialExit(
            trade_id=trade.id,
            qty=Decimal("6.00"),
            exit_price=Decimal("105.00"),
            exit_time=datetime.fromisoformat("2025-01-13T10:00:00"),
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        create_partial_exit(trade.id, _payload("4"), db_session)

    assert exc.value.status_code == 400
    assert _remaining_qty(trade, db_session) == Decimal("4.00000000")


def test_list_partial_exits_returns_entries_and_remaining_quantity(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    first = create_partial_exit(trade.id, _payload("3"), db_session)
    second = create_partial_exit(trade.id, _payload("2"), db_session)

    data = list_partial_exits(trade.id, db_session)

    assert [item.id for item in data["items"]] == [first.id, second.id]
    assert data["remaining_qty"] == "5.00000000"


def test_delete_partial_exit_restores_remaining_quantity(db_session):
    trade = _trade()
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    entry = create_partial_exit(trade.id, _payload("3"), db_session)

    result = delete_partial_exit(trade.id, entry.id, db_session)

    assert result is None
    assert list_partial_exits(trade.id, db_session)["items"] == []
    assert _remaining_qty(trade, db_session) == Decimal("10.00000000")


def test_full_close_after_partial_exit_uses_remaining_quantity(db_session):
    trade = _trade()
    trade.fees = Decimal("10.00")
    trade.stop_price = Decimal("95.00")
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    create_partial_exit(trade.id, _payload("4"), db_session)
    trade.exit_price = Decimal("120.00")
    trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
    db_session.commit()
    db_session.refresh(trade)

    assert trade.pnl == Decimal("150.0000000000000000")
    assert trade.r_multiple == Decimal("3.0000000000000000")
