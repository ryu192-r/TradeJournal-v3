from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from decimal import Decimal
from enum import Enum


class RecommendationSeverity(str, Enum):
    info = "info"
    positive = "positive"
    warning = "warning"
    critical = "critical"


class RecommendationCategory(str, Enum):
    setup = "setup"
    risk = "risk"
    execution = "execution"
    psychology = "psychology"
    timing = "timing"
    market_context = "market_context"
    review = "review"
    capital = "capital"


class RecommendationActionType(str, Enum):
    increase_focus = "increase_focus"
    reduce_size = "reduce_size"
    pause_setup = "pause_setup"
    review_trades = "review_trades"
    improve_rule = "improve_rule"
    journal_prompt = "journal_prompt"
    capital_adjustment = "capital_adjustment"
    continue_behavior = "continue_behavior"


class RecommendationEvidence(BaseModel):
    metric: str
    value: str | float | int | None = None
    benchmark: str | float | int | None = None
    sample_size: int | None = None
    detail: str | None = None


class TradingRecommendation(BaseModel):
    id: str
    category: RecommendationCategory
    severity: RecommendationSeverity
    action_type: RecommendationActionType
    title: str
    summary: str
    why: str
    suggested_action: str
    confidence: float = Field(ge=0, le=1)
    evidence: list[RecommendationEvidence] = Field(default_factory=list)
    related_setup: str | None = None
    related_trade_ids: list[int] = Field(default_factory=list)
    created_for_period: str = ""
    priority_score: float = Field(ge=0, le=100)


class RecommendationSummary(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    focus_this_week: list[str] = Field(default_factory=list)
    avoid_this_week: list[str] = Field(default_factory=list)


class RecommendationDashboardResponse(BaseModel):
    generated_at: str = ""
    period_start: str | None = None
    period_end: str | None = None
    total_trades: int = 0
    closed_trades: int = 0
    recommendations: list[TradingRecommendation] = Field(default_factory=list)
    summary: RecommendationSummary = Field(default_factory=RecommendationSummary)
