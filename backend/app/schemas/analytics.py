"""
Analytics response schemas — Pydantic v2 models for all analytics endpoints.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ─────────────────────── KPI ───────────────────────

class KpiSummaryResponse(BaseModel):
    trade_count: int
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None
    expectancy: Optional[float] = None
    avg_r_multiple: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    net_pnl: Optional[str] = None
    gross_profit: Optional[str] = None
    gross_loss: Optional[str] = None


# ─────────────────────── setup performance ─────────────────

class SetupPerformanceItem(BaseModel):
    setup: str
    trade_count: int
    win_rate: Optional[float] = None
    total_pnl: Optional[str] = None
    avg_pnl: Optional[str] = None
    avg_r_multiple: Optional[float] = None
    max_r: Optional[float] = None
    min_r: Optional[float] = None
    r_std: Optional[float] = None
    profit_factor: Optional[float] = None
    expectancy: Optional[float] = None


# ─────────────────────── streaks ─────────────────────────

class CurrentStreak(BaseModel):
    type: Optional[str] = None
    count: int


class StreakEntry(BaseModel):
    type: str
    count: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class StreakAnalysisResponse(BaseModel):
    current_streak: CurrentStreak
    longest_win_streak: int
    longest_loss_streak: int
    streaks: List[StreakEntry]


# ─────────────────────── R distribution ────────────────────

class RDistributionBin(BaseModel):
    range_start: float
    range_end: float
    count: int


class RDistributionResponse(BaseModel):
    bins: List[RDistributionBin]
    mean_r: Optional[float] = None
    median_r: Optional[float] = None
    std_r: Optional[float] = None


# ─────────────────────── monthly P&L ───────────────────────

class MonthlyPnlEntry(BaseModel):
    month: str
    trade_count: int
    net_pnl: Optional[str] = None
    win_rate: Optional[float] = None


# ─────────────────────── daily P&L ─────────────────────────

class DailyPnlEntry(BaseModel):
    date: str
    trade_count: int
    net_pnl: Optional[str] = None
    cumulative_pnl: Optional[str] = None


# ─────────────────────── day-of-week ───────────────────────

class DayOfWeekEntry(BaseModel):
    day: str
    day_index: int
    trade_count: int
    net_pnl: Optional[str] = None
    win_rate: Optional[float] = None
    avg_r: Optional[float] = None


# ─────────────────────── time-of-day ───────────────────────

class TimeOfDayEntry(BaseModel):
    hour: int
    label: str
    trade_count: int
    net_pnl: Optional[str] = None
    win_rate: Optional[float] = None
    avg_r: Optional[float] = None


# ─────────────────────── holding period ────────────────────

class HoldingPeriodEntry(BaseModel):
    trade_id: int
    symbol: str
    setup: Optional[str] = None
    holding_hours: Optional[float] = None
    r_multiple: Optional[float] = None
    pnl: Optional[str] = None


# ─────────────────────── full dashboard ────────────────────

class FullDashboardResponse(BaseModel):
    kpi: KpiSummaryResponse
    setup_performance: List[SetupPerformanceItem]
    streaks: StreakAnalysisResponse
    r_distribution: RDistributionResponse
    monthly_pnl: List[MonthlyPnlEntry]
    daily_pnl: List[DailyPnlEntry]
    day_of_week: List[DayOfWeekEntry]
    time_of_day: List[TimeOfDayEntry]
    holding_period: List[HoldingPeriodEntry]
