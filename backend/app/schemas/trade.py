from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator, field_serializer

from app.utils.decimal_utils import ensure_decimal


class TradeBase(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Instrument symbol")
    direction: str = Field(default="LONG", description="Always LONG for Indian equities")
    entry_price: Decimal = Field(..., description="Entry price per unit")
    exit_price: Optional[Decimal] = Field(None, description="Exit price per unit")
    quantity: Decimal = Field(..., description="Quantity of shares/contracts")
    entry_time: datetime = Field(..., description="Timestamp of entry")
    exit_time: Optional[datetime] = Field(None, description="Timestamp of exit")
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

    # Keep as strings to avoid precision loss
    @field_validator("entry_price", "exit_price", "quantity", "fees", "stop_price", "target_price", "r_multiple")
    @classmethod
    def ensure_decimal(cls, v):
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

    model_config = ConfigDict(from_attributes=True)

    # Do NOT serialize Decimal to float — keep as string in JSON
    @field_serializer("pnl", "entry_price", "exit_price", "quantity", "fees", "stop_price", "target_price", "r_multiple")
    def serialize_decimal(self, v):
        if v is None:
            return None
        return str(v) if isinstance(v, Decimal) else v


class TradeListResponse(BaseModel):
    total: int
    items: List[TradeResponse]


class PyramidTradeRequest(BaseModel):
    entry_price: Decimal = Field(..., description="Entry price of the pyramid lot")
    quantity: Decimal = Field(..., description="Quantity to add")
    entry_time: Optional[datetime] = Field(None, description="Entry time for this lot")
    fees: Optional[Decimal] = Field(Decimal('0'), description="Fees for this lot")
    stop_price: Optional[Decimal] = Field(None, description="Updated stop loss for the position")

    @field_validator("entry_price", "quantity", "fees", "stop_price")
    @classmethod
    def ensure_decimal(cls, v):
        return ensure_decimal(v)
