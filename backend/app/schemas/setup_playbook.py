from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────── JSON sub-models ───────────────────────

class TacticSchema(BaseModel):
    """A tactic within a setup playbook."""
    name: str = Field(..., min_length=1, max_length=100)
    win_rate: Optional[str] = Field(None, description="Historical win rate for this tactic.")
    avg_r: Optional[str] = Field(None, description="Average R-multiple for this tactic.")
    conditions: List[str] = Field(default_factory=list)


class RiskProfileSchema(BaseModel):
    """Risk profile for a setup."""
    max_risk_pct: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
        description="Maximum capital risk percentage."
    )
    position_sizing_rule: Optional[str] = Field(None)
    stop_style: Optional[str] = Field(
        None,
        description="e.g. 'fixed_pct', 'atr_based', 'structure_based'."
    )


# ─────────────────────── CRUD schemas ───────────────────────

class SetupPlaybookBase(BaseModel):
    """Shared fields for create/update."""
    name: str = Field(..., min_length=1, max_length=100, description="Setup name (unique).")
    description: Optional[str] = Field(None, description="Human-readable description of the setup.")
    tactics: List[TacticSchema] = Field(default_factory=list, description="Tactics for this setup.")
    ideal_conditions: List[str] = Field(default_factory=list, description="Ideal market conditions.")
    risk_profile: RiskProfileSchema = Field(default_factory=RiskProfileSchema)
    rules: List[str] = Field(default_factory=list, description="Rules checklist for this setup.")


class SetupPlaybookCreate(SetupPlaybookBase):
    pass


class SetupPlaybookUpdate(BaseModel):
    """Partial update — only provided fields are changed."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    tactics: Optional[List[TacticSchema]] = None
    ideal_conditions: Optional[List[str]] = None
    risk_profile: Optional[RiskProfileSchema] = None
    rules: Optional[List[str]] = None
    is_active: Optional[str] = Field(None, description="active or archived.")


class SetupPlaybookResponse(SetupPlaybookBase):
    id: int
    win_rate: Optional[str] = None
    avg_r: Optional[str] = None
    trade_count: int = 0
    is_active: str = "active"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SetupPlaybookListResponse(BaseModel):
    total: int
    items: List[SetupPlaybookResponse]
