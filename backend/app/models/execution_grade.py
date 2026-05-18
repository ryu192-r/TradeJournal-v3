from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class ExecutionGrade(Base):
    __tablename__ = 'execution_grades'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False, unique=True)
    entry_quality = Column(String(1))
    sizing_quality = Column(String(1))
    stop_quality = Column(String(1))
    patience = Column(String(1))
    rule_adherence = Column(String(1))
    exit_quality = Column(String(1))
    overall_grade = Column(String(1))
    notes = Column(String(1000))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    trade = relationship("Trade", back_populates="execution_grade")


VALID_GRADES = {'A', 'B', 'C', 'D', 'F'}