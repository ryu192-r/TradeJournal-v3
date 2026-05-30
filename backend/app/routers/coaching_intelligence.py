"""Coaching Intelligence Router — deterministic adaptive coaching endpoints."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
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


@router.get("/dashboard", response_model=CoachingIntelligenceDashboard)
def coaching_intelligence_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full coaching intelligence dashboard with weekly plan, scores, drift, and prompts."""
    return get_coaching_intelligence_dashboard(db, current_user.id)


@router.get("/weekly-plan", response_model=WeeklyCoachingPlan)
def weekly_coaching_plan(
    week_start: Optional[str] = Query(None, description="Week start date (YYYY-MM-DD). Defaults to current week."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deterministic weekly coaching plan with priorities, rules, and size adjustments."""
    ws = None
    if week_start:
        try:
            ws = date.fromisoformat(week_start)
        except ValueError:
            pass
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
        try:
            from datetime import datetime
            start = datetime.fromisoformat(period_start)
        except ValueError:
            pass
    if period_end:
        try:
            from datetime import datetime
            end = datetime.fromisoformat(period_end)
        except ValueError:
            pass
    return get_setup_confidence_scores(db, current_user.id, start, end)


@router.get("/behavioral-drift", response_model=list[BehavioralDriftSignal])
def behavioral_drift(
    lookback_days: int = Query(30, ge=7, le=365, description="Recent window in days"),
    baseline_days: int = Query(90, ge=14, le=730, description="Baseline window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detect behavioral drift: frequency, avg R, win rate, loss size, emotion, grades."""
    return get_behavioral_drift_signals(db, current_user.id, lookback_days, baseline_days)


@router.get("/trade-review-prompts", response_model=list[TradeReviewPrompt])
def trade_review_prompts(
    limit: int = Query(5, ge=1, le=20, description="Number of prompts to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Prioritized trade review prompts based on loss size, emotion, grades, and risk violations."""
    return get_trade_review_prompts(db, current_user.id, limit)
