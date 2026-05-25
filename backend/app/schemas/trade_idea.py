from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator


from app.utils.decimal_utils import ensure_decimal as _ensure_decimal

IST = timezone(timedelta(hours=5, minutes=30))


def _strip_to_ist(v: datetime) -> datetime:
    if v.tzinfo is not None:
        v = v.astimezone(IST).replace(tzinfo=None)
    return v


class TradeIdeaBase(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Instrument symbol")
    direction: str = Field(..., description="Direction: 'LONG' or 'SHORT'")
    entry_price_target: Optional[Decimal] = Field(None, description="Target entry price")
    stop_price: Optional[Decimal] = Field(None, description="Stop loss price")
    target_price: Optional[Decimal] = Field(None, description="Target profit price")
    thesis: Optional[str] = Field(None, description="Trading thesis / reasoning")
    timeframe: Optional[str] = Field(None, description="Expected timeframe (e.g. 'Intraday', 'Swing 2-3d')")
    confidence: Optional[str] = Field(None, description="Confidence level: LOW, MEDIUM, HIGH")
    tags: Optional[str] = Field(None, description="Comma-separated tags")
    revisit_date: Optional[datetime] = Field(None, description="Remind date to revisit the idea")
    status: str = Field(default="draft", description="Status: draft, active, traded, archived")

    @field_validator("revisit_date")
    @classmethod
    def strip_ist_base(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v):
        if v not in ("LONG", "SHORT"):
            raise ValueError("Direction must be 'LONG' or 'SHORT'")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        valid = ("draft", "active", "traded", "archived")
        if v not in valid:
            raise ValueError(f"Status must be one of: {valid}")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is None:
            return v
        if v not in ("LOW", "MEDIUM", "HIGH"):
            raise ValueError("Confidence must be 'LOW', 'MEDIUM', or 'HIGH'")
        return v

    @field_validator("entry_price_target", "stop_price", "target_price", mode="plain")
    @classmethod
    def ensure_decimal(cls, v):
        return _ensure_decimal(v)


class TradeIdeaCreate(TradeIdeaBase):
    pass


class TradeIdeaUpdate(BaseModel):
    symbol: Optional[str] = None
    direction: Optional[str] = None
    entry_price_target: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    target_price: Optional[Decimal] = None
    thesis: Optional[str] = None
    timeframe: Optional[str] = None
    confidence: Optional[str] = None
    tags: Optional[str] = None
    revisit_date: Optional[datetime] = None
    status: Optional[str] = None

    @field_validator("revisit_date")
    @classmethod
    def strip_ist_update(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v):
        if v is None:
            return v
        if v not in ("LONG", "SHORT"):
            raise ValueError("Direction must be 'LONG' or 'SHORT'")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return v
        valid = ("draft", "active", "traded", "archived")
        if v not in valid:
            raise ValueError(f"Status must be one of: {valid}")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        if v is None:
            return v
        if v not in ("LOW", "MEDIUM", "HIGH"):
            raise ValueError("Confidence must be 'LOW', 'MEDIUM', or 'HIGH'")
        return v

    @field_validator("entry_price_target", "stop_price", "target_price", mode="plain")
    @classmethod
    def ensure_decimal(cls, v):
        return _ensure_decimal(v)


class TradeIdeaResponse(BaseModel):
    id: int
    symbol: str
    direction: str
    entry_price_target: Optional[str] = None
    stop_price: Optional[str] = None
    target_price: Optional[str] = None
    thesis: Optional[str] = None
    timeframe: Optional[str] = None
    confidence: Optional[str] = None
    tags: Optional[str] = None
    revisit_date: Optional[datetime] = None
    status: str
    traded_trade_id: Optional[int] = None
    triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("entry_price_target", "stop_price", "target_price", mode="plain")
    @classmethod
    def serialize_decimal(cls, v):
        if v is None:
            return None
        return str(v)


class TradeIdeaListResponse(BaseModel):
    total: int
    items: List[TradeIdeaResponse]


class ConvertToTradeRequest(BaseModel):
    """Optional overrides when converting an idea to a trade."""
    entry_price: Optional[Decimal] = Field(None, description="Actual entry price (overrides entry_price_target)")
    exit_price: Optional[Decimal] = Field(None, description="Exit price if already closed")
    quantity: Optional[Decimal] = Field(None, description="Trade quantity")
    fees: Optional[Decimal] = Field(default=Decimal("0"), description="Trading fees")
    notes: Optional[str] = Field(None, description="Notes appended to idea thesis")
    entry_time: Optional[datetime] = Field(None, description="Entry time (IST, defaults to now)")
    exit_time: Optional[datetime] = Field(None, description="Exit time if already closed (IST)")

    @field_validator("entry_time", "exit_time")
    @classmethod
    def strip_ist_convert(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("entry_price", "exit_price", "quantity", "fees", mode="plain")
    @classmethod
    def ensure_decimal(cls, v):
        return _ensure_decimal(v)


class ConvertToTradeResponse(BaseModel):
    idea: TradeIdeaResponse
    trade_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
