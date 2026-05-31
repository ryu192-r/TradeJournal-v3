"""
Analytics Service — Setup Performance, Streak Tracking, and KPI Calculations.

Runs raw SQL via fetch.fetch_trades, post-processes with pandas.
All monetary values returned as strings to avoid JSON precision loss.
Handles NULL setups, zero trades, and division-by-zero gracefully.

Architecture (Layer C):
  - Layer 1: fetch.fetch_trades — SQL → DataFrame (tested in test_fetch.py)
  - Layer 2: _calc_* functions — DataFrame → result dict/list (tested in test_analytics_service.py)
  - Layer 3: get_* functions — Session + optional params → result (call Layer 1 + Layer 2)
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Dict, Any
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from app.services.fetch import fetch_trades
from app.utils.trade_dates import as_exchange_datetime, get_realized_session_date, get_trade_session_date


# ────────────────────────── helpers ──────────────────────────


def _safe_divide(numerator: float, denominator: float) -> Optional[float]:
    """Return numerator/denominator, or None if denominator is 0 or NaN."""
    if denominator is None or denominator == 0 or (isinstance(denominator, float) and np.isnan(denominator)):
        return None
    return numerator / denominator


def _dec_to_str(val) -> Optional[str]:
    """Convert Decimal/float to string for JSON-safe output."""
    if val is None:
        return None
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, float) and np.isnan(val):
        return None
    return str(val)


def _safe_mean(series: pd.Series) -> Optional[float]:
    """Return mean, or None if series is empty."""
    if len(series) == 0:
        return None
    return float(series.mean())


def _safe_round(value: Optional[float], ndigits: int) -> Optional[float]:
    """Round a value, or return None if value is None."""
    if value is None:
        return None
    return round(value, ndigits)


def _safe_sum(series: pd.Series) -> float:
    """Return sum, 0.0 if empty."""
    if len(series) == 0:
        return 0.0
    return float(series.sum())


def _as_percent(ratio: Optional[float], ndigits: int = 2) -> Optional[float]:
    """Convert a 0-1 ratio into a percentage, preserving None."""
    if ratio is None:
        return None
    return round(ratio * 100, ndigits)


def _realized_time_series(df: pd.DataFrame) -> pd.Series:
    """Datetime when realized outcome occurred (for ordering / duration)."""
    return df["exit_time"].fillna(df["entry_time"])


def _realized_session_dates(df: pd.DataFrame) -> pd.Series:
    """Exchange session dates when realized PnL lands."""
    def _row(r):
        exit_ts = r["exit_time"] if pd.notna(r.get("exit_time")) else None
        entry_ts = r["entry_time"] if pd.notna(r.get("entry_time")) else None
        return get_realized_session_date(exit_ts, entry_ts)

    return df.apply(_row, axis=1)


def _entry_session_dates(df: pd.DataFrame) -> pd.Series:
    """Exchange session dates from trade entry_time."""
    return df["entry_time"].apply(lambda ts: get_trade_session_date(ts) if pd.notna(ts) else None)


def _calc_max_drawdown(df: pd.DataFrame) -> tuple[Optional[float], Optional[float]]:
    """Return max drawdown amount and percent from realized daily P&L."""
    if df.empty:
        return None, None

    realized_dates = _realized_session_dates(df)
    daily = (
        pd.DataFrame({
            "realized_date": realized_dates,
            "pnl": df["pnl"],
        })
        .dropna(subset=["realized_date"])
        .groupby("realized_date", as_index=False)["pnl"]
        .sum()
        .sort_values("realized_date")
    )

    if daily.empty:
        return None, None

    cumulative = daily["pnl"].cumsum()
    running_peak = cumulative.cummax()
    drawdown_amount = running_peak - cumulative
    max_drawdown_amount = float(drawdown_amount.max()) if len(drawdown_amount) > 0 else None

    positive_peaks = running_peak.replace(0, np.nan)
    drawdown_pct = (drawdown_amount / positive_peaks) * 100
    max_drawdown_pct = float(drawdown_pct.max()) if len(drawdown_pct) > 0 else None

    if max_drawdown_amount is not None:
        max_drawdown_amount = round(max_drawdown_amount, 2)
    if max_drawdown_pct is not None and not np.isnan(max_drawdown_pct):
        max_drawdown_pct = round(max_drawdown_pct, 2)
    else:
        max_drawdown_pct = None

    return max_drawdown_amount, max_drawdown_pct


# ────────────────────────── Layer 2: Calc functions ──────────────────────────
# These take a DataFrame (from fetch_trades) and return plain dicts/lists.
# They are the primary unit-test surface.


def _calc_kpi(df: pd.DataFrame) -> Dict[str, Any]:
    """Return top-level KPI cards from a trades DataFrame."""
    if df.empty:
        return {
            "trade_count": 0,
            "win_rate": None,
            "profit_factor": None,
            "expectancy": None,
            "avg_r_multiple": None,
            "max_drawdown_amount": None,
            "max_drawdown_pct": None,
            "net_pnl": "0",
            "gross_profit": "0",
            "gross_loss": "0",
        }

    trade_count = len(df)
    winners = df[df["pnl"] > 0]
    losers = df[df["pnl"] < 0]

    win_rate_ratio = _safe_divide(len(winners), trade_count)

    gross_profit = _safe_sum(winners["pnl"]) if len(winners) > 0 else 0.0
    gross_loss = abs(_safe_sum(losers["pnl"])) if len(losers) > 0 else 0.0
    profit_factor = _safe_divide(gross_profit, gross_loss)

    avg_win = float(winners["pnl"].mean()) if len(winners) > 0 else 0.0
    avg_loss = float(losers["pnl"].mean()) if len(losers) > 0 else 0.0
    w_rate = win_rate_ratio or 0.0
    expectancy = (w_rate * avg_win) - ((1 - w_rate) * avg_loss)

    avg_r = _safe_mean(df["r_multiple"].dropna())
    max_drawdown_amount, max_drawdown_pct = _calc_max_drawdown(df)

    net_pnl = _safe_sum(df["pnl"])

    return {
        "trade_count": trade_count,
        "win_rate": _as_percent(win_rate_ratio, 2),
        "profit_factor": round(profit_factor, 2) if profit_factor is not None else None,
        "expectancy": round(expectancy, 2) if expectancy is not None else None,
        "avg_r_multiple": round(avg_r, 2) if avg_r is not None else None,
        "max_drawdown_amount": max_drawdown_amount,
        "max_drawdown_pct": max_drawdown_pct,
        "net_pnl": _dec_to_str(net_pnl),
        "gross_profit": _dec_to_str(gross_profit),
        "gross_loss": _dec_to_str(gross_loss),
    }


def _calc_setup_performance(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Return per-setup performance metrics."""
    if df.empty:
        return []

    # Handle NULL setups
    df = df.copy()
    df["setup"] = df["setup"].fillna("Uncategorised")
    df["setup"] = df["setup"].replace("", "Uncategorised")

    results = []
    for setup_name, group in df.groupby("setup"):
        count = len(group)
        winners = group[group["pnl"] > 0]
        losers = group[group["pnl"] < 0]

        win_rate_ratio = _safe_divide(len(winners), count)
        total_pnl = _safe_sum(group["pnl"])
        avg_pnl = _safe_mean(group["pnl"])
        avg_r = _safe_mean(group["r_multiple"].dropna())
        max_r = float(group["r_multiple"].max()) if len(group["r_multiple"].dropna()) > 0 else None
        min_r = float(group["r_multiple"].min()) if len(group["r_multiple"].dropna()) > 0 else None
        r_std = float(group["r_multiple"].std()) if len(group["r_multiple"].dropna()) > 1 else None

        gp = _safe_sum(winners["pnl"]) if len(winners) > 0 else 0.0
        gl = abs(_safe_sum(losers["pnl"])) if len(losers) > 0 else 0.0
        pf = _safe_divide(gp, gl)

        avg_w = float(winners["pnl"].mean()) if len(winners) > 0 else 0.0
        avg_l = float(losers["pnl"].mean()) if len(losers) > 0 else 0.0
        wr = win_rate_ratio or 0.0
        exp = (wr * avg_w) - ((1 - wr) * avg_l)

        results.append({
            "setup": setup_name,
            "trade_count": count,
            "win_rate": _as_percent(win_rate_ratio, 2),
            "total_pnl": _dec_to_str(total_pnl),
            "avg_pnl": _dec_to_str(avg_pnl),
            "avg_r_multiple": round(avg_r, 4) if avg_r is not None else None,
            "max_r": round(max_r, 4) if max_r is not None else None,
            "min_r": round(min_r, 4) if min_r is not None else None,
            "r_std": round(r_std, 4) if r_std is not None else None,
            "profit_factor": round(pf, 2) if pf is not None else None,
            "expectancy": round(exp, 2) if exp is not None else None,
        })

    results.sort(key=lambda x: x["trade_count"], reverse=True)
    return results


def _calc_streaks(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze consecutive win/loss streaks."""
    if df.empty:
        return {
            "current_streak": {"type": None, "count": 0},
            "longest_win_streak": 0,
            "longest_loss_streak": 0,
            "streaks": [],
        }

    df = df.copy()
    df["realized_time"] = _realized_time_series(df)
    df = df.sort_values("realized_time")

    streaks: List[Dict[str, Any]] = []
    current_type = None
    current_count = 0
    current_start = None
    current_end = None

    for _, row in df.iterrows():
        outcome = "win" if row["pnl"] > 0 else "loss"
        if outcome == current_type:
            current_count += 1
            current_end = row["realized_time"]
        else:
            if current_type is not None:
                streaks.append({
                    "type": current_type,
                    "count": current_count,
                    "start_date": current_start.isoformat() if current_start else None,
                    "end_date": current_end.isoformat() if current_end else None,
                })
            current_type = outcome
            current_count = 1
            current_start = row["realized_time"]
            current_end = row["realized_time"]

    if current_type is not None:
        streaks.append({
            "type": current_type,
            "count": current_count,
            "start_date": current_start.isoformat() if current_start else None,
            "end_date": current_end.isoformat() if current_end else None,
        })

    current_streak = streaks[-1] if streaks else {"type": None, "count": 0}
    win_streaks = [s["count"] for s in streaks if s["type"] == "win"]
    loss_streaks = [s["count"] for s in streaks if s["type"] == "loss"]

    return {
        "current_streak": {"type": current_streak["type"], "count": current_streak["count"]},
        "longest_win_streak": max(win_streaks) if win_streaks else 0,
        "longest_loss_streak": max(loss_streaks) if loss_streaks else 0,
        "streaks": streaks,
    }


def _calc_r_distribution(df: pd.DataFrame, bin_count: int = 10) -> Dict[str, Any]:
    """Return R-multiple histogram buckets."""
    if "r_multiple" not in df.columns:
        return {"bins": [], "mean_r": None, "median_r": None, "std_r": None}
    r_vals = df["r_multiple"].dropna()

    if r_vals.empty:
        return {"bins": [], "mean_r": None, "median_r": None, "std_r": None}

    hist, bin_edges = np.histogram(r_vals, bins=bin_count)
    bins = []
    for i in range(len(hist)):
        bins.append({
            "range_start": round(float(bin_edges[i]), 4),
            "range_end": round(float(bin_edges[i + 1]), 4),
            "count": int(hist[i]),
        })

    return {
        "bins": bins,
        "mean_r": round(float(r_vals.mean()), 4),
        "median_r": round(float(r_vals.median()), 4),
        "std_r": round(float(r_vals.std()), 4) if len(r_vals) > 1 else None,
    }


def _calc_monthly_pnl(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Return monthly aggregated P&L."""
    if df.empty:
        return []

    df = df.copy()
    df["realized_session"] = _realized_session_dates(df)
    df["month"] = pd.to_datetime(df["realized_session"]).dt.to_period("M")
    monthly = df.groupby("month").agg(
        trade_count=("id", "count"),
        net_pnl=("pnl", "sum"),
        win_count=("pnl", lambda x: (x > 0).sum()),
    ).reset_index()
    monthly["win_rate"] = monthly.apply(
        lambda r: _as_percent(r["win_count"] / r["trade_count"], 2) if r["trade_count"] > 0 else None,
        axis=1,
    )

    results = []
    for _, row in monthly.iterrows():
        results.append({
            "month": str(row["month"]),
            "trade_count": int(row["trade_count"]),
            "net_pnl": _dec_to_str(row["net_pnl"]),
            "win_rate": row["win_rate"],
        })

    return sorted(results, key=lambda x: x["month"])


def _calc_daily_pnl(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Return daily aggregated P&L for equity curve rendering."""
    if df.empty:
        return []

    df = df.copy()
    df["date"] = _realized_session_dates(df)
    daily = df.dropna(subset=["date"]).groupby("date").agg(
        trade_count=("id", "count"),
        net_pnl=("pnl", "sum"),
    ).reset_index()

    daily["cumulative_pnl"] = daily["net_pnl"].cumsum()

    results = []
    for _, row in daily.iterrows():
        results.append({
            "date": str(row["date"]),
            "trade_count": int(row["trade_count"]),
            "net_pnl": _dec_to_str(row["net_pnl"]),
            "cumulative_pnl": _dec_to_str(row["cumulative_pnl"]),
        })

    return sorted(results, key=lambda x: x["date"])


def _calc_day_of_week(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Return P&L grouped by day of week."""
    if df.empty:
        return []

    df = df.copy()
    df["entry_session"] = _entry_session_dates(df)
    df["dow"] = pd.to_datetime(df["entry_session"]).dt.dayofweek
    df = df[df["dow"] < 5]  # Weekdays only

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    results = []
    for dow in range(5):
        subset = df[df["dow"] == dow]
        count = len(subset)
        if count == 0:
            results.append({
                "day": day_names[dow],
                "day_index": dow,
                "trade_count": 0,
                "net_pnl": "0",
                "win_rate": None,
                "avg_r": None,
            })
        else:
            wins = (subset["pnl"] > 0).sum()
            results.append({
                "day": day_names[dow],
                "day_index": dow,
                "trade_count": count,
                "net_pnl": _dec_to_str(_safe_sum(subset["pnl"])),
                "win_rate": _as_percent(_safe_divide(wins, count), 2) if count > 0 else None,
                "avg_r": _safe_round(_safe_mean(subset["r_multiple"].dropna()), 4),
            })

    return results


def _calc_time_of_day(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Return P&L grouped by hour of entry."""
    if df.empty:
        return []

    df = df.copy()
    df["hour"] = df["entry_time"].apply(
        lambda ts: as_exchange_datetime(ts).hour if pd.notna(ts) else None
    )

    results = []
    for hour in range(9, 16):
        subset = df[df["hour"] == hour]
        count = len(subset)
        if count == 0:
            results.append({
                "hour": hour,
                "label": f"{hour}:00-{hour}:59",
                "trade_count": 0,
                "net_pnl": "0",
                "win_rate": None,
                "avg_r": None,
            })
        else:
            wins = (subset["pnl"] > 0).sum()
            results.append({
                "hour": hour,
                "label": f"{hour}:00-{hour}:59",
                "trade_count": count,
                "net_pnl": _dec_to_str(_safe_sum(subset["pnl"])),
                "win_rate": _as_percent(_safe_divide(wins, count), 2) if count > 0 else None,
                "avg_r": _safe_round(_safe_mean(subset["r_multiple"].dropna()), 4),
            })

    return results


def _calc_holding_period(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Return each trade's holding period and R-multiple."""
    if df.empty:
        return []

    results = []
    for _, row in df.iterrows():
        holding_hours = None
        if pd.notna(row.get("exit_time")) and pd.notna(row.get("entry_time")):
            delta = row["exit_time"] - row["entry_time"]
            holding_hours = round(float(delta.total_seconds() / 3600), 2)

        r_val = row.get("r_multiple")
        setup_val = row["setup"] if pd.notna(row["setup"]) else None
        results.append({
            "trade_id": int(row["id"]),
            "symbol": row["symbol"],
            "setup": setup_val,
            "holding_hours": holding_hours,
            "r_multiple": round(float(r_val), 4) if pd.notna(r_val) else None,
            "pnl": _dec_to_str(row["pnl"]),
        })

    return results


def _calc_full_dashboard(df: pd.DataFrame) -> Dict[str, Any]:
    """Return the complete analytics dashboard from one DataFrame."""
    return {
        "kpi": _calc_kpi(df),
        "setup_performance": _calc_setup_performance(df),
        "streaks": _calc_streaks(df),
        "r_distribution": _calc_r_distribution(df),
        "monthly_pnl": _calc_monthly_pnl(df),
        "daily_pnl": _calc_daily_pnl(df),
        "day_of_week": _calc_day_of_week(df),
        "time_of_day": _calc_time_of_day(df),
        "holding_period": _calc_holding_period(df),
    }


# ────────────────────────── Layer 3: Router-facing API ──────────────────────────


def get_kpi_summary(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Return top-level KPI cards."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_kpi(df)


def get_setup_performance(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return per-setup performance metrics."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_setup_performance(df)


def get_streak_analysis(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Analyze consecutive win/loss streaks."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_streaks(df)


def get_r_distribution(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    bin_count: int = 10,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Return R-multiple histogram buckets."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_r_distribution(df, bin_count)


def get_monthly_pnl(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return monthly aggregated P&L."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_monthly_pnl(df)


def get_daily_pnl(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return daily aggregated P&L for equity curve rendering."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_daily_pnl(df)


def get_day_of_week_performance(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return P&L grouped by day of week."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_day_of_week(df)


def get_time_of_day_performance(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return P&L grouped by hour of entry."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_time_of_day(df)


def get_holding_period_analysis(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return each trade's holding period and R-multiple."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_holding_period(df)


def get_full_dashboard(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Return the complete analytics dashboard in one call."""
    df = fetch_trades(db, start_date, end_date, user_id)
    return _calc_full_dashboard(df)
