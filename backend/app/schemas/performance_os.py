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


# ────────────────────────── Improvement Action ──────────────────────────

from typing import Literal

ImprovementActionStatus = Literal["suggested", "active", "kept", "broken", "retired"]
ImprovementContractType = Literal[
    "no_early_entry", "max_trades", "cooldown_after_loss", "stop_not_widened", "manual_check"
]


class ImprovementActionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    status: ImprovementActionStatus = "suggested"
    due_session: Optional[date] = None
    contract_type: ImprovementContractType = "manual_check"
    contract_params: dict = Field(default_factory=dict)
    source_evidence: dict = Field(default_factory=dict)


class ImprovementActionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[ImprovementActionStatus] = None
    due_session: Optional[date] = None
    contract_type: Optional[ImprovementContractType] = None
    contract_params: Optional[dict] = None
    source_evidence: Optional[dict] = None


class SelectFocusRequest(BaseModel):
    date: date


class ImprovementActionResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: ImprovementActionStatus
    due_session: Optional[date] = None
    contract_type: ImprovementContractType
    contract_params: dict
    source_evidence: dict
    is_daily_focus: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DailyFocusResponse(BaseModel):
    date: date
    focus: Optional[ImprovementActionResponse] = None
    backlog: list[ImprovementActionResponse] = []



class VerificationResultResponse(BaseModel):
    """Preselected verification outcome for a Daily Focus Action.

    `result`: 'kept' | 'broken' | 'manual'. 'manual' means the engine could not
    decide (manual_check, missing params, or unknown contract type) and the
    user must pick. `requires_confirmation` is True only for the 'manual' case.
    """
    action_id: int
    contract_type: str
    session: Optional[date] = None
    result: str
    summary: str
    evidence: dict
    requires_confirmation: bool
