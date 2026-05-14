from sqlalchemy import Column, Integer, String, ForeignKey
from app.models.base import Base


class Tag(Base):
    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(200))


class TradeTag(Base):
    __tablename__ = 'trade_tags'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False)
    tag_id = Column(Integer, ForeignKey('tags.id'), nullable=False)