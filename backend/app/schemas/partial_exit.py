from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import Field, field_validator, field_serializer

from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal


class PartialExitCreate(BaseSchema):
    qty: Decimal = Field(..., gt=0)
    exit_price: Decimal = Field(...)
    exit_time: datetime
    realized_pnl: Optional[Decimal] = None
    r_captured: Optional[Decimal] = None
    exit_reason: Optional[str] = None
    note: Optional[str] = None

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