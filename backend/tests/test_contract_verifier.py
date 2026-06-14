"""Tests for the Behavior Contract verification engine (issue #71).

Each contract type has kept-case + broken-case + missing-param fallback.
Plus override flow (PUT status) and verify endpoint smoke.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from itertools import count

import pytest

from app.core.security import get_password_hash
from app.models.performance_os import ImprovementAction
from app.models.stop_history import StopHistory
from app.models.trade import Trade
from app.models.user import User
from app.routers.improvement_actions import (
    update_improvement_action,
    verify_improvement_action,
)
from app.schemas.performance_os import ImprovementActionUpdate
from app.services.contract_verifier import (
    RESULT_BROKEN,
    RESULT_KEPT,
    RESULT_MANUAL,
    verify_contract,
)

_email_counter = count(1)
SESSION = date(2026, 6, 10)


def _make_user(db_session) -> User:
    user = User(
        email=f"cv_{next(_email_counter)}@example.com",
        full_name="CV Test",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _make_action(db_session, user, contract_type, contract_params=None) -> ImprovementAction:
    a = ImprovementAction(
        user_id=user.id,
        title="Test contract",
        status="active",
        due_session=SESSION,
        contract_type=contract_type,
        contract_params=contract_params or {},
        source_evidence={},
        is_daily_focus=True,
    )
    db_session.add(a)
    db_session.flush()
    return a


def _make_trade(
    db_session,
    user,
    *,
    entry_clock="10:00",
    exit_clock=None,
    pnl=None,
    entry_price=100,
    quantity=10,
    session=SESSION,
) -> Trade:
    h, m = map(int, entry_clock.split(":"))
    entry_dt = datetime.combine(session, time(h, m))
    exit_dt = None
    exit_price = None
    if exit_clock:
        eh, em = map(int, exit_clock.split(":"))
        exit_dt = datetime.combine(session, time(eh, em))
        exit_price = entry_price + (Decimal(str(pnl)) / Decimal(str(quantity)) if pnl else 0)

    t = Trade(
        user_id=user.id,
        symbol="TEST",
        direction="LONG",
        entry_price=Decimal(str(entry_price)),
        exit_price=Decimal(str(exit_price)) if exit_price is not None else None,
        quantity=Decimal(str(quantity)),
        entry_time=entry_dt,
        exit_time=exit_dt,
        fees=Decimal("0"),
        status="closed" if exit_dt else "open",
        pnl=Decimal(str(pnl)) if pnl is not None else None,
    )
    db_session.add(t)
    db_session.flush()
    return t


# ── no_early_entry ─────────────────────────────────────────────────────────

def test_no_early_entry_kept_when_all_after_cutoff(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "no_early_entry", {"not_before": "09:30"})
    _make_trade(db_session, user, entry_clock="09:35")
    _make_trade(db_session, user, entry_clock="10:00")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT
    assert r.evidence["checks_performed"] == 2


def test_no_early_entry_broken_when_one_before_cutoff(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "no_early_entry", {"not_before": "09:30"})
    _make_trade(db_session, user, entry_clock="09:25")
    _make_trade(db_session, user, entry_clock="09:35")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_BROKEN
    assert len(r.evidence["violations"]) == 1
    assert r.evidence["violations"][0]["entry_clock"] == "09:25"


def test_no_early_entry_exception_allows_softer_window(db_session):
    user = _make_user(db_session)
    action = _make_action(
        db_session, user, "no_early_entry",
        {"not_before": "09:30", "exceptions": [{"reason": "gap_open", "after": "09:20"}]},
    )
    _make_trade(db_session, user, entry_clock="09:22")  # within exception
    _make_trade(db_session, user, entry_clock="09:15")  # before exception → violation
    r = verify_contract(db_session, action)
    assert r.result == RESULT_BROKEN
    assert len(r.evidence["violations"]) == 1


def test_no_early_entry_manual_when_param_missing(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "no_early_entry", {})
    r = verify_contract(db_session, action)
    assert r.result == RESULT_MANUAL
    assert r.requires_confirmation is True


# ── max_trades ────────────────────────────────────────────────────────────

def test_max_trades_kept_under_cap(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {"max": 3})
    _make_trade(db_session, user, entry_clock="09:30")
    _make_trade(db_session, user, entry_clock="10:00")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT
    assert r.evidence["count"] == 2
    assert r.evidence["max"] == 3


def test_max_trades_broken_over_cap(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {"max": 2})
    _make_trade(db_session, user, entry_clock="09:30")
    _make_trade(db_session, user, entry_clock="10:00")
    _make_trade(db_session, user, entry_clock="11:00")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_BROKEN
    assert r.evidence["count"] == 3


def test_max_trades_at_cap_is_kept(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {"max": 2})
    _make_trade(db_session, user, entry_clock="09:30")
    _make_trade(db_session, user, entry_clock="10:00")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT


def test_max_trades_manual_when_missing_param(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {})
    r = verify_contract(db_session, action)
    assert r.result == RESULT_MANUAL


# ── cooldown_after_loss ────────────────────────────────────────────────────

def test_cooldown_kept_when_no_loss(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "cooldown_after_loss", {"minutes": 30})
    _make_trade(db_session, user, entry_clock="09:30", exit_clock="10:00", pnl=100)
    _make_trade(db_session, user, entry_clock="10:05")  # entry within 5min of win — fine
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT


def test_cooldown_broken_when_entry_within_window_after_loss(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "cooldown_after_loss", {"minutes": 30})
    _make_trade(db_session, user, entry_clock="09:30", exit_clock="10:00", pnl=-100)
    _make_trade(db_session, user, entry_clock="10:15")  # 15min after loss, < 30
    r = verify_contract(db_session, action)
    assert r.result == RESULT_BROKEN
    assert len(r.evidence["violations"]) == 1
    assert r.evidence["violations"][0]["gap_minutes"] == 15


def test_cooldown_kept_when_entry_after_window(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "cooldown_after_loss", {"minutes": 30})
    _make_trade(db_session, user, entry_clock="09:30", exit_clock="10:00", pnl=-100)
    _make_trade(db_session, user, entry_clock="10:35")  # 35min after loss
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT


def test_cooldown_manual_when_missing_param(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "cooldown_after_loss", {})
    r = verify_contract(db_session, action)
    assert r.result == RESULT_MANUAL


# ── stop_not_widened ──────────────────────────────────────────────────────

def test_stop_not_widened_kept_when_no_history(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "stop_not_widened")
    _make_trade(db_session, user, entry_clock="09:30")  # no stop history
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT
    assert r.evidence["checks_performed"] == 0


def test_stop_not_widened_kept_when_only_tightened(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "stop_not_widened")
    t = _make_trade(db_session, user, entry_clock="09:30", entry_price=100)
    db_session.add(StopHistory(
        trade_id=t.id, stop_type="initial", price=Decimal("95"),
        timestamp=datetime.combine(SESSION, time(9, 30)),
    ))
    db_session.add(StopHistory(
        trade_id=t.id, stop_type="trailing", price=Decimal("97"),
        timestamp=datetime.combine(SESSION, time(10, 0)),
    ))
    db_session.flush()
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT


def test_stop_not_widened_broken_when_widened(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "stop_not_widened")
    t = _make_trade(db_session, user, entry_clock="09:30", entry_price=100)
    db_session.add(StopHistory(
        trade_id=t.id, stop_type="initial", price=Decimal("95"),
        timestamp=datetime.combine(SESSION, time(9, 30)),
    ))
    # User moved stop from 95 → 90 (farther from entry 100, wider risk)
    db_session.add(StopHistory(
        trade_id=t.id, stop_type="manual", price=Decimal("90"),
        timestamp=datetime.combine(SESSION, time(10, 0)),
    ))
    db_session.flush()
    r = verify_contract(db_session, action)
    assert r.result == RESULT_BROKEN
    assert len(r.evidence["violations"]) == 1
    assert Decimal(r.evidence["violations"][0]["widened_stop"]) == Decimal("90")


# ── manual_check ───────────────────────────────────────────────────────────

def test_manual_check_always_returns_manual(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "manual_check")
    _make_trade(db_session, user, entry_clock="09:30")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_MANUAL
    assert r.requires_confirmation is True


# ── Edge cases + override flow ─────────────────────────────────────────────

def test_verify_uses_override_session(db_session):
    """Verify against a non-due session date when caller passes session=."""
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {"max": 2})
    other_day = SESSION + timedelta(days=1)
    _make_trade(db_session, user, entry_clock="09:30", session=other_day)
    _make_trade(db_session, user, entry_clock="10:00", session=other_day)
    _make_trade(db_session, user, entry_clock="11:00", session=other_day)
    r = verify_contract(db_session, action, session=other_day)
    assert r.result == RESULT_BROKEN


def test_verify_manual_when_no_due_session(db_session):
    user = _make_user(db_session)
    a = ImprovementAction(
        user_id=user.id, title="x", status="active", due_session=None,
        contract_type="max_trades", contract_params={"max": 2}, source_evidence={},
    )
    db_session.add(a)
    db_session.flush()
    r = verify_contract(db_session, a)
    assert r.result == RESULT_MANUAL


def test_verify_only_judges_owner_user_trades(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    action = _make_action(db_session, user_a, "max_trades", {"max": 1})
    _make_trade(db_session, user_a, entry_clock="09:30")
    _make_trade(db_session, user_b, entry_clock="10:00")  # other user — should not count
    r = verify_contract(db_session, action)
    assert r.result == RESULT_KEPT
    assert r.evidence["count"] == 1


def test_override_via_put_status(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {"max": 1})
    _make_trade(db_session, user, entry_clock="09:30")
    _make_trade(db_session, user, entry_clock="10:00")
    r = verify_contract(db_session, action)
    assert r.result == RESULT_BROKEN
    # User overrides to kept anyway
    updated = update_improvement_action(
        action.id, ImprovementActionUpdate(status="kept"), db_session, user
    )
    assert updated.status == "kept"


# ── Endpoint smoke ─────────────────────────────────────────────────────────

def test_verify_endpoint_returns_preselected_response(db_session):
    user = _make_user(db_session)
    action = _make_action(db_session, user, "max_trades", {"max": 1})
    _make_trade(db_session, user, entry_clock="09:30")
    _make_trade(db_session, user, entry_clock="10:00")
    resp = verify_improvement_action(action.id, session=None, db=db_session, current_user=user)
    assert resp.action_id == action.id
    assert resp.contract_type == "max_trades"
    assert resp.result == RESULT_BROKEN
    assert resp.evidence["count"] == 2


def test_verify_endpoint_404_for_other_user(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    action = _make_action(db_session, user_a, "manual_check")
    with pytest.raises(Exception):
        verify_improvement_action(action.id, session=None, db=db_session, current_user=user_b)
