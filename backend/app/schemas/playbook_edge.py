"""Pydantic schemas for Playbook Edge Intelligence — R-based setup expectancy engine."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SetupEdgeConfidence(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class SetupEdgeStatus(str, Enum):
    FOCUS = "FOCUS"
    WATCH = "WATCH"
    PAUSE = "PAUSE"


class SetupEdgeMetrics(BaseModel):
    setup_name: str
    sample_size: int = 0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    win_rate: Optional[float] = None
    avg_winner_r: Optional[float] = None
    avg_loser_r: Optional[float] = None
    avg_r: Optional[float] = None
    expectancy_r: Optional[float] = None
    profit_factor: Optional[float] = None
    recent_30d_r: Optional[float] = None
    recent_90d_r: Optional[float] = None
    max_drawdown_r: Optional[float] = None
    best_streak: int = 0
    worst_streak: int = 0
    confidence: SetupEdgeConfidence = SetupEdgeConfidence.LOW
    status: SetupEdgeStatus = SetupEdgeStatus.WATCH
    playbook_score: Optional[int] = Field(default=None, ge=0, le=100)


class SetupConditionBreakdown(BaseModel):
    setup_name: str
    condition_type: str
    condition_value: str
    sample_size: int
    avg_r: Optional[float] = None
    expectancy_r: Optional[float] = None


class PlaybookScore(BaseModel):
    setup_name: str
    score: int = Field(ge=0, le=100)
    expectancy_component: float = 0
    win_rate_component: float = 0
    consistency_component: float = 0
    recent_component: float = 0


class SetupEdgeDetailResponse(BaseModel):
    metrics: SetupEdgeMetrics
    playbook_score: PlaybookScore
    conditions: list[SetupConditionBreakdown] = Field(default_factory=list)


class PlaybookEdgeListResponse(BaseModel):
    generated_at: str
    setups: list[SetupEdgeMetrics] = Field(default_factory=list)
    focus_setups: list[str] = Field(default_factory=list)
    pause_setups: list[str] = Field(default_factory=list)


class SetupEdgeSummaryItem(BaseModel):
    setup_name: str
    expectancy_r: Optional[float] = None
    avg_r: Optional[float] = None
    sample_size: int = 0
    confidence: SetupEdgeConfidence = SetupEdgeConfidence.LOW
    status: SetupEdgeStatus = SetupEdgeStatus.WATCH
    playbook_score: Optional[int] = None
