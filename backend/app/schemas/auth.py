"""Authentication request/response schemas."""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.schemas.base import BaseSchema


class UserRegister(BaseSchema):
    email: EmailStr
    full_name: str
    password: str


class UserLogin(BaseSchema):
    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseSchema):
    refresh_token: str


class RefreshResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseSchema):
    current_password: str
    new_password: str


class UserResponse(BaseSchema):
    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
