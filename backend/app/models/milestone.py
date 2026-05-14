from sqlalchemy import Column, Integer, String, DateTime, Numeric, Date, Boolean, func
from app.models.base import Base
from decimal import Decimal


class Milestone(Base):
    __tablename__ = 'milestones'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    target_date = Column(Date, nullable=False)
    target_amount = Column(Numeric(precision=18, scale=8))
    achieved = Column(Boolean, default=False)
    achieved_date = Column(Date)
    notes = Column(String(500))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)