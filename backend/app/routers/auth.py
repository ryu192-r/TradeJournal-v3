"""Authentication router: register, login, refresh, change password, and profile."""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    RefreshRequest,
    RefreshResponse,
    ChangePasswordRequest,
    UserResponse,
)
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.utils.logging import get_logger

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


# ── Register ────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(body: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account and return JWT tokens.

    The user will be active by default. Returns both access and
    refresh tokens so the client can authenticate immediately.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=get_password_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info("user_registered", user_id=user.id, email=user.email)

    tokens = _build_token_pair(user)
    return TokenResponse(**tokens)


# ── Login ───────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive JWT tokens",
)
def login(body: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email/password and receive JWT tokens.

    Returns 401 if the credentials are invalid.
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        logger.warning("login_failed", email=body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    logger.info("user_login", user_id=user.id)

    tokens = _build_token_pair(user)
    return TokenResponse(**tokens)


# ── Refresh ─────────────────────────────────────────────────────

@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Issue a new access token from a refresh token",
)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Given a valid refresh token, return a fresh access token.

    Returns 401 if the refresh token is invalid or expired.
    """
    from jose import jwt, JWTError

    try:
        payload = jwt.decode(
            body.refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not a refresh token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    new_access = create_access_token(data={"sub": str(user.id)})
    logger.info("token_refreshed", user_id=user.id)

    return RefreshResponse(access_token=new_access)


# ── Me (current user profile) ───────────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the current authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the authenticated user."""
    return current_user


# ── Update profile ──────────────────────────────────────────────

@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update the current authenticated user",
)
def update_me(
    full_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's profile."""
    if full_name is not None:
        current_user.full_name = full_name
        db.commit()
        db.refresh(current_user)

    logger.info("user_profile_updated", user_id=current_user.id)
    return current_user


# ── Change password ─────────────────────────────────────────────

@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change the authenticated user's password",
)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password after verifying the current one."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(body.new_password)
    db.commit()

    logger.info("user_password_changed", user_id=current_user.id)


# ── Helpers ─────────────────────────────────────────────────────

def _build_token_pair(user: User) -> dict:
    """Return a dict with access_token and refresh_token for the given user."""
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token}
