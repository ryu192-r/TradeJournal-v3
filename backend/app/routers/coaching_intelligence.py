# DEPRECATED — Phase 2 (2026-06-07). Router unregistered from base.py.
# Data folded into /edge-command-center. File retained for deferred deletion.
"""Coaching Intelligence Router — deterministic adaptive coaching endpoints."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.coaching_intelligence import (
    CoachingIntelligenceDashboard,
    WeeklyCoachingPlan,
    SetupConfidenceScore,
    BehavioralDriftSignal,
    TradeReviewPrompt,
)
from app.services.coaching_intelligence_service import (
    get_coaching_intelligence_dashboard,
    get_weekly_coaching_plan,
    get_setup_confidence_scores,
    get_behavioral_drift_signals,
    get_trade_review_prompts,
)

router = APIRouter(
    prefix="/coaching-intelligence",
    tags=["coaching-intelligence"],
)


def _parse_iso_date(value: str, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}: '{value}'. Use ISO format (e.g. 2025-01-01).",
        ) from exc


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}: '{value}'. Use ISO format (e.g. 2025-01-01T09:15:00).",
        ) from exc


@router.get("/dashboard", response_model=CoachingIntelligenceDashboard)
def coaching_intelligence_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full coaching intelligence dashboard with weekly plan, scores, drift, and prompts.

    behavioral_drift uses rolling UTC windows (see GET /behavioral-drift), not setup date filters.
    """
    return get_coaching_intelligence_dashboard(db, current_user.id)


@router.get("/weekly-plan", response_model=WeeklyCoachingPlan)
def weekly_coaching_plan(
    week_start: Optional[str] = Query(None, description="Week start date (YYYY-MM-DD). Defaults to current week."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deterministic weekly coaching plan with priorities, rules, and size adjustments.

    Week-specific: headline, review prompts, recommendation cross-check (plan_start–plan_end).
    setup_scores: last 90 days of closed trades (all-time if none in window), not this week only.
    """
    ws = None
    if week_start:
        ws = _parse_iso_date(week_start, "week_start")
    return get_weekly_coaching_plan(db, current_user.id, ws)


@router.get("/setup-scores", response_model=list[SetupConfidenceScore])
def setup_confidence_scores(
    period_start: Optional[str] = Query(None, description="Start date ISO"),
    period_end: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Setup confidence scores with sample-size-aware labels."""
    start = None
    end = None
    if period_start:
        start = _parse_iso_datetime(period_start, "period_start")
    if period_end:
        end = _parse_iso_datetime(period_end, "period_end")
    return get_setup_confidence_scores(db, current_user.id, start, end)


@router.get("/behavioral-drift", response_model=list[BehavioralDriftSignal])
def behavioral_drift(
    lookback_days: int = Query(
        30,
        ge=7,
        le=365,
        description=(
            "Recent comparison window length in days. Window ends at server UTC now "
            "(not period_start/period_end from setup-scores)."
        ),
    ),
    baseline_days: int = Query(
        90,
        ge=14,
        le=730,
        description=(
            "Baseline window length in days immediately before the recent window. "
            "Also anchored at server UTC now."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detect current behavioral drift vs your prior baseline (rolling UTC windows).

    Recent trades: entry_time in [utc_now - lookback_days, utc_now].
    Baseline trades: entry_time in [utc_now - lookback_days - baseline_days, utc_now - lookback_days).
    Does not use setup-scores period filters or weekly-plan week_start.
    """
    return get_behavioral_drift_signals(db, current_user.id, lookback_days, baseline_days)


@router.get("/trade-review-prompts", response_model=list[TradeReviewPrompt])
def trade_review_prompts(
    limit: int = Query(5, ge=1, le=20, description="Number of prompts to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Prioritized trade review prompts based on loss size, emotion, grades, and risk violations."""
    return get_trade_review_prompts(db, current_user.id, limit)
