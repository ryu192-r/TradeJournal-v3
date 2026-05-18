from datetime import datetime
from typing import Optional, List
from pydantic import Field, field_validator

from app.schemas.base import BaseSchema


VALID_EMOTIONS = {'calm', 'fearful', 'euphoric', 'revenge', 'fomo', 'hesitant', 'disciplined'}


class EmotionLogCreate(BaseSchema):
    emotion: str = Field(...)
    confidence: Optional[int] = Field(None, ge=1, le=10)
    stress: Optional[int] = Field(None, ge=1, le=10)
    conviction: Optional[int] = Field(None, ge=1, le=10)
    patience: Optional[int] = Field(None, ge=1, le=10)
    focus: Optional[int] = Field(None, ge=1, le=10)
    note: Optional[str] = None
    timestamp: Optional[datetime] = None

    @field_validator("emotion")
    @classmethod
    def validate_emotion(cls, v):
        if v not in VALID_EMOTIONS:
            raise ValueError(f"emotion must be one of: {', '.join(sorted(VALID_EMOTIONS))}")
        return v


class EmotionLogResponse(BaseSchema):
    id: int
    trade_id: int
    emotion: str
    confidence: Optional[int] = None
    stress: Optional[int] = None
    conviction: Optional[int] = None
    patience: Optional[int] = None
    focus: Optional[int] = None
    note: Optional[str] = None
    timestamp: datetime


class EmotionLogListResponse(BaseSchema):
    items: List[EmotionLogResponse]