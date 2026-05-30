"""Market Regime Intelligence Router.

GET /api/v1/market-regime              — full dashboard (current + performance + matrix)
GET /api/v1/market-regime/current      — currently active regime + reasoning
GET /api/v1/market-regime/performance  — per-regime profitability
GET /api/v1/market-regime/matrix       — setup × regime expectancy matrix

All endpoints require auth and are user-scoped. Read-only, no AI scoring.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.market_regime import (
    CurrentRegime,
    MarketRegimeDashboard,
    RegimePerformanceResponse,
    SetupRegimeMatrix,
)
from app.services.market_regime_service import (
    calculate_regime_performance,
    calculate_setup_regime_matrix,
    get_current_regime,
    get_market_regime_dashboard,
)

router = APIRouter(
    dependencies=[Depends(get_current_user)],
    prefix="/market-regime",
    tags=["market-regime"],
)


@router.get("", response_model=MarketRegimeDashboard)
def market_regime_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_market_regime_dashboard(db, current_user.id)


@router.get("/current", response_model=CurrentRegime)
def current_regime(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = get_current_regime(db, current_user.id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No market snapshot available to classify the current regime.",
        )
    return result


@router.get("/performance", response_model=RegimePerformanceResponse)
def regime_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return calculate_regime_performance(db, current_user.id)


@router.get("/matrix", response_model=SetupRegimeMatrix)
def regime_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return calculate_setup_regime_matrix(db, current_user.id)
