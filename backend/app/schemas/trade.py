from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator, field_serializer

from app.utils.decimal_utils import ensure_decimal

IST = timezone(timedelta(hours=5, minutes=30))


def _strip_to_ist(v: datetime) -> datetime:
    """Ensure datetime is naive IST.
    If timezone-aware, convert to IST and strip tzinfo.
    If naive, assume it is already IST and return as-is.
    """
    if v.tzinfo is not None:
        v = v.astimezone(IST).replace(tzinfo=None)
    return v


class TradeBase(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Instrument symbol")
    direction: str = Field(default="LONG", description="Always LONG for Indian equities")
    entry_price: Decimal = Field(..., description="Entry price per unit")
    exit_price: Optional[Decimal] = Field(None, description="Exit price per unit")
    quantity: Decimal = Field(..., description="Quantity of shares/contracts")
    entry_time: datetime = Field(..., description="Timestamp of entry (IST)")
    exit_time: Optional[datetime] = Field(None, description="Timestamp of exit (IST)")
    fees: Decimal = Field(default=Decimal('0'), description="Total fees for the trade")
    notes: Optional[str] = Field(None, description="Additional notes")
    tags: Optional[List[str]] = Field(None, description="List of tags")
    setup: Optional[str] = Field(None, description="Trade setup type")
    tactic: Optional[str] = Field(None, description="Trading tactic used")
    stop_price: Optional[Decimal] = Field(None, description="Stop loss price")
    target_price: Optional[Decimal] = Field(None, description="Target profit price")
    r_multiple: Optional[Decimal] = Field(None, description="Risk multiple")
    exit_reason: Optional[str] = Field(None, description="Exit reason: stop_loss, target, manual, trailing, system")

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v):
        if v != "LONG":
            raise ValueError("Direction must be 'LONG' — only long positions supported")
        return v

    @field_validator("entry_time", "exit_time")
    @classmethod
    def strip_to_ist(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    # Keep as strings to avoid precision loss
    @field_validator("entry_price", "exit_price", "quantity", "fees", "stop_price", "target_price", "r_multiple")
    @classmethod
    def validate_decimal(cls, v):
        return ensure_decimal(v)


class TradeCreate(TradeBase):
    pass


class TradeUpdate(BaseModel):
    symbol: Optional[str] = None
    direction: Optional[str] = None
    entry_price: Optional[Decimal] = None
    exit_price: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    fees: Optional[Decimal] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    setup: Optional[str] = None
    tactic: Optional[str] = None
    stop_price: Optional[Decimal] = None
    target_price: Optional[Decimal] = None
    r_multiple: Optional[Decimal] = None
    chart_images: Optional[List[str]] = None
    review_notes: Optional[str] = None
    review_tags: Optional[List[str]] = None
    exit_notes: Optional[str] = None
    exit_reason: Optional[str] = None

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v):
        if v is None:
            return v
        if v != "LONG":
            raise ValueError("Direction must be 'LONG' — only long positions supported")
        return v

    @field_validator("entry_time", "exit_time")
    @classmethod
    def strip_to_ist_update(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("entry_price", "exit_price", "quantity", "fees", "stop_price", "target_price", "r_multiple")
    @classmethod
    def ensure_decimal(cls, v):
        return ensure_decimal(v)


class TradeResponse(BaseModel):
    id: int
    symbol: str
    direction: str
    entry_price: Decimal
    exit_price: Optional[Decimal] = None
    quantity: Decimal
    entry_time: datetime
    exit_time: Optional[datetime] = None
    fees: Decimal
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    setup: Optional[str] = None
    tactic: Optional[str] = None
    stop_price: Optional[Decimal] = None
    target_price: Optional[Decimal] = None
    r_multiple: Optional[Decimal] = None
    status: str = Field(default="open", description="open, closed, or deleted")
    pnl: Optional[Decimal] = None
    chart_images: Optional[List[str]] = None
    review_notes: Optional[str] = None
    review_tags: Optional[List[str]] = None
    exit_notes: Optional[str] = None
    exit_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    remaining_qty: Optional[Decimal] = None
    partial_realized_pnl: Optional[Decimal] = None
    unrealized_pnl: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("entry_time", "exit_time")
    def serialize_ist_datetime(self, v):
        """Serialize naive IST datetimes without timezone suffix."""
        if v is None:
            return None
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                v = v.astimezone(IST).replace(tzinfo=None)
            return v.isoformat()
        return str(v)

    @field_serializer("created_at", "updated_at")
    def serialize_system_datetime(self, v):
        """System timestamps — convert to IST and strip tz for consistent display."""
        if v is None:
            return None
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                v = v.astimezone(IST).replace(tzinfo=None)
            return v.isoformat()
        return str(v)

    @field_serializer("pnl", "entry_price", "exit_price", "quantity", "fees", "stop_price", "target_price", "r_multiple", "remaining_qty", "partial_realized_pnl", "unrealized_pnl")
    def serialize_decimal(self, v):
        if v is None:
            return None
        return str(v) if isinstance(v, Decimal) else v


class TradeListResponse(BaseModel):
    total: int
    items: List[TradeResponse]


class OpenLiveTradeResponse(BaseModel):
    """Lightweight open-trade payload for the live dashboard."""
    id: int
    symbol: str
    entry_price: Decimal
    quantity: Decimal
    remaining_qty: Decimal
    stop_price: Optional[Decimal] = None
    fees: Decimal

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("entry_price", "quantity", "remaining_qty", "stop_price", "fees")
    def serialize_decimal(self, v):
        if v is None:
            return None
        return str(v) if isinstance(v, Decimal) else v


class PyramidTradeRequest(BaseModel):
    entry_price: Decimal = Field(..., description="Entry price of the pyramid lot")
    quantity: Decimal = Field(..., description="Quantity to add")
    entry_time: Optional[datetime] = Field(None, description="Entry time for this lot (IST)")
    fees: Optional[Decimal] = Field(Decimal('0'), description="Fees for this lot")
    stop_price: Optional[Decimal] = Field(None, description="Updated stop loss for the position")

    @field_validator("entry_time")
    @classmethod
    def strip_pyramid_time(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("entry_price", "quantity", "fees", "stop_price")
    @classmethod
    def ensure_decimal(cls, v):
        return ensure_decimal(v)
