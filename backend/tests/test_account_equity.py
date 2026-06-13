"""Tests for Account Equity module (equity_snapshot).

Covers:
- Fork 1: adjustment events excluded from net_equity
- Fork 2: deployed = entry × remaining_qty (no fee_share)
- Fork 3: unrealized PnL from LiveQuote
"""
from decimal import Decimal

import pytest

from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.live_quote import LiveQuote
from app.models.partial_exit import PartialExit
from app.models.trade import Trade
from app.models.user import User
from app.services.account_equity import equity_snapshot


@pytest.fixture
def seeded_user(db_session):
    """Create user + account + sample data for snapshot tests."""
    db = db_session
    user = User(email="eq@test.com", full_name="EQ", hashed_password="x")
    db.add(user)
    db.flush()

    account = Account(user_id=user.id, name="Main", initial_balance=Decimal("100000"))
    db.add(account)
    db.flush()

    # Capital events: deposit 50k, withdrawal 10k, fee 500, adjustment 999 (should be excluded)
    from datetime import datetime
    now = datetime(2026, 1, 1)
    for evt_type, amount in [("deposit", 50000), ("withdrawal", -10000), ("fee", -500), ("adjustment", 999)]:
        db.add(CapitalEvent(account_id=account.id, event_type=evt_type, amount=Decimal(str(amount)), timestamp=now))
    db.flush()

    # Closed trade: pnl = 5000
    closed = Trade(
        user_id=user.id, symbol="RELIANCE", direction="LONG",
        entry_price=Decimal("2500"), exit_price=Decimal("2600"),
        quantity=Decimal("50"), fees=Decimal("100"),
        pnl=Decimal("5000"), status="closed", entry_time=datetime(2026, 1, 10, 10),
    )
    db.add(closed)
    db.flush()

    # Open trade: entry=1000, qty=100, fees=200
    open_t = Trade(
        user_id=user.id, symbol="TCS", direction="LONG",
        entry_price=Decimal("1000"), quantity=Decimal("100"),
        fees=Decimal("200"), status="open", entry_time=datetime(2026, 2, 1, 10),
    )
    db.add(open_t)
    db.flush()

    # Partial exit on open trade: exited 30 qty, realized 900
    pe = PartialExit(
        trade_id=open_t.id, qty=Decimal("30"), exit_price=Decimal("1030"),
        exit_time=datetime(2026, 2, 5, 10), realized_pnl=Decimal("900"),
    )
    db.add(pe)
    db.flush()

    # LiveQuote for TCS: ltp=1050
    lq = LiveQuote(symbol="TCS", ltp=Decimal("1050"))
    db.add(lq)
    db.commit()

    return user


def test_fork1_adjustment_excluded(db_session, seeded_user):
    """Adjustment event must NOT affect net_equity (it would double-count)."""
    snap = equity_snapshot(db_session, seeded_user.id)
    # capital_flow = 50000 + (-10000) + (-500) = 39500 (adjustment excluded)
    assert snap.capital_flow == Decimal("39500")
    # realized = 5000 (closed) + 900 (partial) = 5900
    assert snap.realized_pnl == Decimal("5900")
    # net = 100000 + 39500 + 5900 = 145400
    assert snap.net_equity == Decimal("145400")


def test_fork2_deployed_no_fee(db_session, seeded_user):
    """Deployed = entry × remaining_qty, no fee subtraction."""
    snap = equity_snapshot(db_session, seeded_user.id)
    # Open trade: entry=1000, qty=100, exited=30 → remaining=70
    # deployed = 1000 * 70 = 70000 (NO fee_share deduction)
    assert snap.deployed_capital == Decimal("70000")
    assert snap.available_capital == snap.net_equity - snap.deployed_capital


def test_fork3_unrealized_from_live_quote(db_session, seeded_user):
    """Unrealized PnL computed from LiveQuote ltp."""
    snap = equity_snapshot(db_session, seeded_user.id)
    # TCS: ltp=1050, entry=1000, qty=100, remaining=70, fees=200
    # pnl_per_unit = 1050-1000 = 50; gross = 50*70 = 3500
    # fee_ratio = 70/100 = 0.7; fee_alloc = 200*0.7 = 140
    # unrealized = 3500 - 140 = 3360
    assert snap.unrealized_pnl == Decimal("3360")
    assert snap.total_equity == snap.net_equity + snap.unrealized_pnl


def test_no_account_returns_zeros(db_session):
    """User with no account gets a zero snapshot."""
    # Create a user with no account
    user = User(email="noac@test.com", full_name="NA", hashed_password="x")
    db_session.add(user)
    db_session.commit()
    snap = equity_snapshot(db_session, user.id)
    assert snap.net_equity == Decimal("0")
    assert snap.deployed_capital == Decimal("0")
