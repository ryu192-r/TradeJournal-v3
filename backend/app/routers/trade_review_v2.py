from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.trade_review_v2 import TradeReviewBatchResponse, TradeReviewV2Response
from app.services.trade_review_v2_service import (
    review_trade_v2,
    review_trades_batch_v2,
)

router = APIRouter(prefix="/trade-review-v2", tags=["trade-review-v2"])


@router.get("/batch", response_model=TradeReviewBatchResponse)
def get_trade_review_batch_v2(
    limit: int = Query(20, ge=1, le=100),
    only_closed: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch deterministic reviews for recent trades."""
    return review_trades_batch_v2(db, current_user.id, limit=limit, only_closed=only_closed)


@router.get("/{trade_id}", response_model=TradeReviewV2Response)
def get_trade_review_v2(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deterministic structured review for a single trade."""
    try:
        return review_trade_v2(db, current_user.id, trade_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
