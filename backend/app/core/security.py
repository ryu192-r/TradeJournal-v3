"""Password hashing and JWT token utilities.

Uses bcrypt directly instead of passlib to avoid bcrypt 4.x / passlib 1.7.4
incompatibility on Python 3.12+ (see https://github.com/pyca/bcrypt/issues/671).
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4
import hashlib
import bcrypt

from jose import jwt, JWTError

from app.core.config import settings


# ── Password hashing ────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"),
                          hashed_password.encode("utf-8") if isinstance(hashed_password, str)
                          else hashed_password)


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── JTI & token hashing ─────────────────────────────────────────

def generate_jti() -> str:
    return uuid4().hex


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ── JWT token helpers ────────────────────────────────────────────

def decode_token(token: str, expected_type: str = "access") -> dict:
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise JWTError(
            f"Invalid token type: expected '{expected_type}', got '{payload.get('type')}'"
        )
    return payload


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    jti = generate_jti()
    to_encode.update({"exp": expire, "type": "refresh", "jti": jti})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Refresh token DB helpers ─────────────────────────────────────

from sqlalchemy.orm import Session
from app.models.refresh_token import RefreshToken


def store_refresh_token(
    db: Session,
    user_id: int,
    raw_token: str,
    jti: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> RefreshToken:
    payload = decode_token(raw_token, expected_type="refresh")
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        jti=jti,
        issued_at=datetime.now(timezone.utc),
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(row)
    db.flush()
    return row


def verify_refresh_token_exists_and_active(
    db: Session, jti: str, user_id: int, raw_token: str
) -> RefreshToken:
    row = db.query(RefreshToken).filter(
        RefreshToken.jti == jti,
        RefreshToken.user_id == user_id,
    ).first()
    if row is None:
        raise JWTError("Refresh token not found")
    if row.token_hash != hash_token(raw_token):
        raise JWTError("Refresh token hash mismatch")
    if row.revoked_at is not None:
        raise JWTError("Refresh token revoked")
    now = datetime.now(timezone.utc)
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise JWTError("Refresh token expired")
    return row


def revoke_refresh_token(db: Session, jti: str) -> None:
    row = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if row and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)


def revoke_all_user_refresh_tokens(db: Session, user_id: int) -> int:
    now = datetime.now(timezone.utc)
    result = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None,
    ).update({"revoked_at": now})
    return result