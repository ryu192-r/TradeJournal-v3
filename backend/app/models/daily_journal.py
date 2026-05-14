from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Numeric, CheckConstraint, ForeignKey, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class DailyJournal(Base):
    """Daily journal entry capturing pre/post market reflection and self-assessment."""

    __tablename__ = 'daily_journals'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, unique=True, index=True, nullable=False)

    # Pre/post market notes
    pre_trade_notes = Column(Text, nullable=True)
    post_trade_notes = Column(Text, nullable=True)

    # Auto-aggregated metrics from day's trades
    trade_count = Column(Integer, nullable=True)
    total_pnl = Column(Numeric(precision=18, scale=8), nullable=True)
    avg_r_multiple = Column(Numeric(precision=10, scale=4), nullable=True)
    win_rate = Column(Numeric(precision=6, scale=4), nullable=True)  # percentage 0-100

    # Trader self-assessment
    mood_rating = Column(Integer, nullable=True)  # 1-5
    mood_notes = Column(Text, nullable=True)
    rules_followed = Column(String(500), nullable=True)
    rules_violated = Column(String(500), nullable=True)
    lessons_learned = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Foreign keys
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    # Relationships
    user = relationship('User', back_populates='daily_journals')

    __table_args__ = (
        CheckConstraint(
            'mood_rating IS NULL OR (mood_rating >= 1 AND mood_rating <= 5)',
            name='ck_daily_journals_mood_rating',
        ),
    )

    def __repr__(self) -> str:
        return f"<DailyJournal(id={self.id}, date={self.date})>"
