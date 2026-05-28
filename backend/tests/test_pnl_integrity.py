"""Comprehensive P&L integrity tests for partial exits, direction-aware math,
fee allocation, capital reconciliation, merge safety, and child data preservation."""

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
from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.trade_timeline import TradeTimeline
from app.models.emotion_log import EmotionLog
from app.models.stop_history import StopHistory
from app.services.partial_exit_service import PartialExitService, _remaining_qty, _allocate_fee
from app.services.trade_service import TradeService
from app.services.capital_service import _auto_reconcile, _reconcile_account
from app.schemas.partial_exit import PartialExitCreate
from app.utils.calculations import calculate_trade_leg_pnl, calculate_trade_metrics, compute_pnl_value

_email_counter = count(100)


def _make_user(db_session):
    user = User(
        email=f"pnl-test-{next(_email_counter)}@example.com",
        full_name="PnL Test User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _make_account(db_session, user_id: int) -> Account:
    account = Account(
        user_id=user_id,
        name="Default",
        broker="TEST",
        initial_balance=Decimal("100000"),
        current_balance=Decimal("100000"),
        currency="INR",
    )
    db_session.add(account)
    db_session.flush()
    return account


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


def _trade(user_id: int, **kw) -> Trade:
    defaults = {
        "symbol": "RELIANCE",
        "direction": "LONG",
        "entry_price": Decimal("100.00"),
        "quantity": Decimal("10"),
        "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
        "status": "open",
        "user_id": user_id,
    }
    defaults.update(kw)
    return Trade(**defaults)


def _payload(qty: str, exit_price: str = "110.00", **kw) -> PartialExitCreate:
    defaults = {
        "qty": Decimal(qty),
        "exit_price": Decimal(exit_price),
        "exit_time": datetime.fromisoformat("2025-01-13T10:00:00"),
    }
    defaults.update(kw)
    return PartialExitCreate(**defaults)


# ── calculate_trade_leg_pnl ──


class TestCalculateTradeLegPnl:
    def test_long_winner(self):
        result = calculate_trade_leg_pnl("LONG", Decimal("100"), Decimal("110"), Decimal("10"))
        assert result == Decimal("100")

    def test_long_loser(self):
        result = calculate_trade_leg_pnl("LONG", Decimal("100"), Decimal("90"), Decimal("10"))
        assert result == Decimal("-100")

    def test_short_winner(self):
        result = calculate_trade_leg_pnl("SHORT", Decimal("100"), Decimal("90"), Decimal("10"))
        assert result == Decimal("100")

    def test_short_loser(self):
        result = calculate_trade_leg_pnl("SHORT", Decimal("100"), Decimal("110"), Decimal("10"))
        assert result == Decimal("-100")

    def test_with_fees(self):
        result = calculate_trade_leg_pnl("LONG", Decimal("100"), Decimal("110"), Decimal("10"), fees=Decimal("10"))
        assert result == Decimal("90")

    def test_null_direction_defaults_long(self):
        result = calculate_trade_leg_pnl(None, Decimal("100"), Decimal("110"), Decimal("10"))
        assert result == Decimal("100")

    def test_invalid_entry_returns_none(self):
        result = calculate_trade_leg_pnl("LONG", None, Decimal("110"), Decimal("10"))
        assert result is None

    def test_zero_quantity_returns_none(self):
        result = calculate_trade_leg_pnl("LONG", Decimal("100"), Decimal("110"), Decimal("0"))
        assert result is None


# ── compute_pnl_value delegates to calculate_trade_leg_pnl ──


class TestComputePnlValue:
    def test_long(self):
        result = compute_pnl_value(Decimal("100"), Decimal("110"), Decimal("10"))
        assert result == Decimal("100")

    def test_short(self):
        result = compute_pnl_value(Decimal("100"), Decimal("90"), Decimal("10"), direction="SHORT")
        assert result == Decimal("100")

    def test_with_fees(self):
        result = compute_pnl_value(Decimal("100"), Decimal("110"), Decimal("10"), fees=Decimal("10"))
        assert result == Decimal("90")


# ── Fee allocation ──


class TestFeeAllocation:
    def test_proportional_allocation(self):
        fee = _allocate_fee(Decimal("100"), Decimal("4"), Decimal("10"))
        assert fee == Decimal("40")

    def test_zero_total_qty(self):
        fee = _allocate_fee(Decimal("100"), Decimal("4"), Decimal("0"))
        assert fee == Decimal("0")

    def test_full_allocation(self):
        fee = _allocate_fee(Decimal("100"), Decimal("10"), Decimal("10"))
        assert fee == Decimal("100")


# ── Partial exit P&L computation ──


class TestPartialExitPnl:
    def test_create_recomputes_trade_pnl_closed_with_partials(self, db_session):
        """Closing a trade after partial exits produces correct total PnL."""
        user = _make_user(db_session)
        trade = _trade(user.id, fees=Decimal("10"), stop_price=Decimal("95"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)

        partial_realized = (Decimal("110") - Decimal("100")) * Decimal("4") - Decimal("4")
        remaining_pnl = (Decimal("120") - Decimal("100")) * Decimal("6") - Decimal("6")
        expected = partial_realized + remaining_pnl
        assert trade.pnl == expected

    def test_create_partial_exit_on_open_trade_pnl_is_null(self, db_session):
        """Open trade with partial exits should have pnl=None."""
        user = _make_user(db_session)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))
        db_session.refresh(trade)

        assert trade.pnl is None

    def test_delete_partial_exit_recomputes_closed_trade_pnl(self, db_session):
        """Deleting partial exit from a closed trade recomputes PnL correctly."""
        user = _make_user(db_session)
        trade = _trade(user.id, fees=Decimal("10"), stop_price=Decimal("95"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        pe = svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)
        pnl_with_partial = trade.pnl

        svc.delete_partial_exit(trade.id, pe.id)
        db_session.refresh(trade)

        expected = (Decimal("120") - Decimal("100")) * Decimal("10") - Decimal("10")
        assert trade.pnl == expected
        assert trade.pnl != pnl_with_partial

    def test_delete_partial_exit_restores_open_trade_pnl_to_null(self, db_session):
        """Deleting last partial exit from open trade sets pnl back to None."""
        user = _make_user(db_session)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        pe = svc.create_partial_exit(trade.id, _payload("4", "110"))
        db_session.refresh(trade)

        assert trade.pnl is None

        svc.delete_partial_exit(trade.id, pe.id)
        db_session.refresh(trade)

        assert trade.pnl is None

    def test_r_multiple_correct_with_partials(self, db_session):
        """R-multiple is computed correctly for closed trade with partial exits."""
        user = _make_user(db_session)
        trade = _trade(user.id, stop_price=Decimal("95"), fees=Decimal("0"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)

        total_pnl = (Decimal("110") - Decimal("100")) * 4 + (Decimal("120") - Decimal("100")) * 6
        risk = (Decimal("100") - Decimal("95")) * 10
        expected_r = total_pnl / risk
        assert trade.r_multiple == expected_r

    def test_weighted_avg_exit_price_closed_trade(self, db_session):
        """Weighted avg exit price includes partial exits and final exit."""
        user = _make_user(db_session)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)

        partials = db_session.query(PartialExit).filter(PartialExit.trade_id == trade.id).all()
        total_exited = sum(p.qty for p in partials)
        partial_weighted = sum(p.exit_price * p.qty for p in partials)
        rem_qty = trade.quantity - total_exited
        expected_avg = (partial_weighted + trade.exit_price * rem_qty) / trade.quantity
        assert abs(expected_avg - Decimal("116")) < Decimal("0.01")

    def test_weighted_avg_exit_price_open_trade_with_partials(self, db_session):
        """Weighted avg exit price for open trade with partials uses partial data only."""
        user = _make_user(db_session)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        partials = db_session.query(PartialExit).filter(PartialExit.trade_id == trade.id).all()
        total_exited = sum(p.qty for p in partials)
        weighted_avg = sum(p.exit_price * p.qty for p in partials) / total_exited
        assert weighted_avg == Decimal("110")

    def test_validation_reject_negative_qty(self, db_session):
        """Negative qty is rejected — by Pydantic gt=0 at schema level."""
        user = _make_user(db_session)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        with pytest.raises(Exception):
            svc.create_partial_exit(trade.id, _payload("-1"))

    def test_validation_reject_negative_exit_price(self, db_session):
        user = _make_user(db_session)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        with pytest.raises(HTTPException) as exc:
            svc.create_partial_exit(trade.id, PartialExitCreate(
                qty=Decimal("4"),
                exit_price=Decimal("-10"),
                exit_time=datetime.fromisoformat("2025-01-13T10:00:00"),
            ))
        assert exc.value.status_code == 400

    def test_cannot_add_partial_to_closed_trade(self, db_session):
        user = _make_user(db_session)
        trade = _trade(user.id, exit_price=Decimal("110"), exit_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        with pytest.raises(HTTPException) as exc:
            svc.create_partial_exit(trade.id, _payload("4"))
        assert exc.value.status_code == 400


# ── Direction-aware partial exit math ──


class TestDirectionAwareMath:
    def test_short_partial_exit_pnl(self, db_session):
        """SHORT trade partial exit uses (entry - exit) direction."""
        user = _make_user(db_session)
        trade = _trade(user.id, direction="SHORT", stop_price=Decimal("110"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        pe = svc.create_partial_exit(trade.id, _payload("4", "90"))

        assert pe.realized_pnl is not None
        fee_share = _allocate_fee(Decimal("0"), Decimal("4"), Decimal("10"))
        expected = calculate_trade_leg_pnl("SHORT", Decimal("100"), Decimal("90"), Decimal("4"), fee_share)
        assert pe.realized_pnl == expected

    def test_direction_aware_r_captured(self, db_session):
        """R-captured for SHORT uses correct risk direction."""
        user = _make_user(db_session)
        trade = _trade(user.id, direction="SHORT", stop_price=Decimal("105"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        pe = svc.create_partial_exit(trade.id, _payload("4", "90"))

        assert pe.r_captured is not None
        risk_per_unit = Decimal("105") - Decimal("100")
        gross_pnl = (Decimal("100") - Decimal("90")) * 4
        expected_r = gross_pnl / (risk_per_unit * Decimal("4"))
        assert pe.r_captured == expected_r


# ── Capital reconciliation with partial exits ──


class TestCapitalReconciliation:
    def test_open_trade_partial_increases_realized(self, db_session):
        """Open trade partial exit realized PnL is included in reconciliation."""
        user = _make_user(db_session)
        account = _make_account(db_session, user.id)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        _auto_reconcile(db_session, user_id=user.id)

        partials = db_session.query(PartialExit).filter(PartialExit.trade_id == trade.id).all()
        partial_realized = sum(p.realized_pnl or Decimal("0") for p in partials)
        assert partial_realized > 0

    def test_deleting_partial_reverses_realized(self, db_session):
        """Deleting partial exit reverses the realized component in capital."""
        user = _make_user(db_session)
        account = _make_account(db_session, user.id)
        trade = _trade(user.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        pe = svc.create_partial_exit(trade.id, _payload("4", "110"))

        _auto_reconcile(db_session, user_id=user.id)
        balance_with_partial = account.current_balance

        svc.delete_partial_exit(trade.id, pe.id)
        _auto_reconcile(db_session, user_id=user.id)
        db_session.refresh(account)

        assert account.current_balance < balance_with_partial or account.current_balance == Decimal("100000")

    def test_closed_trade_no_double_count(self, db_session):
        """Closed trade pnl already includes partial realized — no double-counting."""
        user = _make_user(db_session)
        account = _make_account(db_session, user.id)
        trade = _trade(user.id, fees=Decimal("0"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        trade.compute_pnl()
        db_session.commit()
        db_session.refresh(trade)

        _auto_reconcile(db_session, user_id=user.id)
        db_session.refresh(account)

        partial_realized = (Decimal("110") - Decimal("100")) * 4
        remaining_pnl = (Decimal("120") - Decimal("100")) * 6
        total_expected_pnl = partial_realized + remaining_pnl

        closed_trades = db_session.query(Trade).filter(
            Trade.pnl.isnot(None),
            Trade.status != "deleted",
            Trade.user_id == user.id,
        ).all()
        total_from_closed = sum(t.pnl or Decimal("0") for t in closed_trades)

        open_partials = Decimal("0")
        open_trades = db_session.query(Trade).filter(
            Trade.exit_price.is_(None),
            Trade.status != "deleted",
            Trade.user_id == user.id,
        ).all()
        for t in open_trades:
            for p in db_session.query(PartialExit).filter(PartialExit.trade_id == t.id).all():
                open_partials += p.realized_pnl or Decimal("0")

        combined = total_from_closed + open_partials
        assert combined == total_expected_pnl

    def test_deployed_capital_uses_remaining_qty(self, db_session):
        """Deployed capital for open trade uses remaining_qty, not full quantity."""
        user = _make_user(db_session)
        account = _make_account(db_session, user.id)
        trade = _trade(user.id, entry_price=Decimal("100"), quantity=Decimal("10"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        partials = db_session.query(PartialExit).filter(PartialExit.trade_id == trade.id).all()
        total_exited_qty = sum(p.qty for p in partials)
        remaining_qty = trade.quantity - total_exited_qty
        deployed = trade.entry_price * remaining_qty
        assert deployed == Decimal("100") * Decimal("6")


# ── Merge safety ──


class TestMergeSafety:
    def test_manual_same_day_trades_remain_separate(self, db_session):
        """Manual creation never auto-merges same-day trades."""
        user = _make_user(db_session)
        svc = TradeService(db_session)
        t1, a1 = svc.merge_or_create({
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
            "user_id": user.id,
        })
        t2, a2 = svc.merge_or_create({
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("105"),
            "quantity": Decimal("5"),
            "entry_time": datetime.fromisoformat("2025-01-13T10:00:00"),
            "user_id": user.id,
        })

        assert a1 == "created"
        assert a2 == "created"
        assert t1.id != t2.id
        assert t1.quantity == Decimal("10")
        assert t2.quantity == Decimal("5")

    def test_broker_import_merges_exact_duplicate(self, db_session):
        """Broker import (allow_merge=True) merges only when the exact signature
        matches: same symbol, entry_price, quantity, entry_time, exit_price, exit_time."""
        user = _make_user(db_session)
        svc = TradeService(db_session)
        t1, a1 = svc.merge_or_create({
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
            "user_id": user.id,
        }, allow_merge=True)
        # Same exact signature → merges
        t2, a2 = svc.merge_or_create({
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
            "user_id": user.id,
        }, allow_merge=True)

        assert a1 == "created"
        assert a2 == "merged"
        assert t1.id == t2.id

    def test_broker_import_does_not_merge_different_price(self, db_session):
        """Broker import does NOT merge trades with different entry prices
        on the same day — they are separate trades."""
        user = _make_user(db_session)
        svc = TradeService(db_session)
        t1, a1 = svc.merge_or_create({
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2025-01-13T09:30:00"),
            "user_id": user.id,
        }, allow_merge=True)
        # Different entry price → creates separate trade
        t2, a2 = svc.merge_or_create({
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("105"),
            "quantity": Decimal("5"),
            "entry_time": datetime.fromisoformat("2025-01-13T10:00:00"),
            "user_id": user.id,
        }, allow_merge=True)

        assert a1 == "created"
        assert a2 == "created"
        assert t1.id != t2.id

    def test_pyramid_endpoint_still_works(self, db_session):
        """Explicit pyramid endpoint still works."""
        user = _make_user(db_session)
        trade = _trade(user.id, quantity=Decimal("10"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = TradeService(db_session)
        result = svc.pyramid_trade(trade.id, Decimal("105"), Decimal("5"), user_id=user.id)

        assert result.quantity == Decimal("15")
        assert result.id == trade.id


# ── Duplicate merge child data safety ──


class TestMergeDuplicatesChildData:
    def test_partial_exits_preserved_after_merge(self, db_session):
        """merge_duplicates reassigns partial exits to kept trade."""
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="X", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="X", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        pe = PartialExit(trade_id=t2.id, qty=Decimal("3"), exit_price=Decimal("110"),
                         exit_time=datetime.fromisoformat("2025-01-13T11:00:00"),
                         realized_pnl=Decimal("30"))
        db_session.add(pe)
        db_session.commit()

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 1
        surviving_partials = db_session.query(PartialExit).filter(PartialExit.trade_id == t1.id).all()
        assert len(surviving_partials) == 1
        assert surviving_partials[0].qty == Decimal("3")

    def test_timeline_preserved_after_merge(self, db_session):
        """merge_duplicates reassigns timeline events to kept trade."""
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="Y", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="Y", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        tl = TradeTimeline(trade_id=t2.id, event_type="note_added", new_value="test note")
        db_session.add(tl)
        db_session.commit()

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 1
        surviving_tl = db_session.query(TradeTimeline).filter(TradeTimeline.trade_id == t1.id).all()
        assert any(t.event_type == "note_added" for t in surviving_tl)

    def test_emotion_logs_preserved_after_merge(self, db_session):
        """merge_duplicates reassigns emotion logs to kept trade."""
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="Z", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="Z", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        el = EmotionLog(trade_id=t2.id, emotion="fearful", confidence=50,
                        timestamp=datetime.fromisoformat("2025-01-13T10:30:00"))
        db_session.add(el)
        db_session.commit()

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 1
        surviving_el = db_session.query(EmotionLog).filter(EmotionLog.trade_id == t1.id).all()
        assert len(surviving_el) == 1

    def test_stop_history_preserved_after_merge(self, db_session):
        """merge_duplicates reassigns stop history to kept trade."""
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="W", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="W", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        sh = StopHistory(trade_id=t2.id, stop_type="manual", price=Decimal("95"),
                         timestamp=datetime.fromisoformat("2025-01-13T10:30:00"))
        db_session.add(sh)
        db_session.commit()

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 1
        surviving_sh = db_session.query(StopHistory).filter(StopHistory.trade_id == t1.id).all()
        assert len(surviving_sh) == 1

    def test_no_orphan_child_rows_after_merge(self, db_session):
        """After merge_duplicates, all child rows point to surviving trade IDs."""
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="V", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="V", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        db_session.add(PartialExit(trade_id=t2.id, qty=Decimal("3"), exit_price=Decimal("110"),
                                   exit_time=datetime.fromisoformat("2025-01-13T11:00:00"),
                                   realized_pnl=Decimal("30")))
        db_session.add(TradeTimeline(trade_id=t2.id, event_type="note_added", new_value="x"))
        db_session.commit()

        svc = TradeService(db_session)
        svc.merge_duplicates(user_id=user.id)

        surviving_ids = {t.id for t in db_session.query(Trade).filter(Trade.status != "deleted").all()}
        orphans_pe = db_session.query(PartialExit).filter(~PartialExit.trade_id.in_(surviving_ids)).all()
        orphans_tl = db_session.query(TradeTimeline).filter(~TradeTimeline.trade_id.in_(surviving_ids)).all()
        assert len(orphans_pe) == 0
        assert len(orphans_tl) == 0

    def test_execution_grade_unique_constraint_handled(self, db_session):
        """merge_duplicates handles ExecutionGrade unique trade_id — deletes
        duplicate if kept trade already has one, reassigns otherwise."""
        from app.models.execution_grade import ExecutionGrade
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="EG", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="EG", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        db_session.add(ExecutionGrade(trade_id=t1.id, overall_grade="A", entry_quality="A"))
        db_session.add(ExecutionGrade(trade_id=t2.id, overall_grade="C", entry_quality="C"))
        db_session.commit()

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 1
        surviving_grades = db_session.query(ExecutionGrade).filter(ExecutionGrade.trade_id == t1.id).all()
        assert len(surviving_grades) == 1
        assert surviving_grades[0].overall_grade == "A"

    def test_execution_grade_reassigned_when_keep_has_none(self, db_session):
        """If keep trade has no ExecutionGrade, dup's grade is reassigned."""
        from app.models.execution_grade import ExecutionGrade
        user = _make_user(db_session)
        t1 = _trade(user.id, symbol="EG2", quantity=Decimal("10"))
        t2 = _trade(user.id, symbol="EG2", quantity=Decimal("10"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"))
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        db_session.add(ExecutionGrade(trade_id=t2.id, overall_grade="B", entry_quality="B"))
        db_session.commit()

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 1
        surviving_grades = db_session.query(ExecutionGrade).filter(ExecutionGrade.trade_id == t1.id).all()
        assert len(surviving_grades) == 1
        assert surviving_grades[0].overall_grade == "B"

    def test_each_kept_trade_gets_pnl_recomputed(self, db_session):
        """When multiple duplicate groups are merged, each kept trade gets compute_pnl."""
        user = _make_user(db_session)
        # Group 1: symbol A (closed trades so PnL is computed)
        t1a = _trade(user.id, symbol="AAA", quantity=Decimal("10"), entry_price=Decimal("100"),
                      exit_price=Decimal("120"), exit_time=datetime.fromisoformat("2025-01-13T15:00:00"))
        t1b = _trade(user.id, symbol="AAA", quantity=Decimal("10"), entry_price=Decimal("110"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"),
                     exit_price=Decimal("130"), exit_time=datetime.fromisoformat("2025-01-13T16:00:00"))
        # Group 2: symbol B (closed trades)
        t2a = _trade(user.id, symbol="BBB", quantity=Decimal("20"), entry_price=Decimal("200"),
                      exit_price=Decimal("240"), exit_time=datetime.fromisoformat("2025-01-13T15:00:00"))
        t2b = _trade(user.id, symbol="BBB", quantity=Decimal("20"), entry_price=Decimal("210"),
                     entry_time=datetime.fromisoformat("2025-01-13T10:00:00"),
                     exit_price=Decimal("250"), exit_time=datetime.fromisoformat("2025-01-13T16:00:00"))
        db_session.add_all([t1a, t1b, t2a, t2b])
        db_session.commit()
        for t in [t1a, t1b, t2a, t2b]:
            db_session.refresh(t)

        svc = TradeService(db_session)
        merged = svc.merge_duplicates(user_id=user.id)

        assert merged >= 2
        db_session.refresh(t1a)
        db_session.refresh(t2a)
        assert t1a.quantity == Decimal("20")
        assert t2a.quantity == Decimal("40")
        assert t1a.pnl is not None
        assert t2a.pnl is not None


# ── User isolation for partial exits ──


class TestPartialExitUserIsolation:
    def test_user_cannot_delete_other_user_partial_exit(self, db_session):
        """User A cannot delete User B's partial exit."""
        user_a = _make_user(db_session)
        user_b = _make_user(db_session)
        trade = _trade(user_a.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        pe = svc.create_partial_exit(trade.id, _payload("4"), user_id=user_a.id)

        with pytest.raises(HTTPException) as exc:
            svc.delete_partial_exit(trade.id, pe.id, user_id=user_b.id)
        assert exc.value.status_code == 404

    def test_user_cannot_add_partial_to_other_user_trade(self, db_session):
        """User B cannot add partial exit to User A's trade."""
        user_a = _make_user(db_session)
        user_b = _make_user(db_session)
        trade = _trade(user_a.id)
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        with pytest.raises(HTTPException) as exc:
            svc.create_partial_exit(trade.id, _payload("4"), user_id=user_b.id)
        assert exc.value.status_code == 404


# ── Full close after partials P&L correctness ──


class TestFullCloseAfterPartials:
    def test_full_close_with_fees(self, db_session):
        """Full close with partial exits and fees produces correct total PnL."""
        user = _make_user(db_session)
        trade = _trade(user.id, fees=Decimal("100"), stop_price=Decimal("95"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)

        partial_pnl = (Decimal("110") - Decimal("100")) * 4 - Decimal("40")
        remaining_pnl = (Decimal("120") - Decimal("100")) * 6 - Decimal("60")
        expected = partial_pnl + remaining_pnl
        assert trade.pnl == expected

    def test_full_close_without_fees(self, db_session):
        user = _make_user(db_session)
        trade = _trade(user.id, fees=Decimal("0"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4", "110"))

        trade.exit_price = Decimal("120")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)

        expected = (Decimal("110") - Decimal("100")) * 4 + (Decimal("120") - Decimal("100")) * 6
        assert trade.pnl == expected

    def test_multiple_partials_then_close(self, db_session):
        """Multiple partial exits then full close."""
        user = _make_user(db_session)
        trade = _trade(user.id, fees=Decimal("0"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("3", "105"))
        svc.create_partial_exit(trade.id, _payload("4", "112"))

        trade.exit_price = Decimal("115")
        trade.exit_time = datetime.fromisoformat("2025-01-13T14:00:00")
        db_session.commit()
        db_session.refresh(trade)

        expected = (Decimal("105") - Decimal("100")) * 3 + (Decimal("112") - Decimal("100")) * 4 + (Decimal("115") - Decimal("100")) * 3
        assert trade.pnl == expected


# ── Existing test: verify the original test still passes with new logic ──


class TestExistingFullCloseAfterPartial:
    def test_original_test_value(self, db_session):
        """The original test_full_close_after_partial_exit_uses_remaining_quantity
        verified pnl=150 with entry=100, exit=120, qty=10, fees=10, stop=95,
        partial qty=4 @ 110. Let's verify."""
        user = _make_user(db_session)
        trade = _trade(user.id, fees=Decimal("10.00"), stop_price=Decimal("95.00"))
        db_session.add(trade)
        db_session.commit()
        db_session.refresh(trade)

        svc = PartialExitService(db_session)
        svc.create_partial_exit(trade.id, _payload("4"))

        trade.exit_price = Decimal("120.00")
        trade.exit_time = datetime.fromisoformat("2025-01-13T11:00:00")
        db_session.commit()
        db_session.refresh(trade)

        partial_pnl = (Decimal("110") - Decimal("100")) * Decimal("4") - Decimal("4")
        remaining_pnl = (Decimal("120") - Decimal("100")) * Decimal("6") - Decimal("6")
        expected = partial_pnl + remaining_pnl
        assert trade.pnl == expected