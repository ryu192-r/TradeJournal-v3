"""Authentication dependency: extract current user from JWT."""

from fastapi import Depends, HTTPException, status, Cookie, Header
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.trade import Trade
from app.models.account import Account
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
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(payload['sub'])).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
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


# ── Scoped query helpers ──


def get_user_trade(db: Session, trade_id: int, user_id: int) -> Optional[Trade]:
    return db.query(Trade).filter(Trade.id == trade_id, Trade.user_id == user_id).first()


def get_user_trade_or_404(db: Session, trade_id: int, user_id: int) -> Trade:
    trade = get_user_trade(db, trade_id, user_id)
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


def get_user_account(db: Session, account_id: int, user_id: int) -> Optional[Account]:
    return db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()


def get_user_account_or_404(db: Session, account_id: int, user_id: int) -> Account:
    account = get_user_account(db, account_id, user_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def scoped_trade_query(db: Session, user_id: int):
    """Return a scoped base query for trades belonging to user_id."""
    return db.query(Trade).filter(Trade.user_id == user_id)


def scoped_account_query(db: Session, user_id: int):
    """Return a scoped base query for accounts belonging to user_id."""
    return db.query(Account).filter(Account.user_id == user_id)
