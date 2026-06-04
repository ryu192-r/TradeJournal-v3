from decimal import Decimal
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.schemas.partial_exit import PartialExitCreate, PartialExitResponse, PartialExitListResponse
from app.schemas.trade import TradeResponse
from app.db.database import get_db
from app.services.partial_exit_service import PartialExitService
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.routers.trades import _enrich_response

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades/{trade_id}/partial-exits", tags=["partial-exits"])


class PartialExitUpdate(BaseModel):
    qty: Optional[Decimal] = Field(None, gt=0)
    exit_price: Optional[Decimal] = Field(None, gt=0)
    exit_time: Optional[datetime] = None
    exit_reason: Optional[str] = None
    note: Optional[str] = None


@router.get("", response_model=PartialExitListResponse)
def list_partial_exits(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = PartialExitService(db)
    exits, remaining = svc.list_partial_exits(trade_id, user_id=current_user.id)
    return {"items": exits, "remaining_qty": str(remaining)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_partial_exit(
    trade_id: int,
    payload: PartialExitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = PartialExitService(db)
    entry = svc.create_partial_exit(trade_id, payload, user_id=current_user.id)
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    return {
        "partial_exit": PartialExitResponse.model_validate(entry),
        "trade": _enrich_response(trade, db) if trade else None,
    }


@router.put("/{exit_id}", response_model=PartialExitResponse)
def update_partial_exit(
    trade_id: int,
    exit_id: int,
    payload: PartialExitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.query(Trade).filter(Trade.id == trade_id, Trade.user_id == current_user.id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    entry = db.query(PartialExit).filter(PartialExit.id == exit_id, PartialExit.trade_id == trade_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partial exit not found")

    if payload.qty is not None:
        entry.qty = payload.qty
    if payload.exit_price is not None:
        entry.exit_price = payload.exit_price
    if payload.exit_time is not None:
        entry.exit_time = payload.exit_time
    if payload.exit_reason is not None:
        entry.exit_reason = payload.exit_reason
    if payload.note is not None:
        entry.note = payload.note

    # Recalculate realized PnL
    from app.utils.decimal_utils import ensure_decimal
    entry.realized_pnl = (ensure_decimal(entry.exit_price) - ensure_decimal(trade.entry_price)) * ensure_decimal(entry.qty)

    trade.compute_pnl()
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{exit_id}", status_code=status.HTTP_200_OK)
def delete_partial_exit(
    trade_id: int,
    exit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = PartialExitService(db)
    svc.delete_partial_exit(trade_id, exit_id, user_id=current_user.id)
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    return {
        "trade": _enrich_response(trade, db) if trade else None,
    }
