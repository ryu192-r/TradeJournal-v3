from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from decimal import Decimal
import os
import uuid
import shutil

from app.schemas.trade import TradeCreate, TradeUpdate, TradeResponse, TradeListResponse, PyramidTradeRequest
from app.schemas.stop_history import StopHistoryCreate, StopHistoryResponse, StopHistoryListResponse
from app.models.trade import Trade
from app.models.stop_history import StopHistory
from app.models.trade_timeline import TradeTimeline
from app.models.account import Account
from app.services.trade_service import TradeService
from app.db.database import get_db
from app.routers.capital_events import _reconcile_account
from app.models.capital_event import CapitalEvent
from app.models.setup_playbook import SetupPlaybook
from app.core.config import settings


def _auto_reconcile(db: Session):
    account = db.query(Account).first()
    if account:
        _reconcile_account(account.id, db)


router = APIRouter(prefix="/trades", tags=["trades"])

# ─────────────────────── helpers ───────────────────────


def _auto_set_status(trade: Trade):
    """Auto-set status based on exit_price."""
    trade.status = "closed" if trade.exit_price is not None else "open"


def _compute_pnl(trade: Trade) -> Optional[Decimal]:
    if trade.exit_price is None:
        return None
    raw = (trade.exit_price - trade.entry_price) * trade.quantity
    return raw - (trade.fees or Decimal("0"))


def _update_pnl(trade: Trade):
    trade.pnl = _compute_pnl(trade)


def _auto_detect_exit_reason(trade: Trade) -> str:
    """Auto-detect exit reason based on price proximity."""
    if trade.exit_price is None:
        return "system"

    exit_price = Decimal(str(trade.exit_price))
    if trade.stop_price:
        stop = Decimal(str(trade.stop_price))
        if abs(exit_price - stop) <= max(Decimal("0.01") * stop, Decimal("1")):
            return "stop_loss"
    if trade.target_price:
        target = Decimal(str(trade.target_price))
        if abs(exit_price - target) <= max(Decimal("0.01") * target, Decimal("1")):
            return "target"
    return "manual"


def _update_setup_stats(db: Session, setup_name: str | None):
    """Recompute trade_count, win_rate, avg_r for a setup playbook.

    This helper intentionally does not commit; callers own transaction boundaries.
    """
    if not setup_name:
        return
    playbook = db.query(SetupPlaybook).filter(SetupPlaybook.name == setup_name).first()
    if not playbook:
        return
    trades = db.query(Trade).filter(
        Trade.setup == setup_name,
        Trade.status != "deleted",
    ).all()
    closed = [t for t in trades if t.pnl is not None]
    wins = [t for t in closed if t.pnl > 0]
    playbook.trade_count = len(trades)
    playbook.win_rate = f"{round(len(wins) / len(closed) * 100, 1)}%" if closed else None
    r_values = [t.r_multiple for t in closed if t.r_multiple is not None]
    playbook.avg_r = f"{round(sum(float(r) for r in r_values) / len(r_values), 2)}" if r_values else None


# ─────────────────────── endpoints ───────────────────────

@router.post("/", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    """Create a new trade — merges with existing trade for same (symbol, date) if one exists."""
    svc = TradeService(db)
    trade_data = trade.model_dump()
    db_trade, action = svc.merge_or_create(trade_data)
    _auto_set_status(db_trade)
    db.commit()
    db.refresh(db_trade)
    timeline = TradeTimeline(
        trade_id=db_trade.id,
        event_type="trade_opened",
        new_value=f"{db_trade.symbol} @ {db_trade.entry_price}",
        note=f"qty={db_trade.quantity}",
    )
    db.add(timeline)
    _auto_reconcile(db)
    _update_setup_stats(db, db_trade.setup)
    db.commit()
    db.refresh(db_trade)
    return db_trade


@router.get("/", response_model=TradeListResponse)
def list_trades(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List trades with optional filters."""
    query = db.query(Trade).filter(Trade.status != "deleted")
    if status == "closed":
        query = query.filter(Trade.exit_price.isnot(None))
    elif status == "open":
        query = query.filter(Trade.exit_price.is_(None))
    if symbol:
        query = query.filter(Trade.symbol == symbol)
    if from_date:
        query = query.filter(Trade.entry_time >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.filter(Trade.entry_time <= datetime.fromisoformat(to_date + " 23:59:59"))
    total = query.count()
    trades = query.order_by(Trade.entry_time.desc()).offset(skip).limit(limit).all()
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
    """Update an existing trade. Status is auto-computed from exit_price."""
    db_trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not db_trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    update_data = trade_update.model_dump(exclude_unset=True)
    old_setup = db_trade.setup

    for field, value in update_data.items():
        setattr(db_trade, field, value)

    if any(k in update_data for k in ("entry_price", "exit_price", "quantity", "fees")):
        _update_pnl(db_trade)

    if "exit_price" in update_data:
        _auto_set_status(db_trade)
        if "exit_reason" not in update_data:
            db_trade.exit_reason = _auto_detect_exit_reason(db_trade)
        if db_trade.exit_price is not None:
            timeline = TradeTimeline(
                trade_id=db_trade.id,
                event_type="trade_closed",
                new_value=f"PnL={db_trade.pnl}",
                note=f"exit_reason={db_trade.exit_reason}",
            )
            db.add(timeline)
    if "stop_price" in update_data:
        old_stop = str(db_trade.stop_price) if db_trade.stop_price else None
        timeline = TradeTimeline(
            trade_id=db_trade.id,
            event_type="stop_updated",
            old_value=old_stop,
            new_value=str(update_data["stop_price"]),
        )
        db.add(timeline)
    if "target_price" in update_data:
        old_target = str(db_trade.target_price) if db_trade.target_price else None
        timeline = TradeTimeline(
            trade_id=db_trade.id,
            event_type="target_updated",
            old_value=old_target,
            new_value=str(update_data["target_price"]),
        )
        db.add(timeline)

    _auto_reconcile(db)
    _update_setup_stats(db, db_trade.setup)
    if "setup" in update_data and old_setup != db_trade.setup:
        _update_setup_stats(db, old_setup)
    db.commit()
    db.refresh(db_trade)
    return db_trade


@router.post("/merge-duplicates")
def merge_duplicate_trades(db: Session = Depends(get_db)):
    """Find and merge trades with same (symbol, date). One-time backfill."""
    svc = TradeService(db)
    merged = svc.merge_duplicates()
    _auto_reconcile(db)
    return {"merged": merged}


@router.post("/{trade_id}/pyramid", response_model=TradeResponse)
def pyramid_trade(trade_id: int, payload: PyramidTradeRequest, db: Session = Depends(get_db)):
    """Pyramid — add more shares to an open position. Weighted-average entry, sum qty."""
    svc = TradeService(db)
    try:
        trade = svc.pyramid_trade(trade_id, payload.entry_price, payload.quantity,
                                   payload.entry_time, payload.fees, payload.stop_price)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    timeline = TradeTimeline(
        trade_id=trade_id,
        event_type="pyramided",
        new_value=f"+{payload.quantity} @ {payload.entry_price}",
    )
    db.add(timeline)
    _auto_reconcile(db)
    _update_setup_stats(db, trade.setup)
    db.commit()
    db.refresh(trade)
    return trade


# ─────────────────────── Stop History ───────────────────────


@router.get("/{trade_id}/stop-history", response_model=StopHistoryListResponse)
def list_stop_history(trade_id: int, db: Session = Depends(get_db)):
    """List all stop loss adjustments for a trade."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    entries = (
        db.query(StopHistory)
        .filter(StopHistory.trade_id == trade_id)
        .order_by(StopHistory.timestamp.asc())
        .all()
    )
    return {"items": entries}


@router.post("/{trade_id}/stop-history", response_model=StopHistoryResponse, status_code=status.HTTP_201_CREATED)
def create_stop_history(trade_id: int, payload: StopHistoryCreate, db: Session = Depends(get_db)):
    """Record a new stop loss adjustment and update the trade's current stop_price."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    entry = StopHistory(
        trade_id=trade_id,
        stop_type=payload.stop_type,
        price=payload.price,
        timestamp=payload.timestamp,
    )
    db.add(entry)
    old_stop = str(trade.stop_price) if trade.stop_price else None
    trade.stop_price = payload.price
    timeline = TradeTimeline(
        trade_id=trade_id,
        event_type="stop_updated",
        old_value=old_stop,
        new_value=str(payload.price),
        note=f"type={payload.stop_type}",
    )
    db.add(timeline)
    db.commit()
    db.refresh(entry)
    return entry


# ─────────────────────── Chart Images ───────────────────────


@router.post("/{trade_id}/images")
def upload_chart_image(trade_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a chart image for a trade."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename or "chart.png")[1] or ".png"
    filename = f"{trade_id}_{uuid.uuid4().hex[:8]}{ext}"
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(trade_id))
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)

    try:
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    url = f"/uploads/{trade_id}/{filename}"
    images = [i for i in (trade.chart_images or []) if i] + [url]
    trade.chart_images = images
    db.commit()
    db.refresh(trade)
    return {"url": url, "images": images}


@router.delete("/{trade_id}/images")
def delete_chart_image(trade_id: int, url: str, db: Session = Depends(get_db)):
    """Remove a chart image from a trade."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    images = [i for i in (trade.chart_images or []) if i]
    if url not in images:
        raise HTTPException(status_code=404, detail="Image not found")

    images.remove(url)
    trade.chart_images = images

    rel_path = url.lstrip("/uploads/")
    filepath = os.path.join(settings.UPLOAD_DIR, rel_path)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.commit()
    return {"images": images}


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_trade(trade_id: int, db: Session = Depends(get_db)):
    """Soft delete a trade (mark status as deleted)."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    trade.status = "deleted"
    timeline = TradeTimeline(
        trade_id=trade.id,
        event_type="trade_closed",
        note="Trade deleted",
    )
    db.add(timeline)

    if trade.pnl is not None:
        deletion_event = CapitalEvent(
            event_type="trade_deletion",
            amount=trade.pnl,
            timestamp=datetime.utcnow(),
            description=f"Soft-deleted trade: {trade.symbol} (PnL removed)",
            trade_id=trade.id,
        )
        db.add(deletion_event)

    _auto_reconcile(db)
    _update_setup_stats(db, trade.setup)
    db.commit()
    return None
