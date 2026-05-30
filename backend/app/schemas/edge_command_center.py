"""Pydantic schemas for Edge Command Center — unified intelligence surface."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.playbook_edge import SetupEdgeSummaryItem

EdgePriorityCategory = Literal[
    "focus", "avoid", "risk", "review", "setup", "psychology", "workflow"
]
EdgePrioritySeverity = Literal["positive", "info", "warning", "critical"]
EdgePrioritySource = Literal[
    "recommendation", "coaching", "trade_review_v2", "performance_os", "derived"
]
EdgeSetupAction = Literal["focus", "watch", "avoid", "develop"]
EdgeReviewSeverity = Literal["info", "warning", "critical"]


class EdgePriority(BaseModel):
    id: str
    title: str
    category: EdgePriorityCategory
    severity: EdgePrioritySeverity
    summary: str
    action: str
    evidence: list[str] = Field(default_factory=list)
    related_trade_ids: list[int] = Field(default_factory=list)
    related_setup: Optional[str] = None
    source: EdgePrioritySource


class EdgeSetupFocus(BaseModel):
    setup: str
    score: int = Field(ge=0, le=100)
    label: str
    action: EdgeSetupAction
    reason: str
    evidence: list[str] = Field(default_factory=list)


class EdgeReviewQueueItem(BaseModel):
    trade_id: int
    symbol: str
    setup: Optional[str] = None
    reason: str
    severity: EdgeReviewSeverity
    score: Optional[int] = None
    mistake_tags: list[str] = Field(default_factory=list)


class EdgeWorkflowStatus(BaseModel):
    date: str
    phase: Optional[str] = None
    is_complete: bool
    progress_percent: int = Field(ge=0, le=100)
    next_step: str
    missing_items: list[str] = Field(default_factory=list)


class EdgeCommandCenterSummary(BaseModel):
    focus_today: list[str] = Field(default_factory=list)
    avoid_today: list[str] = Field(default_factory=list)
    review_today: list[str] = Field(default_factory=list)
    risk_warnings: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)


class EdgeDataQuality(BaseModel):
    closed_trades: int = 0
    total_trades: int = 0
    has_recommendations: bool = False
    has_coaching: bool = False
    has_trade_reviews: bool = False
    notes: list[str] = Field(default_factory=list)


class PlaybookEdgeCommandCenter(BaseModel):
    focus_setups: list[str] = Field(default_factory=list)
    pause_setups: list[str] = Field(default_factory=list)
    highest_expectancy: Optional[SetupEdgeSummaryItem] = None
    lowest_expectancy: Optional[SetupEdgeSummaryItem] = None


class EdgeCommandCenterResponse(BaseModel):
    generated_at: str
    period_start: str
    period_end: str
    headline: str
    primary_focus: str
    next_best_action: str
    priorities: list[EdgePriority] = Field(default_factory=list)
    setup_focus: list[EdgeSetupFocus] = Field(default_factory=list)
    review_queue: list[EdgeReviewQueueItem] = Field(default_factory=list)
    workflow: Optional[EdgeWorkflowStatus] = None
    summary: EdgeCommandCenterSummary = Field(default_factory=EdgeCommandCenterSummary)
    data_quality: EdgeDataQuality = Field(default_factory=EdgeDataQuality)
    playbook_edge: Optional[PlaybookEdgeCommandCenter] = None
