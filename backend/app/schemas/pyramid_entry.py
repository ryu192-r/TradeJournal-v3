from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_serializer


class PyramidEntryCreate(BaseModel):
    entry_price: Decimal
    quantity: Decimal
    entry_time: Optional[datetime] = None
    fees: Optional[Decimal] = None


class PyramidEntryUpdate(BaseModel):
    entry_price: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    entry_time: Optional[datetime] = None
    fees: Optional[Decimal] = None


class PyramidEntryResponse(BaseModel):
    id: int
    trade_id: int
    entry_price: Decimal
    quantity: Decimal
    entry_time: datetime
    fees: Decimal
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("entry_price", "quantity", "fees")
    def serialize_decimal(self, v: Decimal) -> str:
        return str(v)


class PyramidEntryListResponse(BaseModel):
    items: list[PyramidEntryResponse]
