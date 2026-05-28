"""Chart data API router."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user, get_user_trade_or_404
from app.models.user import User
from app.schemas.chart import ChartDataResponse
from app.services.chart_data_service import (
    get_chart_data_for_trade,
    validate_timeframe,
    validate_range,
    validate_source,
)
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/trades/{trade_id}/chart-data", response_model=ChartDataResponse)
def get_trade_chart_data(
    trade_id: int,
    timeframe: str = Query("5m", description="Candle timeframe: 1m, 3m, 5m, 15m, 30m, 1h, 1d"),
    range: str = Query("auto", description="Chart range: auto, 1d, 5d, 1mo, 3mo, 6mo, 1y"),
    source: str = Query("auto", description="Data source: auto, cache, dhan, mock"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = get_user_trade_or_404(db, trade_id, current_user.id)

    try:
        validate_timeframe(timeframe)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        validate_range(range)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        validate_source(source)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return get_chart_data_for_trade(db, trade, timeframe, range, source)