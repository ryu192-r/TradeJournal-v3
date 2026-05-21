from sqlalchemy import Column, Integer, String, Text, Date, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from app.models.base import Base


class DailyWorkflow(Base):
    __tablename__ = "daily_workflows"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True, index=True)
    phase = Column(String(20), nullable=False, default="pre_market")
    pre_market_done = Column(Boolean, default=False)
    execution_done = Column(Boolean, default=False)
    review_done = Column(Boolean, default=False)
    behavior_done = Column(Boolean, default=False)
    checklist_items = Column(JSON, default=list)
    watchlist_symbols = Column(JSON, default=list)
    pre_market_notes = Column(Text, nullable=True)
    intraday_notes = Column(Text, nullable=True)
    post_market_notes = Column(Text, nullable=True)
    mood_rating = Column(Integer, nullable=True)
    discipline_rating = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"

    id = Column(Integer, primary_key=True, index=True)
    week_start = Column(Date, nullable=False, unique=True, index=True)
    week_end = Column(Date, nullable=False)
    total_trades = Column(Integer, default=0)
    total_pnl = Column(String, default="0")
    win_rate = Column(String, nullable=True)
    best_trade_id = Column(Integer, nullable=True)
    worst_trade_id = Column(Integer, nullable=True)
    top_setup = Column(String, nullable=True)
    rules_followed = Column(Integer, default=0)
    rules_violated = Column(Integer, default=0)
    key_lessons = Column(Text, nullable=True)
    discipline_score = Column(String, nullable=True)
    emotion_summary = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MonthlyReview(Base):
    __tablename__ = "monthly_reviews"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String(7), nullable=False, unique=True, index=True)
    total_trades = Column(Integer, default=0)
    total_pnl = Column(String, default="0")
    win_rate = Column(String, nullable=True)
    profit_factor = Column(String, nullable=True)
    avg_r = Column(String, nullable=True)
    best_setup = Column(String, nullable=True)
    worst_setup = Column(String, nullable=True)
    best_day = Column(String, nullable=True)
    worst_day = Column(String, nullable=True)
    discipline_avg = Column(String, nullable=True)
    behavioral_patterns = Column(JSON, nullable=True)
    rule_compliance_rate = Column(String, nullable=True)
    capital_growth_pct = Column(String, nullable=True)
    goals_met = Column(JSON, nullable=True)
    next_month_goals = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())