"""Shared PnL helpers — single source of truth for realized PnL aggregation.

Every endpoint that sums daily/period PnL must use these helpers so that
partial-exit realized PnL from still-open trades is consistently included.

Convention for timestamp of a realized PnL event:
  - Closed trade  →  exit_time (falls back to entry_time if exit_time is NULL)
  - Partial exit  →  exit_time (falls back to created_at)
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from collections import defaultdict
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.utils.decimal_utils import ensure_decimal


@dataclass
class RealizedPnlEvent:
    source: str          # "closed" | "partial_exit"
    trade_id: int
    symbol: str
    setup: Optional[str]
    direction: str
    pnl: Decimal
    r_multiple: Optional[Decimal]
    timestamp: datetime  # when this realized gain/loss should land
    entry_time: datetime
    exit_time: Optional[datetime]
    fees: Decimal
    quantity: Decimal
    entry_price: Decimal
    exit_price: Optional[Decimal]


def get_realized_pnl_events(
    db: Session,
    user_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> list[RealizedPnlEvent]:
    """Return all realized PnL events for a user within a date range.

    Each closed trade produces one event (pnl = full trade pnl).
    Each partial exit on an otherwise-open trade produces one event
    (pnl = realized_pnl from that partial exit).

    This ensures monthly/daily PnL buckets reflect *realised* money,
    not just fully-closed trade PnL.
    """
    events: list[RealizedPnlEvent] = []

    # ── Closed trades ──
    closed_q = (
        "SELECT t.id, t.symbol, t.setup, t.direction, "
        "  t.pnl, t.r_multiple, t.fees, t.quantity, "
        "  t.entry_price, t.exit_price, "
        "  COALESCE(t.exit_time, t.entry_time) AS realized_time, "
        "  t.entry_time, t.exit_time "
        "FROM trades t "
        "WHERE t.user_id = :user_id "
        "  AND t.status != 'deleted' "
        "  AND t.exit_price IS NOT NULL "
        "  AND t.pnl IS NOT NULL"
    )
    params: dict = {"user_id": user_id}
    if start:
        closed_q += " AND t.exit_time >= :start"
        params["start"] = start
    if end:
        closed_q += " AND t.exit_time <= :end"
        params["end"] = end

    rows = db.execute(text(closed_q), params).fetchall()
    for r in rows:
        ts = r.realized_time if r.realized_time else r.entry_time
        events.append(RealizedPnlEvent(
            source="closed",
            trade_id=r.id,
            symbol=r.symbol,
            setup=r.setup,
            direction=r.direction or "LONG",
            pnl=ensure_decimal(r.pnl),
            r_multiple=ensure_decimal(r.r_multiple) if r.r_multiple is not None else None,
            timestamp=ts,
            entry_time=r.entry_time,
            exit_time=r.exit_time,
            fees=ensure_decimal(r.fees or 0),
            quantity=ensure_decimal(r.quantity),
            entry_price=ensure_decimal(r.entry_price),
            exit_price=ensure_decimal(r.exit_price) if r.exit_price is not None else None,
        ))

    # ── Partial exits on open trades ──
    pe_q = (
        "SELECT pe.id, pe.trade_id, t.symbol, t.setup, t.direction, "
        "  pe.realized_pnl, pe.r_captured, pe.exit_time, pe.created_at, "
        "  t.entry_time, t.entry_price, t.quantity, t.fees, "
        "  pe.qty, pe.exit_price AS pe_exit_price "
        "FROM partial_exits pe "
        "JOIN trades t ON t.id = pe.trade_id "
        "WHERE t.user_id = :user_id "
        "  AND t.status != 'deleted' "
        "  AND t.exit_price IS NULL "
        "  AND pe.realized_pnl IS NOT NULL"
    )
    pe_params: dict = {"user_id": user_id}
    if start:
        pe_q += " AND pe.exit_time >= :start"
        pe_params["start"] = start
    if end:
        pe_q += " AND pe.exit_time <= :end"
        pe_params["end"] = end

    pe_rows = db.execute(text(pe_q), pe_params).fetchall()
    for r in pe_rows:
        ts = r.exit_time if r.exit_time else (r.created_at if r.created_at else r.entry_time)
        events.append(RealizedPnlEvent(
            source="partial_exit",
            trade_id=r.trade_id,
            symbol=r.symbol,
            setup=r.setup,
            direction=r.direction or "LONG",
            pnl=ensure_decimal(r.realized_pnl),
            r_multiple=ensure_decimal(r.r_captured) if r.r_captured is not None else None,
            timestamp=ts,
            entry_time=r.entry_time,
            exit_time=r.exit_time,
            fees=Decimal("0"),  # fees allocated to the parent trade, not the partial
            quantity=ensure_decimal(r.qty),
            entry_price=ensure_decimal(r.entry_price),
            exit_price=ensure_decimal(r.pe_exit_price) if r.pe_exit_price is not None else None,
        ))

    events.sort(key=lambda e: e.timestamp)
    return events


def realized_pnl_by_day(
    events: list[RealizedPnlEvent],
) -> dict[date, Decimal]:
    """Aggregate realized PnL events into a {date: total_pnl} dict."""
    daily: dict[date, Decimal] = defaultdict(Decimal)
    for e in events:
        day = e.timestamp.date() if hasattr(e.timestamp, "date") else e.timestamp
        daily[day] += e.pnl
    return daily


def realized_pnl_by_month(
    events: list[RealizedPnlEvent],
) -> dict[str, Decimal]:
    """Aggregate realized PnL events into a {'YYYY-MM': total_pnl} dict."""
    monthly: dict[str, Decimal] = defaultdict(Decimal)
    for e in events:
        ts = e.timestamp
        month_key = ts.strftime("%Y-%m") if hasattr(ts, "strftime") else str(ts)[:7]
        monthly[month_key] += e.pnl
    return monthly


def realized_pnl_by_setup(
    events: list[RealizedPnlEvent],
) -> dict[str, dict]:
    """Aggregate realized PnL events by setup name.

    Returns {setup_name: {pnl: Decimal, count: int, wins: int}}.
    """
    by_setup: dict[str, dict] = defaultdict(lambda: {"pnl": Decimal("0"), "count": 0, "wins": 0})
    for e in events:
        key = e.setup or "Unassigned"
        by_setup[key]["pnl"] += e.pnl
        by_setup[key]["count"] += 1
        if e.pnl > 0:
            by_setup[key]["wins"] += 1
    return dict(by_setup)