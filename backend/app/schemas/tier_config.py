from typing import Optional
from pydantic import BaseModel, Field
from decimal import Decimal


class TierConfigResponse(BaseModel):
    id: int
    name: str
    min_amount: Decimal
    max_amount: Optional[Decimal] = None
    sort_order: int = 0


class TierConfigItem(BaseModel):
    name: str
    min_amount: Decimal
    max_amount: Optional[Decimal] = None
    sort_order: int = 0


class TierConfigListResponse(BaseModel):
    items: list[TierConfigResponse]
