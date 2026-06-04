from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List
from pydantic import Field, field_validator, field_serializer

from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal

IST = timezone(timedelta(hours=5, minutes=30))


def _strip_to_ist(v: datetime) -> datetime:
    if v.tzinfo is not None:
        v = v.astimezone(IST).replace(tzinfo=None)
    return v


class PartialExitCreate(BaseSchema):
    qty: Decimal = Field(..., gt=0)
    exit_price: Decimal = Field(..., gt=0)
    exit_time: datetime
    realized_pnl: Optional[Decimal] = None
    r_captured: Optional[Decimal] = None
    exit_reason: Optional[str] = None
    note: Optional[str] = None

    @field_validator("exit_time")
    @classmethod
    def strip_ist(cls, v):
        return _strip_to_ist(v)

    @field_validator("qty", "exit_price", mode="before")
    @classmethod
    def ensure_dec(cls, v):
        return ensure_decimal(v)


class PartialExitResponse(BaseSchema):
    id: int
    trade_id: int
    qty: Decimal
    exit_price: Decimal
    exit_time: datetime
    realized_pnl: Optional[Decimal] = None
    r_captured: Optional[Decimal] = None
    exit_reason: Optional[str] = None
    note: Optional[str] = None

    @field_serializer("qty", "exit_price", "realized_pnl", "r_captured")
    def serialize_dec(self, v: Optional[Decimal]) -> Optional[str]:
        return str(v) if v is not None else None


class PartialExitListResponse(BaseSchema):
    items: List[PartialExitResponse]
    remaining_qty: str = "0"
