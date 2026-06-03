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
    stop_price: Optional[Decimal] = Field(None, description="Current/live stop loss price")
    original_stop_price: Optional[Decimal] = Field(None, description="Original planned stop loss (risk truth)")
    stop_loss_status: Optional[str] = Field(None, description="original, breakeven, trailing, manual, risk_free, profit_locked")
    target_price: Optional[Decimal] = Field(None, description="Target profit price")
    r_multiple: Optional[Decimal] = Field(None, description="Risk multiple")
    exit_reason: Optional[str] = Field(None, description="Exit reason: stop_loss, target, manual, trailing, system")
    import_source: Optional[str] = Field(None, description="Source of import (broker_csv, dhan_sync, dhan_webhook)")
    import_fingerprint: Optional[str] = Field(None, description="SHA-256 fingerprint for deduplication")
    external_order_id: Optional[str] = Field(None, description="Broker order/trade ID")
    exchange: Optional[str] = Field("UNKNOWN", description="NSE, BSE, or UNKNOWN")
    segment: Optional[str] = Field("UNKNOWN", description="EQUITY, EQUITY_FNO, COMMODITY, CURRENCY, or UNKNOWN")
    product_type: Optional[str] = Field("UNKNOWN", description="DELIVERY, INTRADAY, MTF, FNO, or UNKNOWN")
    executed_order_count: Optional[int] = Field(None, description="Broker executed order count override", ge=1)

    @field_validator("exchange")
    @classmethod
    def validate_exchange(cls, v):
        if v is None:
            return "UNKNOWN"
        allowed = {"NSE", "BSE", "UNKNOWN"}
        if v not in allowed:
            raise ValueError(f"exchange must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("segment")
    @classmethod
    def validate_segment(cls, v):
        if v is None:
            return "UNKNOWN"
        allowed = {"EQUITY", "EQUITY_FNO", "COMMODITY", "CURRENCY", "UNKNOWN"}
        if v not in allowed:
            raise ValueError(f"segment must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v):
        if v is None:
            return "UNKNOWN"
        allowed = {"DELIVERY", "INTRADAY", "MTF", "FNO", "UNKNOWN"}
        if v not in allowed:
            raise ValueError(f"product_type must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v):
        if v != "LONG":
            raise ValueError("Direction must be 'LONG' — only long positions supported")
        return v

    @field_validator("stop_loss_status")
    @classmethod
    def validate_stop_loss_status(cls, v):
        if v is None:
            return v
        allowed = {"original", "breakeven", "trailing", "manual", "risk_free", "profit_locked"}
        if v not in allowed:
            raise ValueError(f"stop_loss_status must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("entry_time", "exit_time")
    @classmethod
    def strip_to_ist(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    # Keep as strings to avoid precision loss
    @field_validator("entry_price", "exit_price", "quantity", "fees", "stop_price", "original_stop_price", "target_price", "r_multiple")
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
    original_stop_price: Optional[Decimal] = None
    stop_loss_status: Optional[str] = None
    target_price: Optional[Decimal] = None
    r_multiple: Optional[Decimal] = None
    chart_images: Optional[List[str]] = None
    review_notes: Optional[str] = None
    review_tags: Optional[List[str]] = None
    exit_notes: Optional[str] = None
    exit_reason: Optional[str] = None
    exchange: Optional[str] = None
    segment: Optional[str] = None
    product_type: Optional[str] = None
    executed_order_count: Optional[int] = Field(None, ge=1)

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v):
        if v is None:
            return v
        if v != "LONG":
            raise ValueError("Direction must be 'LONG' — only long positions supported")
        return v

    @field_validator("stop_loss_status")
    @classmethod
    def validate_stop_loss_status_update(cls, v):
        if v is None:
            return v
        allowed = {"original", "breakeven", "trailing", "manual", "risk_free", "profit_locked"}
        if v not in allowed:
            raise ValueError(f"stop_loss_status must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("entry_time", "exit_time")
    @classmethod
    def strip_to_ist_update(cls, v):
        if v is None:
            return v
        return _strip_to_ist(v)

    @field_validator("entry_price", "exit_price", "quantity", "fees", "stop_price", "original_stop_price", "target_price", "r_multiple")
    @classmethod
    def ensure_decimal(cls, v):
        return ensure_decimal(v)

    @field_validator("exchange")
    @classmethod
    def validate_exchange_update(cls, v):
        if v is None:
            return v
        allowed = {"NSE", "BSE", "UNKNOWN"}
        if v not in allowed:
            raise ValueError(f"exchange must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("segment")
    @classmethod
    def validate_segment_update(cls, v):
        if v is None:
            return v
        allowed = {"EQUITY", "EQUITY_FNO", "COMMODITY", "CURRENCY", "UNKNOWN"}
        if v not in allowed:
            raise ValueError(f"segment must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("product_type")
    @classmethod
    def validate_product_type_update(cls, v):
        if v is None:
            return v
        allowed = {"DELIVERY", "INTRADAY", "MTF", "FNO", "UNKNOWN"}
        if v not in allowed:
            raise ValueError(f"product_type must be one of: {', '.join(sorted(allowed))}")
        return v


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
    original_stop_price: Optional[Decimal] = None
    current_stop_price: Optional[Decimal] = None
    stop_loss_status: Optional[str] = None
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
    weighted_avg_exit_price: Optional[Decimal] = None
    exchange: str = "UNKNOWN"
    segment: str = "UNKNOWN"
    product_type: str = "UNKNOWN"
    executed_order_count: Optional[int] = None

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

    @field_serializer("pnl", "entry_price", "exit_price", "quantity", "fees", "stop_price", "original_stop_price", "current_stop_price", "target_price", "r_multiple", "remaining_qty", "partial_realized_pnl", "unrealized_pnl", "weighted_avg_exit_price")
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
    original_stop_price: Optional[Decimal] = None
    current_stop_price: Optional[Decimal] = None
    stop_loss_status: Optional[str] = None
    fees: Decimal

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("entry_price", "quantity", "remaining_qty", "stop_price", "original_stop_price", "current_stop_price", "fees")
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
