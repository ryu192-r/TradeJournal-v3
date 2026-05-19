"""Coach review model for storing AI-generated trading insights."""
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Index
from sqlalchemy.sql import func
from app.models.base import Base


class CoachReview(Base):
    __tablename__ = 'coach_reviews'
    __table_args__ = (
        Index('ix_coach_reviews_type_created', 'review_type', 'created_at'),
        Index('ix_coach_reviews_period', 'period_start', 'period_end'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Review metadata
    review_type = Column(String(50), nullable=False)  # daily, weekly, insight, answer, trade_review
    
    # AI-generated content
    content = Column(Text, nullable=False)
    
    # Analysis period
    period_start = Column(DateTime(timezone=True), nullable=True)
    period_end = Column(DateTime(timezone=True), nullable=True)
    
    # Trade context
    trade_ids = Column(JSON, default=list)  # IDs of trades analyzed
    summary_stats = Column(JSON, nullable=True)  # PnL stats, win rate
    detected_patterns = Column(JSON, default=list)  # Patterns identified
    
    # Technical metadata
    model_used = Column(String(100), nullable=True)  # Ollama model name
    prompt_template = Column(String(100), nullable=True)  # Which template used
    
    # Timestamps — explicitly timezone-aware UTC
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.timezone('UTC', func.now())
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.timezone('UTC', func.now()),
        onupdate=func.timezone('UTC', func.now())
    )
