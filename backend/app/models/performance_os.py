from sqlalchemy import Column, Integer, String, Text, Date, DateTime, JSON, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class DailyWorkflow(Base):
    __tablename__ = "daily_workflows"
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_daily_workflows_user_date'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
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

    user = relationship("User", back_populates="daily_workflows")


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"
    __table_args__ = (
        UniqueConstraint('user_id', 'week_start', name='uq_weekly_reviews_user_week'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    week_start = Column(Date, nullable=False, index=True)
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

    user = relationship("User", back_populates="weekly_reviews")


class MonthlyReview(Base):
    __tablename__ = "monthly_reviews"
    __table_args__ = (
        UniqueConstraint('user_id', 'month', name='uq_monthly_reviews_user_month'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    month = Column(String(7), nullable=False, index=True)
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

    user = relationship("User", back_populates="monthly_reviews")


# ────────────────────────── Improvement Action ──────────────────────────
# Core unit of the Trading Improvement Loop (ADR-025). An Improvement Action is
# a trackable behavior change with supporting evidence, a due trading session,
# current status, and follow-up result. The Daily Focus Action is the single
# Improvement Action selected (is_daily_focus=True) for a given due_session date.

# Allowed lifecycle states — tracks behavior adherence, not task completion.
IMPROVEMENT_ACTION_STATUSES = ("suggested", "active", "kept", "broken", "retired")

# Verification shapes for Verifiable Behavior Contracts. "manual_check" denotes a
# Manual-Check Action whose adherence depends on user confirmation.
IMPROVEMENT_CONTRACT_TYPES = (
    "no_early_entry",
    "max_trades",
    "cooldown_after_loss",
    "stop_not_widened",
    "manual_check",
)


class ImprovementAction(Base):
    __tablename__ = "improvement_actions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="suggested")
    # Trading date on which this action is tested.
    due_session = Column(Date, nullable=True, index=True)
    # Verifiable Behavior Contract shape + structured params.
    contract_type = Column(String(40), nullable=False, default="manual_check")
    contract_params = Column(JSON, default=dict)
    # Source Evidence (journal dates, trades, grades, rule violations, patterns).
    source_evidence = Column(JSON, default=dict)
    # True when this is the Daily Focus Action for its due_session date.
    is_daily_focus = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="improvement_actions")
