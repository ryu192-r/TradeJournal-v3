"""Pydantic schemas for Trade Review Engine V2 — deterministic structured reviews."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


ScoreLabel = Literal["excellent", "good", "average", "weak", "critical"]
MistakeSeverity = Literal["info", "warning", "critical"]
MistakeCategory = Literal["setup", "entry", "exit", "risk", "psychology", "process"]


class ReviewDimensionScore(BaseModel):
    dimension: str
    score: int = Field(ge=0, le=100)
    label: ScoreLabel
    reason: str
    evidence: list[str] = Field(default_factory=list)
    improvement: Optional[str] = None


class MistakeTag(BaseModel):
    tag: str
    severity: MistakeSeverity
    category: MistakeCategory
    explanation: str
    suggested_fix: str


class TradeReviewV2Response(BaseModel):
    trade_id: int
    symbol: str
    setup: Optional[str] = None
    direction: str
    status: str
    reviewed_at: str
    overall_score: int = Field(ge=0, le=100)
    overall_label: ScoreLabel
    verdict: str
    dimension_scores: list[ReviewDimensionScore] = Field(default_factory=list)
    mistake_tags: list[MistakeTag] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    what_should_have_happened: list[str] = Field(default_factory=list)
    next_time_rules: list[str] = Field(default_factory=list)
    review_questions: list[str] = Field(default_factory=list)
    evidence: dict = Field(default_factory=dict)
    source: str = "deterministic_v2"


class TradeReviewBatchSummary(BaseModel):
    avg_score: float
    common_mistakes: list[str] = Field(default_factory=list)
    strongest_dimension: Optional[str] = None
    weakest_dimension: Optional[str] = None


class TradeReviewBatchResponse(BaseModel):
    generated_at: str
    count: int
    reviews: list[TradeReviewV2Response] = Field(default_factory=list)
    summary: TradeReviewBatchSummary
