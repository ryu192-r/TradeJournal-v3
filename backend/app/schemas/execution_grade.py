from datetime import datetime
from typing import Optional
from pydantic import Field, field_validator

from app.schemas.base import BaseSchema


VALID_GRADES = {'A', 'B', 'C', 'D', 'F'}


def _validate_grade(v: Optional[str]) -> Optional[str]:
    if v is not None and v not in VALID_GRADES:
        raise ValueError(f"grade must be one of: {', '.join(sorted(VALID_GRADES))}")
    return v


class ExecutionGradeCreate(BaseSchema):
    entry_quality: Optional[str] = None
    sizing_quality: Optional[str] = None
    stop_quality: Optional[str] = None
    patience: Optional[str] = None
    rule_adherence: Optional[str] = None
    exit_quality: Optional[str] = None
    overall_grade: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("entry_quality", "sizing_quality", "stop_quality", "patience", "rule_adherence", "exit_quality", "overall_grade", mode="before")
    @classmethod
    def validate_grades(cls, v):
        return _validate_grade(v)


class ExecutionGradeUpdate(BaseSchema):
    entry_quality: Optional[str] = None
    sizing_quality: Optional[str] = None
    stop_quality: Optional[str] = None
    patience: Optional[str] = None
    rule_adherence: Optional[str] = None
    exit_quality: Optional[str] = None
    overall_grade: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("entry_quality", "sizing_quality", "stop_quality", "patience", "rule_adherence", "exit_quality", "overall_grade", mode="before")
    @classmethod
    def validate_grades(cls, v):
        return _validate_grade(v)


class ExecutionGradeResponse(BaseSchema):
    id: int
    trade_id: int
    entry_quality: Optional[str] = None
    sizing_quality: Optional[str] = None
    stop_quality: Optional[str] = None
    patience: Optional[str] = None
    rule_adherence: Optional[str] = None
    exit_quality: Optional[str] = None
    overall_grade: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None