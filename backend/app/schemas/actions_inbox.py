"""Normalized actionable items for the Actions Inbox."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ActionSeverity = Literal["info", "warning", "critical"]
ActionStatus = Literal["open", "dismissed", "completed"]
ActionSource = Literal["trade", "journal", "risk", "system", "edge", "review", "improvement"]
ActionTier = Literal["simple", "pro"]
ActionType = Literal[
    "trade_review",
    "journal",
    "risk",
    "rule_violation",
    "workflow",
    "suggestion",
    "notification",
    "system",
    "focus_reminder",
]


class ActionTarget(BaseModel):
    """Frontend routing hint (maps to Zustand activeView + optional tab/trade)."""

    view: Optional[str] = None
    tab: Optional[str] = None
    trade_id: Optional[int] = None


class ActionItem(BaseModel):
    id: str
    type: ActionType
    title: str
    description: Optional[str] = None
    severity: ActionSeverity = "info"
    status: ActionStatus = "open"
    source: ActionSource = "system"
    related_trade_id: Optional[int] = None
    created_at: str
    due_at: Optional[str] = None
    action_url: Optional[str] = None
    target: ActionTarget = Field(default_factory=ActionTarget)
    tier: ActionTier = "simple"


class ActionInboxSection(BaseModel):
    id: str
    title: str
    items: list[ActionItem] = Field(default_factory=list)


class ActionsInboxResponse(BaseModel):
    generated_at: str
    interface_mode: ActionTier
    open_count: int
    items: list[ActionItem] = Field(default_factory=list)
    sections: list[ActionInboxSection] = Field(default_factory=list)
