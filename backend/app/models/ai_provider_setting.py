from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class AIProviderSetting(Base):
    __tablename__ = "ai_provider_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    provider = Column(String(50), nullable=False, default="ollama_cloud")
    base_url = Column(String(500), nullable=False, default="")
    api_key = Column(String(4096), nullable=True)
    model = Column(String(200), nullable=False, default="qwen2.5:latest")
    timeout = Column(Float, nullable=False, default=60.0)
    max_retries = Column(Integer, nullable=False, default=3)
    temperature = Column(Float, nullable=False, default=0.3)
    personality = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="ai_provider_setting")
