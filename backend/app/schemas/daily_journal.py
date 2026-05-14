"""DailyJournal Pydantic schemas.

Rules:
- Create/Update schemas use Optional with no forced defaults for nullable columns.
- Response is standalone (not inheriting from Base) to avoid field_validator running
  on ORM model attributes.
- Monetary values serialize as strings in response; raw in requests.
- Response includes timestamps (created_at/updated_at).
"""
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class DailyJournalCreate(BaseModel):
    date: date
    pre_trade_notes: str | None = None
    post_trade_notes: str | None = None
    trade_count: int | None = None
    total_pnl: Decimal | None = None
    avg_r_multiple: Decimal | None = None
    win_rate: Decimal | None = Field(None, ge=0, le=100)
    mood_rating: int | None = Field(None, ge=1, le=5)
    mood_notes: str | None = None
    rules_followed: str | None = None
    rules_violated: str | None = None
    lessons_learned: str | None = None


class DailyJournalUpdate(BaseModel):
    pre_trade_notes: str | None = None
    post_trade_notes: str | None = None
    trade_count: int | None = None
    total_pnl: Decimal | None = None
    avg_r_multiple: Decimal | None = None
    win_rate: Decimal | None = None
    mood_rating: int | None = None
    mood_notes: str | None = None
    rules_followed: str | None = None
    rules_violated: str | None = None
    lessons_learned: str | None = None


class DailyJournalResponse(BaseModel):
    """Standalone response model — does NOT inherit from DailyJournalCreate/Base.

    This avoids the field_validator running on ORM model attributes (which would
    convert Decimals to strings, then Pydantic coerces them back — wasteful/fragile).
    """
    id: int
    date: date
    pre_trade_notes: str | None = None
    post_trade_notes: str | None = None
    trade_count: int | None = None
    total_pnl: Decimal | None = None
    avg_r_multiple: Decimal | None = None
    win_rate: Decimal | None = None
    mood_rating: int | None = None
    mood_notes: str | None = None
    rules_followed: str | None = None
    rules_violated: str | None = None
    lessons_learned: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
