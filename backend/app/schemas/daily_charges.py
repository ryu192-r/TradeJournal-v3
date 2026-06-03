from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import Field, field_validator, field_serializer
from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal


def _ensure_decimal(v):
    if v is None:
        return Decimal("0")
    return ensure_decimal(v)


class DailyChargesBase(BaseSchema):
    trade_date: date = Field(..., description="Trading date (YYYY-MM-DD)")
    broker: Optional[str] = Field(None, max_length=100)
    account_ref: Optional[str] = Field(None, max_length=100)
    contract_note_ref: Optional[str] = Field(None, max_length=100)
    brokerage: Decimal = Field(default=Decimal("0"), ge=0)
    stt: Decimal = Field(default=Decimal("0"), ge=0)
    exchange_txn_charges: Decimal = Field(default=Decimal("0"), ge=0)
    sebi_charges: Decimal = Field(default=Decimal("0"), ge=0)
    stamp_duty: Decimal = Field(default=Decimal("0"), ge=0)
    gst: Decimal = Field(default=Decimal("0"), ge=0)
    clearing_charges: Decimal = Field(default=Decimal("0"), ge=0)
    other_charges: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("brokerage", "stt", "exchange_txn_charges", "sebi_charges", "stamp_duty", "gst", "clearing_charges", "other_charges", mode="before")
    @classmethod
    def coerce_charges(cls, v):
        return _ensure_decimal(v)


class DailyChargesCreate(DailyChargesBase):
    pass


class DailyChargesUpdate(BaseSchema):
    broker: Optional[str] = Field(None, max_length=100)
    account_ref: Optional[str] = Field(None, max_length=100)
    contract_note_ref: Optional[str] = Field(None, max_length=100)
    brokerage: Optional[Decimal] = Field(None, ge=0)
    stt: Optional[Decimal] = Field(None, ge=0)
    exchange_txn_charges: Optional[Decimal] = Field(None, ge=0)
    sebi_charges: Optional[Decimal] = Field(None, ge=0)
    stamp_duty: Optional[Decimal] = Field(None, ge=0)
    gst: Optional[Decimal] = Field(None, ge=0)
    clearing_charges: Optional[Decimal] = Field(None, ge=0)
    other_charges: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("brokerage", "stt", "exchange_txn_charges", "sebi_charges", "stamp_duty", "gst", "clearing_charges", "other_charges", mode="before")
    @classmethod
    def coerce_charges(cls, v):
        if v is None:
            return None
        return ensure_decimal(v)


class DailyChargesRead(DailyChargesBase):
    id: int
    total_charges: Decimal
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer("total_charges", "brokerage", "stt", "exchange_txn_charges", "sebi_charges", "stamp_duty", "gst", "clearing_charges", "other_charges")
    def serialize_money(self, v: Decimal) -> str:
        return str(v)

    @field_serializer("trade_date")
    def serialize_date(self, v: date) -> str:
        return v.isoformat()


class DailyChargesListResponse(BaseSchema):
    total: int
    items: list[DailyChargesRead]


class DailyChargesDaySummary(BaseSchema):
    trade_date: str
    gross_realized_pnl: Optional[str] = None
    charges_recorded: bool
    total_charges: Optional[str] = None
    net_realized_pnl: Optional[str] = None
    trade_count: int = 0


class DailyChargesSummary(BaseSchema):
    start_date: str
    end_date: str
    gross_realized_pnl: Optional[str] = None
    total_charges: Optional[str] = None
    net_realized_pnl: Optional[str] = None
    charges_recorded_days: int = 0
    trading_days: int = 0
    missing_charge_days: int = 0
    days: list[DailyChargesDaySummary]
