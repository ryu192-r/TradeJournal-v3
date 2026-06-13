"""Improvement Actions API — the core unit of the Trading Improvement Loop.

Manual create/edit/list/select-focus for Improvement Actions and the one
Daily Focus Action per trading date (ADR-025). Served under `/improvement`
(the legacy `/perf-os` surface is deprecated in V3). No suggestion or
verification engine here; this is the manual-first vertical slice.
"""

from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.performance_os import ImprovementAction
from app.models.user import User
from app.schemas.performance_os import (
    ImprovementActionCreate,
    ImprovementActionUpdate,
    ImprovementActionResponse,
    DailyFocusResponse,
    SelectFocusRequest,
)
from app.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(
    dependencies=[Depends(get_current_user)],
    prefix="/improvement",
    tags=["improvement-actions"],
)

# Statuses considered "open" for the Improvement Backlog.
BACKLOG_STATUSES = ("suggested", "active")


def _get_owned_action(db: Session, action_id: int, user_id: int) -> ImprovementAction:
    action = db.query(ImprovementAction).filter(
        ImprovementAction.id == action_id,
        ImprovementAction.user_id == user_id,
    ).first()
    if action is None:
        raise HTTPException(404, "Improvement action not found")
    return action


# ────────────────────────── CRUD ──────────────────────────

@router.get("/actions", response_model=list[ImprovementActionResponse])
def list_improvement_actions(
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ImprovementAction).filter(ImprovementAction.user_id == current_user.id)
    if status:
        query = query.filter(ImprovementAction.status == status)
    actions = query.order_by(ImprovementAction.created_at.desc()).all()
    return [ImprovementActionResponse.model_validate(a) for a in actions]


@router.post("/actions", response_model=ImprovementActionResponse, status_code=201)
def create_improvement_action(
    payload: ImprovementActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action = ImprovementAction(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        due_session=payload.due_session,
        contract_type=payload.contract_type,
        contract_params=payload.contract_params,
        source_evidence=payload.source_evidence,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return ImprovementActionResponse.model_validate(action)


@router.get("/actions/{action_id}", response_model=ImprovementActionResponse)
def get_improvement_action(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action = _get_owned_action(db, action_id, current_user.id)
    return ImprovementActionResponse.model_validate(action)


@router.put("/actions/{action_id}", response_model=ImprovementActionResponse)
def update_improvement_action(
    action_id: int,
    payload: ImprovementActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action = _get_owned_action(db, action_id, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(action, key, value)
    db.commit()
    db.refresh(action)
    return ImprovementActionResponse.model_validate(action)


@router.delete("/actions/{action_id}", status_code=204)
def delete_improvement_action(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action = _get_owned_action(db, action_id, current_user.id)
    db.delete(action)
    db.commit()


# ────────────────────────── Daily Focus Action ──────────────────────────

@router.post("/actions/{action_id}/select-focus", response_model=ImprovementActionResponse)
def select_daily_focus(
    action_id: int,
    payload: SelectFocusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set this action as the single Daily Focus Action for a trading date.

    Resolves the one-focus-per-day rule by clearing the focus flag from any
    other action already focused on that date for this user.
    """
    action = _get_owned_action(db, action_id, current_user.id)

    # Clear any existing focus action(s) for the same date (one-focus-per-day).
    existing = db.query(ImprovementAction).filter(
        ImprovementAction.user_id == current_user.id,
        ImprovementAction.is_daily_focus.is_(True),
        ImprovementAction.due_session == payload.date,
        ImprovementAction.id != action.id,
    ).all()
    for other in existing:
        other.is_daily_focus = False

    action.due_session = payload.date
    action.is_daily_focus = True
    # Selecting a focus commits to the behavior — promote a suggestion to active.
    if action.status == "suggested":
        action.status = "active"

    db.commit()
    db.refresh(action)
    return ImprovementActionResponse.model_validate(action)


@router.post("/actions/{action_id}/clear-focus", response_model=ImprovementActionResponse)
def clear_daily_focus(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove this action as the Daily Focus Action (returns it to the backlog)."""
    action = _get_owned_action(db, action_id, current_user.id)
    action.is_daily_focus = False
    db.commit()
    db.refresh(action)
    return ImprovementActionResponse.model_validate(action)


@router.get("/daily-focus/{d}", response_model=DailyFocusResponse)
def get_daily_focus(
    d: date_type,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the Daily Focus Action and Improvement Backlog for a trading date."""
    focus = db.query(ImprovementAction).filter(
        ImprovementAction.user_id == current_user.id,
        ImprovementAction.is_daily_focus.is_(True),
        ImprovementAction.due_session == d,
    ).first()

    backlog_query = db.query(ImprovementAction).filter(
        ImprovementAction.user_id == current_user.id,
        ImprovementAction.status.in_(BACKLOG_STATUSES),
    )
    if focus is not None:
        backlog_query = backlog_query.filter(ImprovementAction.id != focus.id)
    backlog = backlog_query.order_by(ImprovementAction.created_at.desc()).all()

    return DailyFocusResponse(
        date=d,
        focus=ImprovementActionResponse.model_validate(focus) if focus else None,
        backlog=[ImprovementActionResponse.model_validate(a) for a in backlog],
    )
