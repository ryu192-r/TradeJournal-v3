"""Partial exit regressions."""

from datetime import datetime
from decimal import Decimal
from itertools import count

import pytest
from fastapi import HTTPException

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.partial_exit import PartialExit
from app.models.trade import Trade
from app.models.user import User
from app.services.partial_exit_service import _remaining_qty, PartialExitService
from app.schemas.partial_exit import PartialExitCreate

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


def _trade(user_id: int, quantity: str = "10"):
    return Trade(
        symbol="RELIANCE",
        direction="LONG",
        entry_price=Decimal("100.00"),
        quantity=Decimal(quantity),
        entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
        status="open",
        user_id=user_id,
    )


def _payload(qty: str):
    return PartialExitCreate(
        qty=Decimal(qty),
        exit_price=Decimal("110.00"),
        exit_time=datetime.fromisoformat("2025-01-13T10:00:00"),
    )


def test_partial_exit_allows_less_than_remaining_quantity(db_session):
    user = _make_user(db_session)
    trade = _trade(user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    entry = PartialExitService(db_session).create_partial_exit(trade.id, _payload("4"))

    assert entry.qty == Decimal("4")
    assert isinstance(entry.created_at, datetime)
    assert _remaining_qty(trade, db_session) == Decimal("6.00000000")


def test_partial_exit_rejects_full_remaining_quantity(db_session):
    user = _make_user(db_session)
    trade = _trade(user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    with pytest.raises(HTTPException) as exc:
        PartialExitService(db_session).create_partial_exit(trade.id, _payload("10"))

    assert exc.value.status_code == 400
    assert "Use full close for remaining quantity" in exc.value.detail
    assert _remaining_qty(trade, db_session) == Decimal("10.00000000")


def test_partial_exit_rejects_final_remaining_after_prior_partial(db_session):
    user = _make_user(db_session)
    trade = _trade(user.id)
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
        PartialExitService(db_session).create_partial_exit(trade.id, _payload("4"))

    assert exc.value.status_code == 400
    assert _remaining_qty(trade, db_session) == Decimal("4.00000000")


def test_list_partial_exits_returns_entries_and_remaining_quantity(db_session):
    user = _make_user(db_session)
    trade = _trade(user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    first = PartialExitService(db_session).create_partial_exit(trade.id, _payload("3"))
    second = PartialExitService(db_session).create_partial_exit(trade.id, _payload("2"))

    data = PartialExitService(db_session).list_partial_exits(trade.id)

    assert [item.id for item in data[0]] == [first.id, second.id]
    assert data[1] == Decimal("5.00000000")


def test_delete_partial_exit_restores_remaining_quantity(db_session):
    user = _make_user(db_session)
    trade = _trade(user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    entry = PartialExitService(db_session).create_partial_exit(trade.id, _payload("3"))

    result = PartialExitService(db_session).delete_partial_exit(trade.id, entry.id)

    assert result is None
    items, _ = PartialExitService(db_session).list_partial_exits(trade.id)
    assert items == []
    assert _remaining_qty(trade, db_session) == Decimal("10.00000000")


def test_full_close_after_partial_exit_uses_remaining_quantity(db_session):
    user = _make_user(db_session)
    trade = _trade(user.id)
    trade.fees = Decimal("10.00")
    trade.stop_price = Decimal("95.00")
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    PartialExitService(db_session).create_partial_exit(trade.id, _payload("4"))
    trade.exit_price = Decimal("120.00")
    trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
    db_session.commit()
    db_session.refresh(trade)

    assert trade.pnl == Decimal("150.0000000000000000")
    assert trade.r_multiple == Decimal("3.0000000000000000")
