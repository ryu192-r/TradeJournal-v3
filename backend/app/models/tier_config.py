from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TierConfig(Base):
    __tablename__ = "tier_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    min_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )
