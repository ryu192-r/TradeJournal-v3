from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from app.schemas.trade import TradeCreate, TradeUpdate, TradeResponse, TradeListResponse
from app.models.trade import Trade
from app.db.database import get_db

router = APIRouter(prefix="/trades", tags=["trades"])

# ─────────────────────── helpers ───────────────────────

VALID_TRANSITIONS = {
    "draft":     ["reviewed", "deleted"],
    "reviewed":  ["analytics", "deleted", "draft"],
    "analytics": ["deleted", "draft", "reviewed"],
    "deleted":   ["draft"],
}


def _validate_status_transition(current: str, new: str) -> bool:
    return new in VALID_TRANSITIONS.get(current, [])


def _compute_pnl(trade: Trade) -> Optional[Decimal]:
    if trade.exit_price is None:
        return None
    raw = (trade.exit_price - trade.entry_price) * trade.quantity
    if trade.direction == "SHORT":
        raw = -raw
    return raw - (trade.fees or Decimal("0"))


def _update_pnl(trade: Trade):
    trade.pnl = _compute_pnl(trade)


# ─────────────────────── endpoints ───────────────────────

@router.post("/", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    """Create a new trade."""
    db_trade = Trade(
        symbol=trade.symbol,
        direction=trade.direction,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        quantity=trade.quantity,
        entry_time=trade.entry_time,
        exit_time=trade.exit_time,
        fees=trade.fees or Decimal("0"),
        notes=trade.notes,
        setup=trade.setup,
        tactic=trade.tactic,
        stop_price=trade.stop_price,
        target_price=trade.target_price,
        r_multiple=trade.r_multiple,
        status=trade.status or "draft",
    )
    _update_pnl(db_trade)
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return db_trade


@router.get("/", response_model=TradeListResponse)
def list_trades(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List trades with optional filters."""
    query = db.query(Trade).filter(Trade.status != "deleted")  # exclude soft-deleted by default
    if status:
        query = query.filter(Trade.status == status)
    if symbol:
        query = query.filter(Trade.symbol == symbol)
    total = query.count()
    trades = query.offset(skip).limit(limit).all()
    return {"total": total, "items": trades}


@router.get("/{trade_id}", response_model=TradeResponse)
def read_trade(trade_id: int, db: Session = Depends(get_db)):
    """Get a single trade by ID."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


@router.put("/{trade_id}", response_model=TradeResponse)
def update_trade(trade_id: int, trade_update: TradeUpdate, db: Session = Depends(get_db)):
    """Update an existing trade. Status transitions are validated."""
    db_trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not db_trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    update_data = trade_update.model_dump(exclude_unset=True)

    # Validate status transition BEFORE mutating
    if "status" in update_data:
        new_status = update_data["status"]
        if not _validate_status_transition(db_trade.status, new_status):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from {db_trade.status} to {new_status}. "
                       f"Valid transitions: {VALID_TRANSITIONS.get(db_trade.status, [])}",
            )

    # Apply all updates
    for field, value in update_data.items():
        # Handle chart_images and review_tags properly
        if value is not None:
            setattr(db_trade, field, value)

    # Recompute PnL if prices/quantity/direction/fees changed
    if any(k in update_data for k in ("entry_price", "exit_price", "quantity", "direction", "fees")):
        _update_pnl(db_trade)

    db.commit()
    db.refresh(db_trade)
    return db_trade


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_trade(trade_id: int, db: Session = Depends(get_db)):
    """Soft delete a trade (mark status as deleted)."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    if not _validate_status_transition(trade.status, "deleted"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete from status {trade.status}. Valid transitions: {VALID_TRANSITIONS.get(trade.status, [])}",
        )
    trade.status = "deleted"
    db.commit()
    return None
