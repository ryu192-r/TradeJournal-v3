"""Improvement Actions / Daily Focus Action regressions (ADR-025, issue #68)."""

from datetime import date
from itertools import count

import pytest
from fastapi import HTTPException

from app.core.security import get_password_hash
from app.models.user import User
from app.routers.improvement_actions import (
    list_improvement_actions,
    create_improvement_action,
    get_improvement_action,
    update_improvement_action,
    delete_improvement_action,
    select_daily_focus,
    clear_daily_focus,
    get_daily_focus,
)
from app.schemas.performance_os import (
    ImprovementActionCreate,
    ImprovementActionUpdate,
    SelectFocusRequest,
)

_email_counter = count(1)


def _make_user(db_session) -> User:
    user = User(
        email=f"ia_{next(_email_counter)}@example.com",
        full_name="IA Test User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _create(db_session, user, **kwargs):
    payload = ImprovementActionCreate(
        title=kwargs.pop("title", "Wait for confirmation candle"),
        **kwargs,
    )
    return create_improvement_action(payload, db_session, current_user=user)


def test_create_defaults_to_suggested_manual_check(db_session):
    user = _make_user(db_session)
    action = _create(db_session, user, description="Avoid impulse entries")

    assert action.id is not None
    assert action.status == "suggested"
    assert action.contract_type == "manual_check"
    assert action.is_daily_focus is False
    assert action.due_session is None


def test_create_with_contract_and_evidence(db_session):
    user = _make_user(db_session)
    action = _create(
        db_session, user,
        title="No more than 3 trades",
        contract_type="max_trades",
        contract_params={"max": 3},
        source_evidence={"journal_dates": ["2025-01-13"]},
    )
    assert action.contract_type == "max_trades"
    assert action.contract_params == {"max": 3}
    assert action.source_evidence == {"journal_dates": ["2025-01-13"]}


def test_list_and_status_filter(db_session):
    user = _make_user(db_session)
    _create(db_session, user, title="A")
    b = _create(db_session, user, title="B", status="active")

    all_actions = list_improvement_actions(None, db_session, current_user=user)
    assert len(all_actions) == 2

    active = list_improvement_actions("active", db_session, current_user=user)
    assert [a.id for a in active] == [b.id]


def test_update_fields(db_session):
    user = _make_user(db_session)
    action = _create(db_session, user)

    updated = update_improvement_action(
        action.id,
        ImprovementActionUpdate(title="Updated", status="kept"),
        db_session,
        current_user=user,
    )
    assert updated.title == "Updated"
    assert updated.status == "kept"


def test_delete(db_session):
    user = _make_user(db_session)
    action = _create(db_session, user)

    delete_improvement_action(action.id, db_session, current_user=user)

    with pytest.raises(HTTPException) as exc:
        get_improvement_action(action.id, db_session, current_user=user)
    assert exc.value.status_code == 404


def test_select_focus_promotes_and_sets_date(db_session):
    user = _make_user(db_session)
    action = _create(db_session, user)
    target = date(2025, 1, 13)

    focused = select_daily_focus(
        action.id, SelectFocusRequest(date=target), db_session, current_user=user
    )
    assert focused.is_daily_focus is True
    assert focused.due_session == target
    assert focused.status == "active"  # suggested -> active on commit


def test_one_focus_per_day_resolves_previous(db_session):
    user = _make_user(db_session)
    first = _create(db_session, user, title="First")
    second = _create(db_session, user, title="Second")
    target = date(2025, 1, 13)

    select_daily_focus(first.id, SelectFocusRequest(date=target), db_session, current_user=user)
    select_daily_focus(second.id, SelectFocusRequest(date=target), db_session, current_user=user)

    result = get_daily_focus(target, db_session, current_user=user)
    assert result.focus is not None
    assert result.focus.id == second.id
    # First was demoted out of focus but stays in the backlog.
    backlog_ids = {a.id for a in result.backlog}
    assert first.id in backlog_ids


def test_daily_focus_separates_focus_and_backlog(db_session):
    user = _make_user(db_session)
    focus = _create(db_session, user, title="Focus")
    _create(db_session, user, title="Backlog 1")
    _create(db_session, user, title="Backlog 2")
    target = date(2025, 1, 13)

    select_daily_focus(focus.id, SelectFocusRequest(date=target), db_session, current_user=user)

    result = get_daily_focus(target, db_session, current_user=user)
    assert result.focus.id == focus.id
    assert len(result.backlog) == 2
    assert focus.id not in {a.id for a in result.backlog}


def test_clear_focus_returns_to_backlog(db_session):
    user = _make_user(db_session)
    action = _create(db_session, user)
    target = date(2025, 1, 13)

    select_daily_focus(action.id, SelectFocusRequest(date=target), db_session, current_user=user)
    cleared = clear_daily_focus(action.id, db_session, current_user=user)
    assert cleared.is_daily_focus is False

    result = get_daily_focus(target, db_session, current_user=user)
    assert result.focus is None
    assert action.id in {a.id for a in result.backlog}


def test_actions_are_user_scoped(db_session):
    owner = _make_user(db_session)
    intruder = _make_user(db_session)
    action = _create(db_session, owner)

    with pytest.raises(HTTPException) as exc:
        get_improvement_action(action.id, db_session, current_user=intruder)
    assert exc.value.status_code == 404

    assert list_improvement_actions(None, db_session, current_user=intruder) == []
