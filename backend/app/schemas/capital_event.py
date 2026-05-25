from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from pydantic import Field, field_validator, field_serializer

from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal

IST = timezone(timedelta(hours=5, minutes=30))


def _strip_to_ist(v: datetime) -> datetime:
    if v.tzinfo is not None:
        v = v.astimezone(IST).replace(tzinfo=None)
    return v


class CapitalEventCreate(BaseSchema):
    event_type: str = Field(..., description="Type: deposit, withdrawal, profit, fee, adjustment")
    amount: Decimal = Field(..., description="Event amount (positive for deposits/income, negative for withdrawals/expenses)")
    timestamp: datetime = Field(..., description="When the event occurred")
    description: Optional[str] = Field(None, max_length=200, description="Optional description")
    trade_id: Optional[int] = Field(None, description="Optional reference to an associated trade")
    account_id: Optional[int] = Field(None, description="The account this event belongs to")

    @field_validator("timestamp")
    @classmethod
    def strip_ist(cls, v):
        return _strip_to_ist(v)

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v):
        return ensure_decimal(v)

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v):
        valid = {"deposit", "withdrawal", "profit", "fee", "adjustment", "trade_deletion", "pyramid"}
        if v not in valid:
            raise ValueError(f"event_type must be one of: {', '.join(sorted(valid))}")
        return v


class CapitalEventUpdate(BaseSchema):
    event_type: Optional[str] = Field(None, description="Updated event type")
    amount: Optional[Decimal] = Field(None, description="Updated amount")
    timestamp: Optional[datetime] = Field(None, description="Updated timestamp")
    description: Optional[str] = Field(None, max_length=200)
    trade_id: Optional[int] = None
    account_id: Optional[int] = Field(None, description="The account this event belongs to")

    @field_validator("timestamp")
    @classmethod
    def strip_ist(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v):
        return ensure_decimal(v)

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v):
        if v is None:
            return v
        valid = {"deposit", "withdrawal", "profit", "fee", "adjustment", "trade_deletion", "pyramid"}
        if v not in valid:
            raise ValueError(f"event_type must be one of: {', '.join(sorted(valid))}")
        return v


class CapitalEventResponse(BaseSchema):
    id: int
    event_type: str
    amount: Decimal
    timestamp: datetime
    description: Optional[str] = None
    trade_id: Optional[int] = None
    account_id: Optional[int] = None

    @field_serializer("amount")
    def serialize_amount(self, v: Decimal) -> str:
        return str(v)


class CapitalEventListResponse(BaseSchema):
    total: int
    items: list[CapitalEventResponse]


class CapitalSummaryResponse(BaseSchema):
    total_deposits: str = "0"
    total_withdrawals: str = "0"
    total_profit: str = "0"
    total_fees: str = "0"
    total_adjustments: str = "0"
    total_trade_deletions: str = "0"
    total_pyramids: str = "0"
    net_change: str = "0"
    event_count: int = 0
