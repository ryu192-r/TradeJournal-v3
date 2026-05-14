from pydantic import BaseModel, EmailStr
from app.schemas.base import BaseSchema
from typing import Optional
from datetime import datetime


class UserBase(BaseSchema):
    email: str
    full_name: str


class UserCreate(UserBase):
    pass


class UserUpdate(BaseSchema):
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserInDBBase(UserBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class User(UserInDBBase):
    pass


class UserInDB(UserInDBBase):
    pass