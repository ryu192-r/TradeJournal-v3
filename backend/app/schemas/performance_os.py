from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


# ────────────────────────── Daily Workflow ──────────────────────────

class ChecklistItem(BaseModel):
    id: str
    label: str
    checked: bool = False


class DailyWorkflowCreate(BaseModel):
    date: date
    phase: Optional[str] = "pre_market"
    checklist_items: Optional[list[ChecklistItem]] = None
    watchlist_symbols: Optional[list[str]] = None
    pre_market_notes: Optional[str] = None
    intraday_notes: Optional[str] = None
    post_market_notes: Optional[str] = None
    mood_rating: Optional[int] = Field(None, ge=1, le=5)
    discipline_rating: Optional[int] = Field(None, ge=1, le=5)


class DailyWorkflowUpdate(BaseModel):
    phase: Optional[str] = None
    pre_market_done: Optional[bool] = None
    execution_done: Optional[bool] = None
    review_done: Optional[bool] = None
    behavior_done: Optional[bool] = None
    checklist_items: Optional[list[ChecklistItem]] = None
    watchlist_symbols: Optional[list[str]] = None
    pre_market_notes: Optional[str] = None
    intraday_notes: Optional[str] = None
    post_market_notes: Optional[str] = None
    mood_rating: Optional[int] = Field(None, ge=1, le=5)
    discipline_rating: Optional[int] = Field(None, ge=1, le=5)


class DailyWorkflowResponse(BaseModel):
    id: int
    date: date
    phase: str
    pre_market_done: bool
    execution_done: bool
    review_done: bool
    behavior_done: bool
    checklist_items: list[ChecklistItem]
    watchlist_symbols: list[str]
    pre_market_notes: Optional[str] = None
    intraday_notes: Optional[str] = None
    post_market_notes: Optional[str] = None
    mood_rating: Optional[int] = None
    discipline_rating: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DailyWorkflowDashboardResponse(BaseModel):
    workflow: Optional[DailyWorkflowResponse] = None
    today_trades: list[dict]
    open_positions: list[dict]
    market_regime: Optional[dict] = None
    journal: Optional[dict] = None
    discipline_score: Optional[dict] = None
    phase_progress: dict


# ────────────────────────── Weekly Review ──────────────────────────

class WeeklyReviewCreate(BaseModel):
    week_start: date
    week_end: date
    key_lessons: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = False


class WeeklyReviewUpdate(BaseModel):
    key_lessons: Optional[str] = None
    rules_followed: Optional[int] = None
    rules_violated: Optional[int] = None
    discipline_score: Optional[str] = None
    emotion_summary: Optional[dict] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None


class WeeklyReviewResponse(BaseModel):
    id: int
    week_start: date
    week_end: date
    total_trades: int
    total_pnl: str
    win_rate: Optional[str] = None
    best_trade_id: Optional[int] = None
    worst_trade_id: Optional[int] = None
    top_setup: Optional[str] = None
    rules_followed: int
    rules_violated: int
    key_lessons: Optional[str] = None
    discipline_score: Optional[str] = None
    emotion_summary: Optional[dict] = None
    notes: Optional[str] = None
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WeeklyReviewDetailResponse(WeeklyReviewResponse):
    best_trade: Optional[dict] = None
    worst_trade: Optional[dict] = None
    daily_breakdown: list[dict] = []
    setup_breakdown: list[dict] = []


# ────────────────────────── Monthly Review ──────────────────────────

class MonthlyReviewCreate(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    notes: Optional[str] = None
    completed: Optional[bool] = False


class MonthlyReviewUpdate(BaseModel):
    best_setup: Optional[str] = None
    worst_setup: Optional[str] = None
    best_day: Optional[str] = None
    worst_day: Optional[str] = None
    discipline_avg: Optional[str] = None
    behavioral_patterns: Optional[dict] = None
    rule_compliance_rate: Optional[str] = None
    capital_growth_pct: Optional[str] = None
    goals_met: Optional[list[dict]] = None
    next_month_goals: Optional[list[dict]] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None


class MonthlyReviewResponse(BaseModel):
    id: int
    month: str
    total_trades: int
    total_pnl: str
    win_rate: Optional[str] = None
    profit_factor: Optional[str] = None
    avg_r: Optional[str] = None
    best_setup: Optional[str] = None
    worst_setup: Optional[str] = None
    best_day: Optional[str] = None
    worst_day: Optional[str] = None
    discipline_avg: Optional[str] = None
    behavioral_patterns: Optional[dict] = None
    rule_compliance_rate: Optional[str] = None
    capital_growth_pct: Optional[str] = None
    goals_met: Optional[list[dict]] = None
    next_month_goals: Optional[list[dict]] = None
    notes: Optional[str] = None
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MonthlyReviewDetailResponse(MonthlyReviewResponse):
    weekly_summaries: list[dict] = []
    top_emotions: list[dict] = []
    setup_performance: list[dict] = []