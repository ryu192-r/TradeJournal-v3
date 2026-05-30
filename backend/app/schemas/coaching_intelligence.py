"""Pydantic schemas for Coaching Intelligence Phase 2 — deterministic adaptive coaching."""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class CoachingPriority(BaseModel):
    id: str
    title: str
    category: str
    severity: str  # info / warning / critical / positive
    reason: str
    evidence: str
    action: str
    due_context: Optional[str] = None
    related_recommendation_ids: list[str] = Field(default_factory=list)
    related_trade_ids: list[int] = Field(default_factory=list)


class SetupConfidenceScore(BaseModel):
    setup: str
    score: int = Field(ge=0, le=100)
    label: str  # avoid / watch / developing / trusted / priority
    sample_size: int
    win_rate: Optional[float] = None
    avg_r: Optional[float] = None
    total_pnl: Optional[float] = None
    consistency_score: Optional[float] = None
    risk_score: Optional[float] = None
    notes: Optional[str] = None


class BehavioralDriftSignal(BaseModel):
    id: str
    title: str
    severity: str  # info / warning / critical
    metric: str
    current_value: Optional[float] = None
    baseline_value: Optional[float] = None
    change: Optional[float] = None
    explanation: str
    suggested_action: str
    related_trade_ids: list[int] = Field(default_factory=list)


class WeeklyCoachingPlan(BaseModel):
    generated_at: str
    week_start: str
    week_end: str
    headline: str
    primary_focus: str
    priorities: list[CoachingPriority] = Field(default_factory=list)
    setup_scores: list[SetupConfidenceScore] = Field(default_factory=list)
    behavioral_drift: list[BehavioralDriftSignal] = Field(default_factory=list)
    review_prompts: list[str] = Field(default_factory=list)
    rules_for_next_week: list[str] = Field(default_factory=list)
    recommended_size_adjustments: list[str] = Field(default_factory=list)
    summary_markdown: str = ""


class TradeReviewPrompt(BaseModel):
    trade_id: int
    symbol: str
    setup: Optional[str] = None
    prompt: str
    focus_area: str
    why_this_trade: str
    related_patterns: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)


class CoachingIntelligenceDashboard(BaseModel):
    generated_at: str
    weekly_plan: Optional[WeeklyCoachingPlan] = None
    top_trade_review_prompts: list[TradeReviewPrompt] = Field(default_factory=list)
    setup_scores: list[SetupConfidenceScore] = Field(default_factory=list)
    behavioral_drift: list[BehavioralDriftSignal] = Field(default_factory=list)
    next_best_actions: list[str] = Field(default_factory=list)
