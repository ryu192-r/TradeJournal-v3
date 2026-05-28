"""Authentication router: register, login, refresh, logout, change password, profile."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    RefreshRequest,
    RefreshResponse,
    ChangePasswordRequest,
    UserResponse,
    LogoutRequest,
)
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    store_refresh_token,
    verify_refresh_token_exists_and_active,
    revoke_refresh_token,
    revoke_all_user_refresh_tokens,
)
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.utils.logging import get_logger

from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

_AUTH_FAILED = "Incorrect email or password"


def _extract_client_meta(request: Request):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return user_agent, ip_address


def _build_token_pair(user: User, db: Session, request: Request) -> dict:
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    payload = decode_token(refresh_token, expected_type="refresh")
    user_agent, ip_address = _extract_client_meta(request)
    store_refresh_token(
        db,
        user_id=user.id,
        raw_token=refresh_token,
        jti=payload["jti"],
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# ── Register ────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(body: UserRegister, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed. Please try again.",
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

    tokens = _build_token_pair(user, db, request)
    db.commit()
    return TokenResponse(**tokens)


# ── Login ───────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive JWT tokens",
)
def login(body: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        logger.warning("login_failed", email=body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_AUTH_FAILED,
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    logger.info("user_login", user_id=user.id)

    tokens = _build_token_pair(user, db, request)
    db.commit()
    return TokenResponse(**tokens)


# ── Refresh ─────────────────────────────────────────────────────

@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Rotate refresh token and receive new tokens",
)
def refresh(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token, expected_type="refresh")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        existing = verify_refresh_token_exists_and_active(
            db, jti=jti, user_id=int(user_id), raw_token=body.refresh_token
        )
    except JWTError:
        # Reuse detection: if DB row exists but revoked, revoke all tokens
        db_row = db.query(RefreshToken).filter(
            RefreshToken.jti == jti,
            RefreshToken.user_id == int(user_id),
        ).first()
        if db_row and db_row.revoked_at is not None:
            logger.warning("refresh_token_reuse", user_id=user.id, jti=jti)
            if settings.REFRESH_TOKEN_REUSE_REVOKE_ALL:
                revoke_all_user_refresh_tokens(db, user.id)
                db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    new_access = create_access_token(data={"sub": str(user.id)})
    new_refresh = create_refresh_token(data={"sub": str(user.id)})
    new_payload = decode_token(new_refresh, expected_type="refresh")

    existing.revoked_at = datetime.now(timezone.utc)
    existing.replaced_by_jti = new_payload["jti"]

    user_agent, ip_address = _extract_client_meta(request)
    store_refresh_token(
        db,
        user_id=user.id,
        raw_token=new_refresh,
        jti=new_payload["jti"],
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.commit()

    logger.info("token_refreshed", user_id=user.id)

    return RefreshResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ── Logout ──────────────────────────────────────────────────────

@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke the current refresh token",
)
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    if body.refresh_token:
        try:
            payload = decode_token(body.refresh_token, expected_type="refresh")
            jti = payload.get("jti")
            user_id = payload.get("sub")
            if jti and user_id:
                db_row = db.query(RefreshToken).filter(
                    RefreshToken.jti == jti,
                    RefreshToken.user_id == int(user_id),
                ).first()
                if db_row and db_row.token_hash == hash_token(body.refresh_token):
                    revoke_refresh_token(db, jti)
                    db.commit()
        except JWTError:
            pass
    return {"detail": "Logged out"}


# ── Logout all ──────────────────────────────────────────────────

@router.post(
    "/logout-all",
    status_code=status.HTTP_200_OK,
    summary="Revoke all refresh tokens for the current user",
)
def logout_all(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = revoke_all_user_refresh_tokens(db, current_user.id)
    db.commit()
    logger.info("logout_all", user_id=current_user.id, revoked_count=count)
    return {"detail": f"Logged out of {count} sessions"}


# ── Me (current user profile) ───────────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the current authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)):
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
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(body.new_password)
    revoke_all_user_refresh_tokens(db, current_user.id)
    db.commit()

    logger.info("user_password_changed", user_id=current_user.id)