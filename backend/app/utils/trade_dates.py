"""Canonical NSE/BSE session date helpers.

All trade calendar placement uses entry_time in Asia/Kolkata.
Realized PnL buckets use exit_time (fallback entry_time / created_at).
Naive datetimes are treated as exchange wall-clock (IST) for session bucketing.
Never use created_at, updated_at, or import timestamps for calendar placement.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Optional, Union
from zoneinfo import ZoneInfo

from app.models.trade import Trade

EXCHANGE_TZ = ZoneInfo("Asia/Kolkata")


def as_exchange_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize to timezone-aware Asia/Kolkata."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=EXCHANGE_TZ)
    return dt.astimezone(EXCHANGE_TZ)


def get_trade_session_date(
    trade_or_time: Union[Trade, datetime, None],
) -> Optional[date]:
    """Session date for trade placement (calendar, filters, merge keys)."""
    if trade_or_time is None:
        return None
    if isinstance(trade_or_time, datetime):
        dt = trade_or_time
    elif hasattr(trade_or_time, "entry_time"):
        dt = getattr(trade_or_time, "entry_time", None)
    else:
        return None
    if dt is None:
        return None
    return as_exchange_datetime(dt).date()


def get_trade_session_date_iso(
    trade_or_time: Union[Trade, datetime, None],
) -> Optional[str]:
    session = get_trade_session_date(trade_or_time)
    return session.isoformat() if session else None


def get_realized_session_date(
    exit_time: Optional[datetime] = None,
    entry_time: Optional[datetime] = None,
    created_at: Optional[datetime] = None,
) -> Optional[date]:
    """Session date when realized PnL lands (equity curve, monthly PnL)."""
    ts = exit_time or entry_time or created_at
    if ts is None:
        return None
    return as_exchange_datetime(ts).date()


def get_realized_session_date_iso(
    exit_time: Optional[datetime] = None,
    entry_time: Optional[datetime] = None,
    created_at: Optional[datetime] = None,
) -> Optional[str]:
    session = get_realized_session_date(exit_time, entry_time, created_at)
    return session.isoformat() if session else None


def session_date_in_range(
    session: Optional[date],
    start: date,
    end: date,
) -> bool:
    return session is not None and start <= session <= end


def month_datetime_filter_bounds(month_start: date, month_end: date) -> tuple[datetime, datetime]:
    """Inclusive naive-IST datetime window for SQL pre-filter before session-date bucketing."""
    return datetime.combine(month_start, time.min), datetime.combine(month_end, time.max)


def trades_for_session_month(trades: list[Trade], month_start: date, month_end: date) -> list[Trade]:
    return [
        t for t in trades
        if session_date_in_range(get_trade_session_date(t), month_start, month_end)
    ]


def weekday_from_session_date(session: Union[date, str]) -> int:
    """0=Sunday .. 6=Saturday for calendar grid alignment (timezone-safe)."""
    if isinstance(session, str):
        session = date.fromisoformat(session)
    return (session.weekday() + 1) % 7
