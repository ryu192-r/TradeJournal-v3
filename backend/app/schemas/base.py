from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import Optional


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class TimestampSchema(BaseSchema):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None