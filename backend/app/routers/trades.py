from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from decimal import Decimal
import os
import uuid
import shutil

from app.schemas.trade import TradeCreate, TradeUpdate, TradeResponse, TradeListResponse, PyramidTradeRequest, OpenLiveTradeResponse

from app.schemas.trade import TradeCreate, TradeUpdate, TradeResponse, TradeListResponse, PyramidTradeRequest, OpenLiveTradeResponse
from app.schemas.stop_history import StopHistoryCreate, StopHistoryResponse, StopHistoryListResponse
from app.models.trade import Trade
from app.models.stop_history import StopHistory
from app.models.trade_timeline import TradeTimeline
from app.models.partial_exit import PartialExit
from app.models.account import Account
from app.services.trade_service import TradeService
from app.db.database import get_db
from app.routers.capital_events import _reconcile_account
from app.models.capital_event import CapitalEvent
from app.models.setup_playbook import SetupPlaybook
from app.core.config import settings
from app.core.dependencies import get_current_user


def _auto_reconcile(db: Session):
    account = db.query(Account).first()
    if account:
        _reconcile_account(account.id, db)


def _enrich_trade_with_partials(trade: Trade, db: Session) -> dict:
    partials = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id == trade.id)
        .order_by(PartialExit.exit_time.asc())
        .all()
    )
    total_exited_qty = sum(p.qty for p in partials)
    partial_realized = sum(p.realized_pnl or Decimal("0") for p in partials)

    if trade.exit_price is not None:
        remaining_qty = Decimal("0")
        unrealized = Decimal("0")
        # Compute weighted-average exit_price for display
        if partials and total_exited_qty > 0:
            partial_weighted = sum(p.exit_price * p.qty for p in partials)
            rem_qty = trade.quantity - total_exited_qty
            if rem_qty > 0:
                weighted_avg = (partial_weighted + trade.exit_price * rem_qty) / trade.quantity
            else:
                weighted_avg = partial_weighted / total_exited_qty
        else:
            weighted_avg = trade.exit_price
    else:
        remaining_qty = trade.quantity - total_exited_qty
        unrealized = Decimal("0") if partials else None
        weighted_avg = None

    d = {
        "remaining_qty": remaining_qty,
        "partial_realized_pnl": partial_realized if partials else None,
        "unrealized_pnl": unrealized,
        "weighted_avg_exit_price": weighted_avg,
    }
    return d


router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades", tags=["trades"])

# ─────────────────────── helpers ───────────────────────



def _update_pnl(trade: Trade):
    """Delegate PnL + R-multiple to the model's compute_pnl()."""
    trade.compute_pnl()


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


def _resolve_upload_path(url: str) -> str:
    prefix = "/uploads/"
    if not url.startswith(prefix):
        raise HTTPException(status_code=400, detail="Invalid upload URL")

    rel_path = url[len(prefix):]
    upload_root = os.path.abspath(settings.UPLOAD_DIR)
    filepath = os.path.abspath(os.path.join(upload_root, rel_path))
    if os.path.commonpath([upload_root, filepath]) != upload_root:
        raise HTTPException(status_code=400, detail="Invalid upload URL")
    return filepath


# ─────────────────────── endpoints ───────────────────────

@router.post("/", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    """Create a new trade — merges with existing trade for same (symbol, date) if one exists."""
    svc = TradeService(db)
    trade_data = trade.model_dump()
    db_trade, action = svc.merge_or_create(trade_data)
    db_trade.compute_pnl()
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
    items = []
    for t in trades:
        resp = TradeResponse.model_validate(t)
        extra = _enrich_trade_with_partials(t, db)
        resp.remaining_qty = extra["remaining_qty"]
        resp.partial_realized_pnl = extra["partial_realized_pnl"]
        resp.unrealized_pnl = extra["unrealized_pnl"]
        resp.weighted_avg_exit_price = extra["weighted_avg_exit_price"]
        items.append(resp)
    return {"total": total, "items": items}


@router.get("/open-live", response_model=List[OpenLiveTradeResponse])
def list_open_live_trades(db: Session = Depends(get_db)):
    """Return only open trades with the minimal fields needed by the live dashboard."""
    trades = (
        db.query(Trade)
        .filter(Trade.status != "deleted", Trade.exit_price.is_(None))
        .order_by(Trade.entry_time.desc())
        .all()
    )
    result = []
    for t in trades:
        partials = (
            db.query(PartialExit)
            .filter(PartialExit.trade_id == t.id)
            .all()
        )
        total_exited_qty = sum(p.qty for p in partials)
        remaining = t.quantity - total_exited_qty
        result.append({
            "id": t.id,
            "symbol": t.symbol,
            "entry_price": t.entry_price,
            "quantity": t.quantity,
            "remaining_qty": remaining,
            "stop_price": t.stop_price,
            "fees": t.fees,
        })
    return result


@router.get("/{trade_id}", response_model=TradeResponse)
def read_trade(trade_id: int, db: Session = Depends(get_db)):
    """Get a single trade by ID."""
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    resp = TradeResponse.model_validate(trade)
    extra = _enrich_trade_with_partials(trade, db)
    resp.remaining_qty = extra["remaining_qty"]
    resp.partial_realized_pnl = extra["partial_realized_pnl"]
    resp.unrealized_pnl = extra["unrealized_pnl"]
    resp.weighted_avg_exit_price = extra["weighted_avg_exit_price"]
    return resp


@router.put("/{trade_id}", response_model=TradeResponse)
def update_trade(trade_id: int, trade_update: TradeUpdate, db: Session = Depends(get_db)):
    """Update an existing trade. Status is auto-computed from exit_price."""
    db_trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not db_trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    update_data = trade_update.model_dump(exclude_unset=True)
    old_setup = db_trade.setup
    old_stop = db_trade.stop_price
    old_target = db_trade.target_price

    for field, value in update_data.items():
        setattr(db_trade, field, value)

    if any(k in update_data for k in ("entry_price", "exit_price", "quantity", "fees")):
        _update_pnl(db_trade)

    if "exit_price" in update_data:
        db_trade._auto_set_status()
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
    if "notes" in update_data and update_data["notes"]:
        timeline = TradeTimeline(
            trade_id=db_trade.id,
            event_type="note_added",
            new_value=update_data["notes"][:200] if update_data["notes"] else None,
            note="Notes updated",
        )
        db.add(timeline)
    if "stop_price" in update_data:
        timeline = TradeTimeline(
            trade_id=db_trade.id,
            event_type="stop_updated",
            old_value=str(old_stop) if old_stop else None,
            new_value=str(update_data["stop_price"]),
        )
        db.add(timeline)
    if "target_price" in update_data:
        timeline = TradeTimeline(
            trade_id=db_trade.id,
            event_type="target_updated",
            old_value=str(old_target) if old_target else None,
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
    _auto_reconcile(db)
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

    filepath = _resolve_upload_path(url)
    images = [i for i in (trade.chart_images or []) if i]
    if url not in images:
        raise HTTPException(status_code=404, detail="Image not found")

    images.remove(url)
    trade.chart_images = images

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
        event_type="trade_deleted",
        note="Trade deleted",
    )
    db.add(timeline)

    if trade.pnl is not None:
        deletion_event = CapitalEvent(
            event_type="trade_deletion",
            amount=trade.pnl,
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            description=f"Soft-deleted trade: {trade.symbol} (PnL removed)",
            trade_id=trade.id,
        )
        db.add(deletion_event)

    _auto_reconcile(db)
    _update_setup_stats(db, trade.setup)
    db.commit()
    return None
