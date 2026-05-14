"""Unit tests for analytics service Layer 2 (_calc_* functions).

Each test verifies the pandas math using known-input DataFrames from fixtures.
Tests are fast (~milliseconds) and require no database.
"""


import pytest
from app.services.analytics_service import (
    _calc_kpi,
    _calc_setup_performance,
    _calc_streaks,
    _calc_r_distribution,
    _calc_monthly_pnl,
    _calc_daily_pnl,
    _calc_day_of_week,
    _calc_time_of_day,
    _calc_holding_period,
    _calc_full_dashboard,
    _safe_divide,
)
from tests.fixtures.trades_data import (
    GOLDEN_TRADES,
    EMPTY_DF,
    SINGLE_WIN,
    SINGLE_LOSS,
    NO_R_MULTIPLE,
)


# ── _safe_divide ──

def test_safe_divide_normal():
    assert _safe_divide(10, 2) == 5.0


def test_safe_divide_zero_denominator():
    assert _safe_divide(10, 0) is None


def test_safe_divide_nan_denominator():
    import numpy as np
    assert _safe_divide(10, float("nan")) is None


# ── _calc_kpi ──

def test_kpi_empty():
    result = _calc_kpi(EMPTY_DF)
    assert result["trade_count"] == 0
    assert result["win_rate"] is None
    assert result["net_pnl"] == "0"


def test_kpi_single_win():
    result = _calc_kpi(SINGLE_WIN)
    assert result["trade_count"] == 1
    assert result["win_rate"] == 1.0
    assert float(result["net_pnl"]) > 0


def test_kpi_single_loss():
    result = _calc_kpi(SINGLE_LOSS)
    assert result["trade_count"] == 1
    assert result["win_rate"] == 0.0
    assert float(result["net_pnl"]) < 0


def test_kpi_golden():
    result = _calc_kpi(GOLDEN_TRADES)
    assert result["trade_count"] == 8
    # GOLDEN_TRADES: 5 wins (1,2,5,6,8), 3 losses (3,4,7)
    assert result["win_rate"] == pytest.approx(5 / 8, abs=0.01)
    assert float(result["gross_profit"]) > 0
    assert float(result["gross_loss"]) > 0


def test_kpi_drawdown():
    """Verify drawdown is calculated when trades have mixed results."""
    result = _calc_kpi(GOLDEN_TRADES)
    # Should have a negative max drawdown due to losses in sequence
    assert result["max_drawdown_pct"] is not None
    assert result["max_drawdown_pct"] <= 0


def test_kpi_no_r_multiple():
    result = _calc_kpi(NO_R_MULTIPLE)
    assert result["avg_r_multiple"] is None


# ── _calc_setup_performance ──

def test_setup_empty():
    assert _calc_setup_performance(EMPTY_DF) == []


def test_setup_golden():
    result = _calc_setup_performance(GOLDEN_TRADES)
    # Should have multiple setups: Breakout, VWAP Rejection, Pullback, EP, Reversal, None
    assert len(result) >= 3
    # Sorted by trade_count descending
    counts = [s["trade_count"] for s in result]
    assert counts == sorted(counts, reverse=True)


def test_setup_null_handling():
    """NULL setup should appear as 'Uncategorised'."""
    result = _calc_setup_performance(GOLDEN_TRADES)
    setups = {s["setup"] for s in result}
    assert "Uncategorised" in setups


def test_setup_has_pnl():
    result = _calc_setup_performance(GOLDEN_TRADES)
    for setup in result:
        # Each setup should have non-None total_pnl
        assert setup["total_pnl"] is not None


# ── _calc_streaks ──

def test_streaks_empty():
    result = _calc_streaks(EMPTY_DF)
    assert result["current_streak"]["type"] is None
    assert result["longest_win_streak"] == 0


def test_streaks_single_trade():
    result = _calc_streaks(SINGLE_WIN)
    assert result["current_streak"]["type"] == "WIN"
    assert result["current_streak"]["count"] == 1
    assert result["longest_win_streak"] == 1


def test_streaks_golden():
    result = _calc_streaks(GOLDEN_TRADES)
    # GOLDEN: W(1), W(2), L(3), L(4), W(5), W(6), L(7), W(8)
    # Streaks: WIN-2, LOSS-2, WIN-2, LOSS-1, WIN-1
    assert result["longest_win_streak"] == 2
    assert result["longest_loss_streak"] == 2
    assert len(result["streaks"]) == 5


# ── _calc_r_distribution ──

def test_r_dist_empty():
    result = _calc_r_distribution(EMPTY_DF)
    assert result["bins"] == []
    assert result["mean_r"] is None


def test_r_dist_no_r_column():
    df = SINGLE_WIN.copy()
    del df["r_multiple"]
    result = _calc_r_distribution(df)
    assert result["bins"] == []


def test_r_dist_golden():
    result = _calc_r_distribution(GOLDEN_TRADES, bin_count=5)
    assert len(result["bins"]) == 5
    # All counts should sum to 8 (total trades)
    total = sum(b["count"] for b in result["bins"])
    assert total == 8
    assert result["mean_r"] is not None


def test_r_dist_no_r_values():
    result = _calc_r_distribution(NO_R_MULTIPLE)
    assert result["bins"] == []


# ── _calc_monthly_pnl ──

def test_monthly_empty():
    assert _calc_monthly_pnl(EMPTY_DF) == []


def test_monthly_golden():
    result = _calc_monthly_pnl(GOLDEN_TRADES)
    # All trades are in Jan 2025
    assert len(result) == 1
    assert result[0]["month"] == "2025-01"
    assert result[0]["trade_count"] == 8


# ── _calc_daily_pnl ──

def test_daily_empty():
    assert _calc_daily_pnl(EMPTY_DF) == []


def test_daily_golden():
    result = _calc_daily_pnl(GOLDEN_TRADES)
    # 3 days: 2025-01-13, 2025-01-14, 2025-01-15, 2025-01-16
    assert len(result) == 4
    # Check cumulative is computed
    assert all("cumulative_pnl" in r for r in result)


# ── _calc_day_of_week ──

def test_dow_empty():
    assert _calc_day_of_week(EMPTY_DF) == []


def test_dow_golden():
    result = _calc_day_of_week(GOLDEN_TRADES)
    assert len(result) == 5  # Mon-Fri always present
    # At least some days have trades
    assert any(d["trade_count"] > 0 for d in result)


def test_dow_weekends_excluded():
    """Result always has 5 entries (Mon-Fri)."""
    result = _calc_day_of_week(GOLDEN_TRADES)
    days = [d["day"] for d in result]
    assert days == ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


# ── _calc_time_of_day ──

def test_tod_empty():
    assert _calc_time_of_day(EMPTY_DF) == []


def test_tod_golden():
    result = _calc_time_of_day(GOLDEN_TRADES)
    # Covers 9-15 (7 hours)
    assert len(result) == 7


# ── _calc_holding_period ──

def test_holding_empty():
    assert _calc_holding_period(EMPTY_DF) == []


def test_holding_golden():
    result = _calc_holding_period(GOLDEN_TRADES)
    assert len(result) == 8
    # All trades in fixture have both entry/exit times
    assert all(r["holding_hours"] is not None for r in result)


# ── _calc_full_dashboard ──

def test_dashboard_empty():
    result = _calc_full_dashboard(EMPTY_DF)
    assert "kpi" in result
    assert "setup_performance" in result
    assert result["kpi"]["trade_count"] == 0


def test_dashboard_golden():
    result = _calc_full_dashboard(GOLDEN_TRADES)
    assert len(result) == 9  # 9 sections
    assert result["kpi"]["trade_count"] == 8
    assert len(result["streaks"]["streaks"]) > 0
