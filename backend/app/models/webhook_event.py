"""Track processed webhook event_ids for replay dedup."""
from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint
from .base import Base
from datetime import datetime, timezone


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    event_id = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_webhook_events_user_event"),
    )
