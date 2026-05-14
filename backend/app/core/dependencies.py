"""Authentication dependency: extract current user from JWT."""

from fastapi import Depends, HTTPException, status, Cookie, Header
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.core.security import decode_token


# OAuth2 scheme for Authorization: Bearer <token> headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> User:
    """Validate access token and return the current user.

    Accepts token from either:
    - Authorization: Bearer <token> header (primary)
    - access_token cookie (fallback)
    """
    auth_token = token or cookie

    if auth_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(auth_token, expected_type="access")
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(payload['sub'])).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive account",
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Alias that emphasizes the user must be active."""
    return current_user


def get_optional_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[User]:
    """Return the current user if a valid token is provided, else None.

    Use this for endpoints that work with or without authentication.
    """
    auth_token = token or cookie
    if auth_token is None:
        return None

    try:
        payload = decode_token(auth_token, expected_type="access")
    except JWTError:
        return None

    user = db.query(User).filter(User.id == int(payload['sub'])).first()
    if user is None or not user.is_active:
        return None

    return user
