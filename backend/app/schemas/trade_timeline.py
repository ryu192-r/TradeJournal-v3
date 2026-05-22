from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import Field, field_validator, field_serializer

from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal


class TimelineEventCreate(BaseSchema):
    event_type: str = Field(..., description="trade_opened|stop_updated|target_updated|pyramided|partial_exit|note_added|conviction_changed|emotion_logged|trade_closed|trade_deleted|review_added")
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    note: Optional[str] = None
    emotion: Optional[str] = None
    confidence: Optional[int] = Field(None, ge=1, le=10)
    timestamp: Optional[datetime] = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v):
        from app.models.trade_timeline import VALID_EVENT_TYPES
        if v not in VALID_EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}")
        return v


class TimelineEventResponse(BaseSchema):
    id: int
    trade_id: int
    event_type: str
    timestamp: datetime
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    note: Optional[str] = None
    emotion: Optional[str] = None
    confidence: Optional[int] = None


class TimelineListResponse(BaseSchema):
    items: List[TimelineEventResponse]
