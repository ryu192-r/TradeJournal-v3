"""Pyramid Entries CRUD — individual pyramid add records with trade recalculation."""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.pyramid_entry import PyramidEntry
from app.models.trade import Trade
from app.models.trade_timeline import TradeTimeline
from app.models.user import User
from app.schemas.pyramid_entry import (
    PyramidEntryCreate,
    PyramidEntryListResponse,
    PyramidEntryResponse,
    PyramidEntryUpdate,
)

router = APIRouter(
    dependencies=[Depends(get_current_user)],
    prefix="/trades/{trade_id}/pyramid-entries",
    tags=["pyramid-entries"],
)


def _get_trade(db: Session, trade_id: int, user_id: int) -> Trade:
    trade = db.query(Trade).filter(Trade.id == trade_id, Trade.user_id == user_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


def _recalculate_trade_from_entries(trade: Trade, entries: list[PyramidEntry]) -> None:
    """Recalculate trade entry_price, quantity, fees from the original + all pyramid entries."""
    if not entries:
        return

    # The original trade values (before any pyramiding) are the first entry's values
    # We treat entries[0] as the initial position and subsequent as adds.
    # Actually: the initial trade entry IS the base. Pyramid entries are ADDITIONS.
    # So: weighted_avg = (original_entry * original_qty + sum(pe.price * pe.qty)) / total_qty
    # But we don't store "original" separately. Instead: all entries represent the FULL
    # position history. Entry[0] = initial buy, entry[1..n] = pyramids.
    # Trade.entry_price = weighted avg of ALL entries.
    # Trade.quantity = sum of ALL entries.
    # Trade.fees = sum of ALL entry fees.
    # Trade.entry_time = earliest entry_time.

    total_value = Decimal("0")
    total_qty = Decimal("0")
    total_fees = Decimal("0")
    earliest_time = entries[0].entry_time

    for e in entries:
        total_value += e.entry_price * e.quantity
        total_qty += e.quantity
        total_fees += e.fees or Decimal("0")
        if e.entry_time < earliest_time:
            earliest_time = e.entry_time

    trade.entry_price = total_value / total_qty if total_qty > 0 else Decimal("0")
    trade.quantity = total_qty
    trade.fees = total_fees
    trade.entry_time = earliest_time
    trade.compute_pnl()


@router.get("", response_model=PyramidEntryListResponse)
def list_pyramid_entries(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = _get_trade(db, trade_id, current_user.id)
    entries = (
        db.query(PyramidEntry)
        .filter(PyramidEntry.trade_id == trade_id)
        .order_by(PyramidEntry.entry_time.asc())
        .all()
    )

    # Backfill: if no entries exist but trade has pyramid timeline events, seed them now
    if not entries:
        entries = _backfill_pyramid_entries(db, trade)

    return {"items": entries}


def _backfill_pyramid_entries(db: Session, trade: Trade) -> list[PyramidEntry]:
    """Create pyramid_entries from timeline 'pyramided' events for legacy trades."""
    from app.models.trade_timeline import TradeTimeline
    import re

    timeline_events = (
        db.query(TradeTimeline)
        .filter(TradeTimeline.trade_id == trade.id, TradeTimeline.event_type == "pyramided")
        .order_by(TradeTimeline.timestamp.asc())
        .all()
    )

    if not timeline_events:
        # No pyramiding happened — show trade itself as single entry
        entry = PyramidEntry(
            trade_id=trade.id,
            entry_price=trade.entry_price,
            quantity=trade.quantity,
            entry_time=trade.entry_time,
            fees=trade.fees or Decimal("0"),
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return [entry]

    # Parse pyramid adds from timeline, reconstruct original + adds
    adds = []
    for ev in timeline_events:
        m = re.match(r'\+(\d+(?:\.\d+)?)\s*@\s*(\d+(?:\.\d+)?)', ev.new_value or '')
        if m:
            adds.append({
                "qty": Decimal(m.group(1)),
                "price": Decimal(m.group(2)),
                "time": ev.timestamp or trade.entry_time,
            })

    # Reverse-engineer original position
    pyramid_qty = sum(a["qty"] for a in adds)
    pyramid_value = sum(a["qty"] * a["price"] for a in adds)
    total_qty = trade.quantity
    original_qty = total_qty - pyramid_qty

    if original_qty > 0:
        # weighted avg: trade.entry_price * total_qty = orig_price * orig_qty + pyramid_value
        original_price = (trade.entry_price * total_qty - pyramid_value) / original_qty
    else:
        original_price = trade.entry_price

    # Create initial entry
    initial = PyramidEntry(
        trade_id=trade.id,
        entry_price=max(original_price, Decimal("0")),
        quantity=max(original_qty, Decimal("0")) if original_qty > 0 else trade.quantity,
        entry_time=trade.entry_time,
        fees=Decimal("0"),
    )
    db.add(initial)

    # Create pyramid add entries
    created = [initial]
    for a in adds:
        pe = PyramidEntry(
            trade_id=trade.id,
            entry_price=a["price"],
            quantity=a["qty"],
            entry_time=a["time"],
            fees=Decimal("0"),
        )
        db.add(pe)
        created.append(pe)

    db.commit()
    for e in created:
        db.refresh(e)
    return created


@router.post("", response_model=PyramidEntryResponse, status_code=status.HTTP_201_CREATED)
def create_pyramid_entry(
    trade_id: int,
    payload: PyramidEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = _get_trade(db, trade_id, current_user.id)
    if trade.exit_price is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot pyramid a closed trade")

    entry = PyramidEntry(
        trade_id=trade_id,
        entry_price=payload.entry_price,
        quantity=payload.quantity,
        entry_time=payload.entry_time or datetime.utcnow(),
        fees=payload.fees or Decimal("0"),
    )
    db.add(entry)
    db.flush()

    all_entries = (
        db.query(PyramidEntry)
        .filter(PyramidEntry.trade_id == trade_id)
        .order_by(PyramidEntry.entry_time.asc())
        .all()
    )
    _recalculate_trade_from_entries(trade, all_entries)

    timeline = TradeTimeline(
        trade_id=trade_id,
        event_type="pyramided",
        new_value=f"+{payload.quantity} @ {payload.entry_price}",
    )
    db.add(timeline)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=PyramidEntryResponse)
def update_pyramid_entry(
    trade_id: int,
    entry_id: int,
    payload: PyramidEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = _get_trade(db, trade_id, current_user.id)
    entry = db.query(PyramidEntry).filter(PyramidEntry.id == entry_id, PyramidEntry.trade_id == trade_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pyramid entry not found")

    if payload.entry_price is not None:
        entry.entry_price = payload.entry_price
    if payload.quantity is not None:
        entry.quantity = payload.quantity
    if payload.entry_time is not None:
        entry.entry_time = payload.entry_time
    if payload.fees is not None:
        entry.fees = payload.fees

    all_entries = (
        db.query(PyramidEntry)
        .filter(PyramidEntry.trade_id == trade_id)
        .order_by(PyramidEntry.entry_time.asc())
        .all()
    )
    _recalculate_trade_from_entries(trade, all_entries)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_200_OK)
def delete_pyramid_entry(
    trade_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = _get_trade(db, trade_id, current_user.id)
    entry = db.query(PyramidEntry).filter(PyramidEntry.id == entry_id, PyramidEntry.trade_id == trade_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pyramid entry not found")

    db.delete(entry)
    db.flush()

    remaining = (
        db.query(PyramidEntry)
        .filter(PyramidEntry.trade_id == trade_id)
        .order_by(PyramidEntry.entry_time.asc())
        .all()
    )
    if remaining:
        _recalculate_trade_from_entries(trade, remaining)
    # If no entries remain, leave trade as-is (user should manage via edit trade)

    db.commit()
    return {"message": "deleted"}
