from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, ForeignKey, UniqueConstraint, func, Text
from sqlalchemy.orm import relationship
from decimal import Decimal
from app.models.base import Base


class DailyCharges(Base):
    __tablename__ = "daily_charges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    broker = Column(String(100), nullable=True)
    account_ref = Column(String(100), nullable=True)
    contract_note_ref = Column(String(100), nullable=True)

    # Individual charge components
    brokerage = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    stt = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    exchange_txn_charges = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    sebi_charges = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    stamp_duty = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    gst = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    clearing_charges = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    other_charges = Column(Numeric(precision=18, scale=8), default=Decimal("0"))

    total_charges = Column(Numeric(precision=18, scale=8), default=Decimal("0"))
    entry_mode = Column(String(20), default="breakdown")
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="daily_charges")

    __table_args__ = (
        UniqueConstraint("user_id", "trade_date", name="uq_daily_charges_user_date"),
    )
