"""Tests for the Improvement Action suggestion engine (issue #70).

Direct service-layer tests: call generate_suggestions() against a seeded DB
and verify scanner behavior, thresholds, dedup, and approval-via-PUT flow.
"""

from datetime import date, timedelta, datetime
from decimal import Decimal
from itertools import count

from app.core.security import get_password_hash
from app.models.daily_journal import DailyJournal
from app.models.execution_grade import ExecutionGrade
from app.models.performance_os import ImprovementAction
from app.models.trade import Trade
from app.models.user import User
from app.routers.improvement_actions import (
    update_improvement_action,
    generate_improvement_suggestions,
)
from app.schemas.performance_os import ImprovementActionUpdate
from app.services.suggestion_engine import generate_suggestions

_email_counter = count(1)


def _make_user(db_session) -> User:
    user = User(
        email=f"sugg_{next(_email_counter)}@example.com",
        full_name="Suggestion Test User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _make_journal(db_session, user, *, day_offset: int, rules_violated: str) -> DailyJournal:
    j = DailyJournal(
        user_id=user.id,
        date=date.today() - timedelta(days=day_offset),
        rules_violated=rules_violated,
    )
    db_session.add(j)
    db_session.flush()
    return j


def _make_trade_with_grade(db_session, user, *, day_offset: int, **grade_fields) -> Trade:
    t = Trade(
        user_id=user.id,
        symbol="TEST",
        direction="LONG",
        entry_price=Decimal("100"),
        exit_price=Decimal("105"),
        quantity=Decimal("10"),
        entry_time=datetime.now() - timedelta(days=day_offset),
        exit_time=datetime.now() - timedelta(days=day_offset),
        fees=Decimal("0"),
        status="closed",
    )
    db_session.add(t)
    db_session.flush()
    g = ExecutionGrade(trade_id=t.id, **grade_fields)
    db_session.add(g)
    db_session.flush()
    return t


# ── Rule violation scanner ──────────────────────────────────────────────────

def test_rule_violation_below_threshold_no_suggestion(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    created = generate_suggestions(db_session, user.id)
    assert created == []


def test_rule_violation_at_threshold_creates_suggestion(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    created = generate_suggestions(db_session, user.id)
    assert len(created) == 1
    a = created[0]
    assert a.status == "suggested"
    assert a.contract_type == "no_early_entry"
    assert a.source_evidence["type"] == "rule_violation"
    assert a.source_evidence["kind"] == "early_entry"
    assert a.source_evidence["occurrences"] == 2
    assert len(a.source_evidence["evidence_refs"]) == 2


def test_rule_violation_dedup_does_not_recreate(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    first = generate_suggestions(db_session, user.id)
    assert len(first) == 1
    second = generate_suggestions(db_session, user.id)
    assert second == []  # already exists, skip


def test_retired_action_does_not_block_resuggestion(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    first = generate_suggestions(db_session, user.id)
    assert len(first) == 1
    # User retires the action
    first[0].status = "retired"
    db_session.commit()
    # Re-running should resuggest because retired entries are not blocking
    second = generate_suggestions(db_session, user.id)
    assert len(second) == 1


def test_rule_classification_maps_to_correct_contract(db_session):
    user = _make_user(db_session)
    # Two of each kind to cross threshold
    _make_journal(db_session, user, day_offset=1, rules_violated="moved stop against me")
    _make_journal(db_session, user, day_offset=2, rules_violated="widened stop")
    _make_journal(db_session, user, day_offset=3, rules_violated="revenge trade after loss")
    _make_journal(db_session, user, day_offset=4, rules_violated="revenge")
    created = generate_suggestions(db_session, user.id)
    contracts = {a.contract_type for a in created}
    assert "stop_not_widened" in contracts
    assert "cooldown_after_loss" in contracts


def test_window_excludes_old_journals(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=100, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=120, rules_violated="chased entry")
    created = generate_suggestions(db_session, user.id, window_days=30)
    assert created == []


# ── Execution grade scanner ─────────────────────────────────────────────────

def test_weak_grades_below_threshold_no_suggestion(db_session):
    user = _make_user(db_session)
    _make_trade_with_grade(db_session, user, day_offset=1, patience="D")
    _make_trade_with_grade(db_session, user, day_offset=2, patience="F")
    # Only 2 weak grades, threshold is 3
    created = generate_suggestions(db_session, user.id)
    assert all(c.source_evidence.get("kind") != "grade:patience" for c in created)


def test_weak_grades_at_threshold_creates_suggestion(db_session):
    user = _make_user(db_session)
    for i in range(3):
        _make_trade_with_grade(db_session, user, day_offset=i + 1, patience="D")
    created = generate_suggestions(db_session, user.id)
    patience_suggestions = [c for c in created if c.source_evidence["kind"] == "grade:patience"]
    assert len(patience_suggestions) == 1
    a = patience_suggestions[0]
    assert a.contract_type == "cooldown_after_loss"
    assert a.source_evidence["occurrences"] == 3
    assert len(a.source_evidence["evidence_refs"]) == 3


def test_strong_grades_ignored(db_session):
    user = _make_user(db_session)
    for i in range(5):
        _make_trade_with_grade(db_session, user, day_offset=i + 1, patience="A")
    created = generate_suggestions(db_session, user.id)
    assert created == []


def test_grade_dimensions_map_to_contracts(db_session):
    user = _make_user(db_session)
    for i in range(3):
        _make_trade_with_grade(db_session, user, day_offset=i + 1, stop_quality="F")
    for i in range(3):
        _make_trade_with_grade(db_session, user, day_offset=i + 10, rule_adherence="D")
    created = generate_suggestions(db_session, user.id)
    by_kind = {c.source_evidence["kind"]: c for c in created}
    assert by_kind["grade:stop_quality"].contract_type == "stop_not_widened"
    assert by_kind["grade:rule_adherence"].contract_type == "manual_check"


# ── User scoping ────────────────────────────────────────────────────────────

def test_only_scans_own_user_evidence(db_session):
    user_a = _make_user(db_session)
    user_b = _make_user(db_session)
    _make_journal(db_session, user_b, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user_b, day_offset=2, rules_violated="chased entry")
    created = generate_suggestions(db_session, user_a.id)
    assert created == []


# ── Approval / edit flow (uses existing PUT endpoint) ───────────────────────

def test_approve_suggestion_via_put_status_active(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    created = generate_suggestions(db_session, user.id)
    a = created[0]
    updated = update_improvement_action(
        a.id, ImprovementActionUpdate(status="active"), db_session, user
    )
    assert updated.status == "active"


def test_edit_suggestion_title_and_description(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    created = generate_suggestions(db_session, user.id)
    a = created[0]
    updated = update_improvement_action(
        a.id,
        ImprovementActionUpdate(title="Wait 1 candle", description="Custom"),
        db_session,
        user,
    )
    assert updated.title == "Wait 1 candle"
    assert updated.description == "Custom"
    # Status should still be suggested (edit alone doesn't approve)
    assert updated.status == "suggested"


def test_retire_suggestion(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    created = generate_suggestions(db_session, user.id)
    a = created[0]
    updated = update_improvement_action(
        a.id, ImprovementActionUpdate(status="retired"), db_session, user
    )
    assert updated.status == "retired"


# ── Endpoint smoke (router function) ────────────────────────────────────────

def test_generate_endpoint_returns_only_new(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    first = generate_improvement_suggestions(days=30, db=db_session, current_user=user)
    assert len(first) == 1
    second = generate_improvement_suggestions(days=30, db=db_session, current_user=user)
    assert second == []


def test_generate_endpoint_does_not_auto_activate(db_session):
    user = _make_user(db_session)
    _make_journal(db_session, user, day_offset=1, rules_violated="chased entry")
    _make_journal(db_session, user, day_offset=2, rules_violated="chased entry")
    out = generate_improvement_suggestions(days=30, db=db_session, current_user=user)
    assert all(a.status == "suggested" for a in out)
    # Verify nothing is daily-focus either
    actions = db_session.query(ImprovementAction).filter(ImprovementAction.user_id == user.id).all()
    assert all(not a.is_daily_focus for a in actions)
