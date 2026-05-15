"""Stop history schemas for tracking stop loss adjustments."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import Field, field_validator, field_serializer

from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal


STOP_TYPES = {"initial", "manual", "breakeven", "trailing", "target"}


class StopHistoryCreate(BaseSchema):
    stop_type: str = Field(..., description="Type: initial, manual, breakeven, trailing, target")
    price: Decimal = Field(..., description="Stop price at this point")
    timestamp: datetime = Field(..., description="When the stop was set")

    @field_validator("price", mode="before")
    @classmethod
    def validate_price(cls, v):
        return ensure_decimal(v)

    @field_validator("stop_type")
    @classmethod
    def validate_stop_type(cls, v):
        if v not in STOP_TYPES:
            raise ValueError(f"stop_type must be one of: {', '.join(sorted(STOP_TYPES))}")
        return v


class StopHistoryResponse(BaseSchema):
    id: int
    trade_id: int
    stop_type: str
    price: Decimal
    timestamp: datetime

    @field_serializer("price")
    def serialize_price(self, v: Decimal) -> str:
        return str(v)


class StopHistoryListResponse(BaseSchema):
    items: List[StopHistoryResponse]
