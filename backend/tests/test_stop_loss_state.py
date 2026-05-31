from datetime import datetime
from decimal import Decimal
from itertools import count

from app.core.security import get_password_hash
from app.models.trade import Trade
from app.models.user import User
from app.routers.trades import create_stop_history, create_trade, pyramid_trade, update_trade
from app.schemas.stop_history import StopHistoryCreate
from app.schemas.trade import PyramidTradeRequest, TradeCreate, TradeUpdate

_email_counter = count(1)


def _make_user(db_session):
    user = User(
        email=f"stop_{next(_email_counter)}@example.com",
        full_name="Stop User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _create_open_trade(db_session, user):
    return create_trade(
        TradeCreate(
            symbol="RELIANCE",
            direction="LONG",
            entry_price=Decimal("100"),
            exit_price=None,
            quantity=Decimal("10"),
            entry_time=datetime(2026, 5, 22, 9, 30),
            fees=Decimal("0"),
            stop_price=Decimal("90"),
            target_price=Decimal("130"),
        ),
        db=db_session,
        current_user=user,
    )


def test_create_trade_defaults_original_stop_from_initial_stop(db_session):
    user = _make_user(db_session)
    trade = _create_open_trade(db_session, user)

    assert trade.stop_price == Decimal("90")
    assert trade.original_stop_price == Decimal("90")
    assert trade.stop_loss_status == "original"


def test_update_current_stop_preserves_original_stop_and_marks_breakeven(db_session):
    user = _make_user(db_session)
    trade = _create_open_trade(db_session, user)

    updated = update_trade(
        trade.id,
        TradeUpdate(stop_price=Decimal("100")),
        db=db_session,
        current_user=user,
    )

    assert updated.stop_price == Decimal("100")
    assert updated.original_stop_price == Decimal("90")
    assert updated.stop_loss_status == "breakeven"


def test_update_current_stop_above_entry_locks_profit_not_manual(db_session):
    user = _make_user(db_session)
    trade = _create_open_trade(db_session, user)

    updated = update_trade(
        trade.id,
        TradeUpdate(stop_price=Decimal("105")),
        db=db_session,
        current_user=user,
    )

    assert updated.stop_price == Decimal("105")
    assert updated.original_stop_price == Decimal("90")
    assert updated.stop_loss_status == "profit_locked"


def test_stop_history_syncs_current_stop_without_mutating_original(db_session):
    user = _make_user(db_session)
    trade = _create_open_trade(db_session, user)

    create_stop_history(
        trade.id,
        StopHistoryCreate(
            stop_type="manual",
            price=Decimal("105"),
            timestamp=datetime(2026, 5, 22, 10, 0),
        ),
        db=db_session,
        current_user=user,
    )
    db_trade = db_session.query(Trade).filter(Trade.id == trade.id).one()

    assert db_trade.stop_price == Decimal("105")
    assert db_trade.original_stop_price == Decimal("90")
    assert db_trade.stop_loss_status == "profit_locked"


def test_pyramid_keeps_original_stop_and_r_multiple_uses_new_total_quantity(db_session):
    user = _make_user(db_session)
    trade = _create_open_trade(db_session, user)

    pyramided = pyramid_trade(
        trade.id,
        PyramidTradeRequest(
            entry_price=Decimal("110"),
            quantity=Decimal("10"),
            entry_time=datetime(2026, 5, 22, 10, 0),
            fees=Decimal("0"),
        ),
        db=db_session,
        current_user=user,
    )

    assert pyramided.entry_price == Decimal("105")
    assert pyramided.quantity == Decimal("20")
    assert pyramided.original_stop_price == Decimal("90")

    closed = update_trade(
        trade.id,
        TradeUpdate(exit_price=Decimal("120"), exit_time=datetime(2026, 5, 22, 15, 0)),
        db=db_session,
        current_user=user,
    )

    # Planned risk after pyramid = (weighted entry 105 - original SL 90) * total qty 20 = 300.
    # PnL = (120 - 105) * 20 = 300, so actual R = 1.
    assert closed.original_stop_price == Decimal("90")
    assert closed.r_multiple == Decimal("1")


def test_model_compute_uses_original_stop_when_current_stop_is_breakeven(db_session):
    user = _make_user(db_session)
    trade = Trade(
        symbol="TCS",
        direction="LONG",
        entry_price=Decimal("100"),
        exit_price=Decimal("110"),
        quantity=Decimal("10"),
        entry_time=datetime(2026, 5, 22, 9, 30),
        exit_time=datetime(2026, 5, 22, 15, 0),
        fees=Decimal("0"),
        stop_price=Decimal("100"),
        original_stop_price=Decimal("90"),
        target_price=Decimal("130"),
        user_id=user.id,
    )
    db_session.add(trade)
    trade.compute_pnl()

    assert trade.pnl == Decimal("100")
    assert trade.r_multiple == Decimal("1")
    assert trade.stop_loss_status == "breakeven"
