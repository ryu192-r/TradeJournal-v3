"""Pydantic schemas for the AI Coach service."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, ConfigDict


class CoachReviewRequest(BaseModel):
    """Request for generating a daily review."""

    trade_ids: Optional[List[int]] = Field(
        None, description="Specific trade IDs to analyze. If omitted, uses date range"
    )
    period_start: Optional[datetime] = Field(
        None, description="Start of analysis period"
    )
    period_end: Optional[datetime] = Field(
        None, description="End of analysis period"
    )
    context: Optional[str] = Field(
        None, description="Additional context for the AI coach"
    )


class WeeklyReviewRequest(BaseModel):
    """Request for generating a weekly review."""

    period_start: Optional[datetime] = Field(
        None, description="Start of analysis period (defaults to 7 days ago)"
    )
    period_end: Optional[datetime] = Field(
        None, description="End of analysis period (defaults to now)"
    )


class TradeInsightRequest(BaseModel):
    """Request for generating insight on specific trades."""

    trade_ids: List[int] = Field(
        ..., description="Trade IDs to analyze", min_length=1, max_length=50
    )
    context: Optional[str] = Field(
        None, description="Additional context about market conditions or observations"
    )


class AskCoachRequest(BaseModel):
    """Free-form question to the AI coach."""

    question: str = Field(
        ..., description="Your question for the coach", min_length=3, max_length=2000
    )
    trade_ids: Optional[List[int]] = Field(
        None, description="Optional trade IDs to provide as context"
    )
    period_start: Optional[datetime] = Field(
        None, description="Optional period start for context"
    )
    period_end: Optional[datetime] = Field(
        None, description="Optional period end for context"
    )


class PatternDetectionRequest(BaseModel):
    """Request for pattern detection endpoint."""

    lookback_days: int = Field(
        default=30,
        ge=7,
        le=365,
        description="How many days back to analyze for patterns",
    )


class RuleReminderRequest(BaseModel):
    """Request for rule reminder endpoint."""

    lookback_days: int = Field(
        default=7,
        ge=1,
        le=90,
        description="How many days back to check trades against rules",
    )
    rules: Optional[List[str]] = Field(
        None,
        description="Custom rules to check. If omitted, uses default NSE rules.",
    )


class PatternResult(BaseModel):
    """A single detected pattern."""

    name: str = Field(..., description="Short pattern label")
    severity: Literal["positive", "negative", "neutral"] = Field(
        ..., description="How this pattern affects trading performance"
    )
    description: str = Field(..., description="One-sentence explanation")
    evidence: str = Field(..., description="Specific trade metrics supporting the claim")
    suggestion: Optional[str] = Field(
        default=None,
        description="Actionable improvement (only for negative patterns)",
    )


class PatternDetectionResponse(BaseModel):
    """Response for pattern detection endpoint."""

    model_config = ConfigDict(protected_namespaces=())

    patterns: List[PatternResult] = Field(..., description="Detected patterns")
    trades_analyzed: int = Field(..., description="Number of trades analyzed")
    lookback_days: int = Field(..., description="Lookback period in days")
    model_used: str = Field(..., description="Model that detected the patterns")
    generated_at: str = Field(..., description="ISO timestamp of detection")


class RuleReminderResponse(BaseModel):
    """Response for rule reminder endpoint."""

    model_config = ConfigDict(protected_namespaces=())

    reminder: str = Field(..., description="AI-generated reminder text")
    trades_analyzed: int = Field(..., description="Number of trades checked")
    rules_checked: int = Field(..., description="Number of rules evaluated")
    model_used: str = Field(..., description="Model that generated the reminder")
    generated_at: str = Field(..., description="ISO timestamp of generation")


class CoachReviewResponse(BaseModel):
    """Response containing AI-generated insight."""

    model_config = ConfigDict(protected_namespaces=())

    insight: str = Field(..., description="The AI-generated analysis")
    review_type: Literal["daily", "weekly", "insight", "answer", "trade_review"] = Field(
        ..., description="Type of review"
    )
    trades_analyzed: int = Field(..., description="Number of trades analyzed")
    model_used: str = Field(..., description="Model that generated the response")
    generated_at: str = Field(..., description="ISO timestamp of generation")


class CoachReviewListItem(BaseModel):
    """Minimal review info for list views."""

    model_config = ConfigDict(protected_namespaces=())

    id: int
    review_type: Literal["daily", "weekly", "insight", "answer", "trade_review"]
    content_preview: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    trades_analyzed: int
    model_used: str
    created_at: datetime


class CoachReviewListResponse(BaseModel):
    """Paginated list of past reviews."""

    total: int
    items: List[CoachReviewListItem]


# ──────────────── Trade Review Engine ────────────────


class TradeReviewRequest(BaseModel):
    """Request for a single-trade AI review."""

    trade_id: int = Field(..., description="ID of the trade to review")


class MissedOpportunity(BaseModel):
    better_exit_price: Optional[float] = Field(None, description="Estimated better exit price if held to target")
    potential_r: Optional[float] = Field(None, description="Estimated R if held to target")
    note: str = Field(..., description="What was left on the table")


class TradeReviewScores(BaseModel):
    entry_timing: int = Field(..., ge=0, le=10)
    exit_timing: int = Field(..., ge=0, le=10)
    risk_management: int = Field(..., ge=0, le=10)
    plan_adherence: int = Field(..., ge=0, le=10)
    psychology: int = Field(..., ge=0, le=10)
    overall: int = Field(..., ge=0, le=10)


class TradeReviewResponse(BaseModel):
    """Structured AI trade review response."""

    model_config = ConfigDict(protected_namespaces=())

    trade_id: int = Field(..., description="ID of the reviewed trade")
    overall_verdict: str = Field(..., description="One of: excellent_execution, good_execution, flawed_but_profitable, poor_execution, disaster")
    summary: str = Field(..., description="2-3 sentence honest assessment")
    scores: TradeReviewScores = Field(..., description="Dimensional scores 0-10")
    strengths: List[str] = Field(default_factory=list, description="Things done well")
    weaknesses: List[str] = Field(default_factory=list, description="Things done poorly")
    rule_violations: List[str] = Field(default_factory=list, description="Playbook rules violated")
    missed_opportunity: Optional[MissedOpportunity] = Field(None, description="What was left on the table")
    coaching_notes: str = Field(..., description="3-5 actionable improvement points")
    discipline_score: int = Field(..., ge=0, le=100, description="Overall discipline score 0-100")
    model_used: str = Field(..., description="AI model that generated the review")
    generated_at: str = Field(..., description="ISO timestamp of generation")
