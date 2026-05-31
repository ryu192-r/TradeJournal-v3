"""Authentication request/response schemas."""

from pydantic import EmailStr, field_validator
from typing import Optional
from datetime import datetime

from app.schemas.base import BaseSchema

PASSWORD_MIN_LENGTH = 8
PASSWORD_POLICY_MESSAGE = (
    "Password must be at least 8 characters and include at least one letter and one number"
)


def validate_password_strength(value: str) -> str:
    password = value or ""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if password.strip() != password or not password.strip():
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if not any(ch.isalpha() for ch in password) or not any(ch.isdigit() for ch in password):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if len(set(password)) == 1:
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return password


class UserRegister(BaseSchema):
    email: EmailStr
    full_name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class UserLogin(BaseSchema):
    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None


class RefreshRequest(BaseSchema):
    refresh_token: str


class RefreshResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None


class ChangePasswordRequest(BaseSchema):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_is_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class UserResponse(BaseSchema):
    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class LogoutRequest(BaseSchema):
    refresh_token: Optional[str] = None
