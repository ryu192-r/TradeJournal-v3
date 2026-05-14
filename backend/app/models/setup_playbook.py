from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Index, event
from sqlalchemy.sql import func
from app.models.base import Base


class SetupPlaybook(Base):
    __tablename__ = 'setup_playbook'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text)
    tactics = Column(JSON, default=list)  # list of tactic dicts: {name, win_rate, avg_r, conditions}
    ideal_conditions = Column(JSON, default=list)  # list of condition strings
    risk_profile = Column(JSON, default=dict)  # dict: {max_risk_pct, position_sizing_rule, stop_style}
    rules = Column(JSON, default=list)  # list of rule strings for the rules engine
    win_rate = Column(String(20))  # Historical win rate (e.g. "62.5%"), updated by analytics
    avg_r = Column(String(20))  # Average R-multiple, updated by analytics
    trade_count = Column(Integer, default=0)  # Number of trades using this setup
    is_active = Column(String(10), default="active")  # active / archived
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


Index('ix_setup_playbook_is_active', SetupPlaybook.is_active)
