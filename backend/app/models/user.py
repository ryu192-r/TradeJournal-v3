from sqlalchemy import Column, Integer, String, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    trades = relationship("Trade", back_populates="user")
    daily_journals = relationship("DailyJournal", back_populates="user")
    accounts = relationship("Account", back_populates="user")
    coach_reviews = relationship("CoachReview", back_populates="user")
    trade_ideas = relationship("TradeIdea", back_populates="user")
    daily_workflows = relationship("DailyWorkflow", back_populates="user")
    weekly_reviews = relationship("WeeklyReview", back_populates="user")
    monthly_reviews = relationship("MonthlyReview", back_populates="user")
    market_snapshots = relationship("MarketSnapshot", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    ai_provider_setting = relationship("AIProviderSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")
