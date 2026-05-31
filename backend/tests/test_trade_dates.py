"""Regression tests for canonical NSE/BSE session date helpers."""

from datetime import date, datetime, timezone

import pytest

from app.utils.trade_dates import (
    get_realized_session_date,
    get_trade_session_date,
    trades_for_session_month,
    weekday_from_session_date,
)


def test_monday_entry_maps_to_monday():
    """Trade entered Monday 09:30 IST stays on Monday."""
    entry = datetime(2025, 11, 24, 9, 30, 0)  # Monday
    assert get_trade_session_date(entry) == date(2025, 11, 24)
    assert weekday_from_session_date(date(2025, 11, 24)) == 1  # Monday


def test_imported_sunday_created_at_does_not_move_trade_to_sunday():
    """Session date uses entry_time, not created_at."""
    class FakeTrade:
        entry_time = datetime(2025, 11, 24, 10, 0, 0)  # Monday
        created_at = datetime(2025, 11, 23, 18, 0, 0)  # Sunday import

    assert get_trade_session_date(FakeTrade()) == date(2025, 11, 24)


def test_utc_timestamp_near_midnight_maps_to_correct_ist_day():
    """UTC Sunday evening = Monday IST for NSE session."""
    # 2025-11-23 20:30 UTC = 2025-11-24 02:00 IST (Monday)
    utc = datetime(2025, 11, 23, 20, 30, 0, tzinfo=timezone.utc)
    assert get_trade_session_date(utc) == date(2025, 11, 24)


def test_naive_ist_wall_clock_not_shifted():
    """Naive datetimes are IST wall clock — no extra offset."""
    entry = datetime(2025, 11, 24, 9, 30, 0)
    assert get_trade_session_date(entry) == date(2025, 11, 24)


def test_sunday_without_trades_stays_empty_in_calendar_bucket():
    """No trade with Monday entry should land on prior Sunday."""
    monday_trade = type("T", (), {"entry_time": datetime(2025, 11, 24, 9, 30)})()
    trades = trades_for_session_month(
        [monday_trade],
        date(2025, 11, 1),
        date(2025, 11, 30),
    )
    sunday = date(2025, 11, 23)
    by_day = {}
    for t in trades:
        d = get_trade_session_date(t)
        by_day.setdefault(d, []).append(t)
    assert sunday not in by_day
    assert date(2025, 11, 24) in by_day


def test_realized_session_date_prefers_exit_time():
    exit_ts = datetime(2025, 11, 25, 15, 15)
    entry_ts = datetime(2025, 11, 24, 9, 30)
    assert get_realized_session_date(exit_ts, entry_ts) == date(2025, 11, 25)


def test_calendar_count_matches_session_dates():
    """Month filter + bucket must agree on session date."""
    trades = [
        type("T", (), {"entry_time": datetime(2025, 11, 24, 9, 30)})(),
        type("T", (), {"entry_time": datetime(2025, 11, 25, 10, 0)})(),
    ]
    month_start, month_end = date(2025, 11, 1), date(2025, 11, 30)
    filtered = trades_for_session_month(trades, month_start, month_end)
    counts: dict[date, int] = {}
    for t in filtered:
        d = get_trade_session_date(t)
        counts[d] = counts.get(d, 0) + 1
    assert counts[date(2025, 11, 24)] == 1
    assert counts[date(2025, 11, 25)] == 1
    assert sum(counts.values()) == 2
