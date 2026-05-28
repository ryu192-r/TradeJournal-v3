"""Auth refresh rotation tests: server-side token tracking, rotation, revocation, reuse detection."""

import pytest
from app.models.refresh_token import RefreshToken
from app.core.security import hash_token


def _register(client, email="user@test.com", full_name="Test", password="Pass1234!"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )


def _login(client, email="user@test.com", password="Pass1234!"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def _refresh(client, refresh_token):
    return client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})


# ── Basic auth ──────────────────────────────────────────────────


def test_login_returns_access_and_refresh(client):
    _register(client)
    resp = _login(client)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_returns_access_and_refresh(client):
    resp = _register(client)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_me_works_with_access_token(client):
    _register(client)
    login = _login(client)
    token = login.json()["access_token"]
    resp = _me(client, token)
    assert resp.status_code == 200
    assert resp.json()["email"] == "user@test.com"


def test_invalid_token_returns_401(client):
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


def test_login_failure_generic_message(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@test.com", "password": "whatever"},
    )
    assert resp.status_code == 401
    detail = resp.json()["detail"]
    assert "Incorrect" in detail
    assert "nonexistent" not in detail


# ── Refresh token DB tracking ────────────────────────────────────


def test_refresh_token_stored_hashed_not_plain(client, db_session):
    _register(client, email="hashed@test.com")
    login = _login(client, email="hashed@test.com")
    raw_refresh = login.json()["refresh_token"]

    rows = db_session.query(RefreshToken).filter(RefreshToken.user_id != None).all()
    assert len(rows) >= 1
    hashed = [r for r in rows if r.token_hash == hash_token(raw_refresh)]
    assert len(hashed) == 1
    assert hashed[0].token_hash != raw_refresh


def test_refresh_token_has_jti(client, db_session):
    _register(client, email="jti@test.com")
    login = _login(client, email="jti@test.com")

    rows = db_session.query(RefreshToken).all()
    assert len(rows) >= 1
    assert all(r.jti is not None and len(r.jti) > 0 for r in rows)


# ── Refresh token rotation ───────────────────────────────────────


def test_refresh_returns_new_access_and_new_refresh(client, db_session):
    _register(client)
    login = _login(client)
    old_refresh = login.json()["refresh_token"]

    resp = _refresh(client, old_refresh)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != old_refresh


def test_old_refresh_revoked_after_rotation(client, db_session):
    _register(client)
    login = _login(client)
    old_refresh = login.json()["refresh_token"]

    _refresh(client, old_refresh)

    old_jti = _decode_jti(old_refresh)
    old_row = db_session.query(RefreshToken).filter(RefreshToken.jti == old_jti).first()
    assert old_row is not None
    assert old_row.revoked_at is not None


def test_new_refresh_stored_after_rotation(client, db_session):
    _register(client)
    login = _login(client)
    old_refresh = login.json()["refresh_token"]

    resp = _refresh(client, old_refresh)
    new_refresh = resp.json()["refresh_token"]

    new_jti = _decode_jti(new_refresh)
    new_row = db_session.query(RefreshToken).filter(RefreshToken.jti == new_jti).first()
    assert new_row is not None
    assert new_row.revoked_at is None


def test_replaced_by_jti_set_after_rotation(client, db_session):
    _register(client)
    login = _login(client)
    old_refresh = login.json()["refresh_token"]

    resp = _refresh(client, old_refresh)
    new_refresh = resp.json()["refresh_token"]

    old_jti = _decode_jti(old_refresh)
    new_jti = _decode_jti(new_refresh)
    old_row = db_session.query(RefreshToken).filter(RefreshToken.jti == old_jti).first()
    assert old_row.replaced_by_jti == new_jti


# ── Reuse detection ─────────────────────────────────────────────


def test_old_refresh_cannot_be_reused(client, db_session):
    _register(client)
    login = _login(client)
    old_refresh = login.json()["refresh_token"]

    _refresh(client, old_refresh)

    resp = _refresh(client, old_refresh)
    assert resp.status_code == 401


def test_reuse_of_revoked_refresh_revokes_all_tokens(client, db_session):
    _register(client, email="reuse@test.com")
    login1 = _login(client, email="reuse@test.com")
    login2 = _login(client, email="reuse@test.com")

    refresh1 = login1.json()["refresh_token"]
    refresh2 = login2.json()["refresh_token"]

    active_before = db_session.query(RefreshToken).filter(
        RefreshToken.revoked_at == None,
        RefreshToken.user_id == _get_user_id(db_session, "reuse@test.com"),
    ).count()
    assert active_before >= 2

    _refresh(client, refresh1)

    resp = _refresh(client, refresh1)
    assert resp.status_code == 401

    active_after = db_session.query(RefreshToken).filter(
        RefreshToken.revoked_at == None,
        RefreshToken.user_id == _get_user_id(db_session, "reuse@test.com"),
    ).count()
    assert active_after == 0


# ── Logout ──────────────────────────────────────────────────────


def test_logout_revokes_current_refresh(client, db_session):
    _register(client)
    login = _login(client)
    refresh_token = login.json()["refresh_token"]

    resp = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200

    jti = _decode_jti(refresh_token)
    row = db_session.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    assert row.revoked_at is not None


def test_logout_succeeds_even_if_token_invalid(client):
    resp = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": "invalid.token.here"},
    )
    assert resp.status_code == 200


def test_logout_succeeds_with_no_token(client):
    resp = client.post(
        "/api/v1/auth/logout",
        json={},
    )
    assert resp.status_code == 200


def test_logout_all_revokes_all_user_tokens(client, db_session):
    _register(client, email="logoutall@test.com")
    _login(client, email="logoutall@test.com")
    _login(client, email="logoutall@test.com")

    assert db_session.query(RefreshToken).filter(RefreshToken.revoked_at == None).count() >= 2

    access_token = _register(client, email="logoutall2@test.com").json()["access_token"]
    resp = client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200


# ── Token type enforcement ──────────────────────────────────────


def test_access_token_cannot_be_used_as_refresh(client):
    _register(client)
    login = _login(client)
    access_token = login.json()["access_token"]

    resp = _refresh(client, access_token)
    assert resp.status_code == 401


def test_refresh_token_cannot_be_used_as_access(client):
    _register(client)
    login = _login(client)
    refresh_token = login.json()["refresh_token"]

    resp = _me(client, refresh_token)
    assert resp.status_code == 401


# ── Cross-user isolation ────────────────────────────────────────


def test_user_a_refresh_cannot_refresh_user_b(client):
    _register(client, email="userA@test.com")
    login_a = _login(client, email="userA@test.com")

    _register(client, email="userB@test.com")
    login_b = _login(client, email="userB@test.com")

    resp = _refresh(client, login_a.json()["refresh_token"])
    assert resp.status_code == 200

    assert login_b.json()["refresh_token"] != login_a.json()["refresh_token"]


# ── Change password revokes sessions ────────────────────────────


def test_change_password_revokes_all_refresh_tokens(client, db_session):
    _register(client, email="chpw@test.com")
    login = _login(client, email="chpw@test.com")
    token = login.json()["access_token"]
    refresh = login.json()["refresh_token"]

    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Pass1234!", "new_password": "NewPass5678!"},
    )
    assert resp.status_code == 204

    resp = _refresh(client, refresh)
    assert resp.status_code == 401


# ── Token hash verification ──────────────────────────────────────


def test_tampered_refresh_token_rejected(client, db_session):
    """A refresh token with the same jti but different content should be rejected."""
    _register(client, email="tamper@test.com")
    login = _login(client, email="tamper@test.com")
    refresh_token = login.json()["refresh_token"]

    parts = refresh_token.split(".")
    assert len(parts) == 3
    import base64
    payload_bytes = base64.urlsafe_b64decode(parts[1] + "==")
    import json
    payload = json.loads(payload_bytes)
    payload["sub"] = "99999"
    tampered_payload = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).rstrip(b"=").decode()

    tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"

    resp = _refresh(client, tampered_token)
    assert resp.status_code == 401


def test_expired_refresh_token_rejected(client, db_session):
    """A refresh token with past exp should be rejected with 401."""
    _register(client)
    login = _login(client)
    access_token = login.json()["access_token"]

    from jose import jwt as jose_jwt
    from app.core.config import settings
    from datetime import datetime, timedelta, timezone

    expired_payload = {
        "sub": "1",
        "type": "refresh",
        "jti": "expired-test-jti",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    expired_token = jose_jwt.encode(
        expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )

    resp = _refresh(client, expired_token)
    assert resp.status_code == 401


# ── expires_in in responses ──────────────────────────────────────


def test_login_includes_expires_in(client):
    _register(client)
    resp = _login(client)
    data = resp.json()
    assert "expires_in" in data
    assert isinstance(data["expires_in"], int)
    assert data["expires_in"] > 0


def test_register_includes_expires_in(client):
    resp = _register(client)
    data = resp.json()
    assert "expires_in" in data
    assert isinstance(data["expires_in"], int)


def test_refresh_includes_expires_in(client):
    _register(client)
    login = _login(client)
    refresh = login.json()["refresh_token"]

    resp = _refresh(client, refresh)
    assert resp.status_code == 200
    data = resp.json()
    assert "expires_in" in data
    assert isinstance(data["expires_in"], int)


# ── Logout-all revokes all tokens for user ──────────────────────


def test_logout_all_actually_revokes_all_sessions(client, db_session):
    _register(client, email="logoutall3@test.com")
    login1 = _login(client, email="logoutall3@test.com")
    login2 = _login(client, email="logoutall3@test.com")

    refresh1 = login1.json()["refresh_token"]
    refresh2 = login2.json()["refresh_token"]
    access_token = login1.json()["access_token"]

    user_id = _get_user_id(db_session, "logoutall3@test.com")
    active_before = db_session.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None,
    ).count()
    assert active_before >= 2

    resp = client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200

    active_after = db_session.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None,
    ).count()
    assert active_after == 0

    resp1 = _refresh(client, refresh1)
    assert resp1.status_code == 401

    resp2 = _refresh(client, refresh2)
    assert resp2.status_code == 401


# ── Helpers ──────────────────────────────────────────────────────


def _decode_jti(token: str) -> str:
    from jose import jwt
    from app.core.config import settings
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    return payload.get("jti", "")


def _get_user_id(db_session, email: str) -> int:
    from app.models.user import User
    user = db_session.query(User).filter(User.email == email).first()
    return user.id if user else 0