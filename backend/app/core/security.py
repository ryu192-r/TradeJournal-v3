"""Password hashing and JWT token utilities.

Uses bcrypt directly instead of passlib to avoid bcrypt 4.x / passlib 1.7.4
incompatibility on Python 3.12+ (see https://github.com/pyca/bcrypt/issues/671).
"""

from datetime import datetime, timedelta
from typing import Optional
import bcrypt

from app.core.config import settings


# ── Password hashing ────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against the stored hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"),
                          hashed_password.encode("utf-8") if isinstance(hashed_password, str)
                          else hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain text password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── JWT token helper ────────────────────────────────────────────
from jose import jwt, JWTError


def decode_token(token: str, expected_type: str = "access") -> dict:
    """Decode JWT, verify type claim, and return payload."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise JWTError(
            f"Invalid token type: expected '{expected_type}', got '{payload.get('type')}'"
        )
    return payload


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
