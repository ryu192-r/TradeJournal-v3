"""
Analytics Router — Setup performance, streak tracking, and dashboard endpoints.

GET  /api/v1/analytics/kpi              — Top KPI cards
GET  /api/v1/analytics/setup-performance — Per-setup breakdown
GET  /api/v1/analytics/streaks           — Consecutive win/loss streaks
GET  /api/v1/analytics/r-distribution    — R-multiple histogram
GET  /api/v1/analytics/monthly-pnl       — Monthly summary
GET  /api/v1/analytics/daily-pnl         — Daily P&L for equity curve
GET  /api/v1/analytics/day-of-week       — Performance by weekday
GET  /api/v1/analytics/time-of-day       — Performance by entry hour
GET  /api/v1/analytics/holding-period    — Holding hours vs return
GET  /api/v1/analytics/dashboard         — All of the above in one call
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.services.analytics_service import (
    get_kpi_summary,
    get_setup_performance,
    get_streak_analysis,
    get_r_distribution,
    get_monthly_pnl,
    get_daily_pnl,
    get_day_of_week_performance,
    get_time_of_day_performance,
    get_holding_period_analysis,
    get_full_dashboard,
)
from app.schemas.analytics import (
    KpiSummaryResponse,
    SetupPerformanceItem,
    StreakAnalysisResponse,
    RDistributionResponse,
    MonthlyPnlEntry,
    DailyPnlEntry,
    DayOfWeekEntry,
    TimeOfDayEntry,
    HoldingPeriodEntry,
    FullDashboardResponse,
)

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/analytics", tags=["analytics"])

from app.models.user import User

# ─────────────────────── helpers ───────────────────────

def _parse_date_range(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> tuple[Optional[datetime], Optional[datetime]]:
    """Parse ISO date strings to datetime. If invalid, treat as None (no filter).
    from_date is start-of-day, to_date is end-of-day for inclusive filtering."""
    start = None
    end = None
    if from_date:
        try:
            start = datetime.fromisoformat(from_date)
        except ValueError:
            pass
    if to_date:
        try:
            end = datetime.fromisoformat(to_date)
            # Make end date inclusive: set to end of that day (23:59:59.999999)
            end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            pass
    return start, end


def _filters(
    from_date: Optional[str] = Query(None, description="Start date (ISO format, inclusive)"),
    to_date: Optional[str] = Query(None, description="End date (ISO format, inclusive)"),
) -> tuple[Optional[datetime], Optional[datetime]]:
    return _parse_date_range(from_date, to_date)


# ─────────────────────── endpoints ───────────────────────

@router.get("/kpi", response_model=KpiSummaryResponse)
def endpoint_kpi(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return top-level KPI metrics."""
    start, end = _parse_date_range(from_date, to_date)
    return get_kpi_summary(db, start, end, current_user.id)


@router.get("/setup-performance", response_model=list[SetupPerformanceItem])
def endpoint_setup_performance(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_setup_performance(db, start, end, current_user.id)


@router.get("/streaks", response_model=StreakAnalysisResponse)
def endpoint_streaks(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_streak_analysis(db, start, end, current_user.id)


@router.get("/r-distribution", response_model=RDistributionResponse)
def endpoint_r_distribution(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    bins: int = Query(10, ge=5, le=50, description="Number of histogram bins"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_r_distribution(db, start, end, user_id=current_user.id, bin_count=bins)


@router.get("/monthly-pnl", response_model=list[MonthlyPnlEntry])
def endpoint_monthly_pnl(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_monthly_pnl(db, start, end, current_user.id)


@router.get("/daily-pnl", response_model=list[DailyPnlEntry])
def endpoint_daily_pnl(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_daily_pnl(db, start, end, current_user.id)


@router.get("/day-of-week", response_model=list[DayOfWeekEntry])
def endpoint_day_of_week(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_day_of_week_performance(db, start, end, current_user.id)


@router.get("/time-of-day", response_model=list[TimeOfDayEntry])
def endpoint_time_of_day(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_time_of_day_performance(db, start, end, current_user.id)


@router.get("/holding-period", response_model=list[HoldingPeriodEntry])
def endpoint_holding_period(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _parse_date_range(from_date, to_date)
    return get_holding_period_analysis(db, start, end, current_user.id)


@router.get("/dashboard", response_model=FullDashboardResponse)
def endpoint_dashboard(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the full analytics dashboard payload."""
    start, end = _parse_date_range(from_date, to_date)
    return get_full_dashboard(db, start, end, current_user.id)
