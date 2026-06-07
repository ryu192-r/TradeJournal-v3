# DEPRECATED — Phase 2 (2026-06-07). Router unregistered from base.py.
# Data folded into /edge-command-center. File retained for deferred deletion.
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.recommendations import (
    RecommendationDashboardResponse,
    RecommendationSummary,
)
from app.services.recommendation_service import (
    get_recommendation_dashboard,
    get_recommendation_summary,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/dashboard", response_model=RecommendationDashboardResponse)
def recommendation_dashboard(
    period_start: Optional[str] = Query(None, description="Start date ISO"),
    period_end: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full recommendation dashboard with all actionable intelligence."""
    return get_recommendation_dashboard(db, current_user.id, period_start, period_end)


@router.get("/summary", response_model=RecommendationSummary)
def recommendation_summary(
    period_start: Optional[str] = Query(None, description="Start date ISO"),
    period_end: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compact recommendation summary for dashboard/overview."""
    return get_recommendation_summary(db, current_user.id, period_start, period_end)
