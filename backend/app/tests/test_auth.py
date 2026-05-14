"""Tests for authentication endpoints: register, login, refresh, /me, change-password."""

import sys, os, time

_app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

from app.core.security import verify_password


# ── Register ──────────────────────────────────────────────────────


class TestRegister:
    """POST /api/v1/auth/register"""

    def test_register_success(self, http):
        """Register a unique user and get back tokens."""
        ts = int(time.time() * 1000_000)
        resp = http.post("/api/v1/auth/register", json={
            "email": f"reg.{ts}@example.com",
            "full_name": "New User",
            "password": "StrongPass1!",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, http):
        ts = int(time.time() * 1000_000)
        payload = {
            "email": f"dup.{ts}@example.com",
            "full_name": "Dup User",
            "password": "StrongPass1!",
        }
        r1 = http.post("/api/v1/auth/register", json=payload)
        assert r1.status_code == 201

        r2 = http.post("/api/v1/auth/register", json=payload)
        assert r2.status_code == 409

    def test_register_invalid_email(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "full_name": "Bad Email",
            "password": "StrongPass1!",
        })
        assert resp.status_code == 422

    def test_register_missing_password(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "nopass@test.com",
            "full_name": "No Pass",
        })
        assert resp.status_code == 422

    def test_register_password_is_hashed(self, http, db_session):
        """Stored password must be hashed, not plaintext."""
        import time
        from app.models.user import User
        ts = int(time.time() * 1_000_000)
        http.post("/api/v1/auth/register", json={
            "email": f"hash.{ts}@test.com",
            "full_name": "Hash Test",
            "password": "MySecret123!",
        })
        user = db_session.query(User).filter(User.email == f"hash.{ts}@test.com").first()
        assert user is not None
        assert verify_password("MySecret123!", user.hashed_password)
        assert user.hashed_password != "MySecret123!"


# ── Login ────────────────────────────────────────────────────────


class TestLogin:
    """POST /api/v1/auth/login"""

    def test_login_success(self, registered_user, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_wrong_password(self, registered_user, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": registered_user["email"],
            "password": "WrongPassword123!",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "ghost@test.com",
            "password": "Whatever123!",
        })
        assert resp.status_code == 401

    def test_login_invalid_email_format(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "bad-email",
            "password": "Pass123!",
        })
        assert resp.status_code == 422


# ── Refresh ──────────────────────────────────────────────────────


class TestRefresh:
    """POST /api/v1/auth/refresh"""

    def test_refresh_with_valid_token(self, registered_user, client):
        resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": registered_user["refresh_token"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_refresh_with_invalid_token(self, client):
        resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": "garbage.token.here",
        })
        assert resp.status_code == 401

    def test_refresh_with_access_token(self, registered_user, client):
        """Using an access token as refresh token must fail."""
        resp = client.post("/api/v1/auth/refresh", json={
            "refresh_token": registered_user["access_token"],
        })
        assert resp.status_code == 401

    def test_refresh_missing_field(self, client):
        resp = client.post("/api/v1/auth/refresh", json={})
        assert resp.status_code == 422


# ── /me (current user profile) ───────────────────────────────────


class TestGetMe:
    """GET /api/v1/auth/me"""

    def test_me_with_valid_token(self, auth_headers, client):
        resp = client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] is not None
        assert "example.com" in data["email"]
        assert data["full_name"] == "Test User"
        assert data["is_active"] is True

    def test_me_without_token(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token(self, client):
        resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake.token"})
        assert resp.status_code == 401


# ── Update profile ──────────────────────────────────────────────


class TestUpdateProfile:
    """PATCH /api/v1/auth/me"""

    def test_update_name(self, auth_headers, client):
        resp = client.patch(
            "/api/v1/auth/me",
            params={"full_name": "Updated Name"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    def test_update_unauthenticated(self, client):
        resp = client.patch("/api/v1/auth/me", params={"full_name": "Nobody"})
        assert resp.status_code == 401


# ── Change password ─────────────────────────────────────────────


class TestChangePassword:
    """POST /api/v1/auth/change-password"""

    def test_change_password_success(self, registered_user, client):
        access = registered_user["access_token"]
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": registered_user["password"], "new_password": "NewPass456!"},
            headers={"Authorization": f"Bearer {access}"},
        )
        assert resp.status_code == 204

        # Verify new password works
        login_resp = client.post("/api/v1/auth/login", json={
            "email": registered_user["email"],
            "password": "NewPass456!",
        })
        assert login_resp.status_code == 200

    def test_change_password_wrong_current(self, registered_user, client):
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "WrongCurrent!", "new_password": "NewPass456!"},
            headers={"Authorization": f"Bearer {registered_user['access_token']}"},
        )
        assert resp.status_code == 400

    def test_change_password_unauthenticated(self, client):
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "X", "new_password": "Y"},
        )
        assert resp.status_code == 401


# ── JWT token structure ─────────────────────────────────────────


class TestJWTTokenStructure:
    """Verify JWT claims are correct."""

    def test_access_token_has_type_access(self, registered_user):
        from jose import jwt
        from app.core.config import settings
        decoded = jwt.decode(registered_user["access_token"], key=settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert decoded["type"] == "access"
        assert "exp" in decoded
        assert "sub" in decoded

    def test_refresh_token_has_type_refresh(self, registered_user):
        from jose import jwt
        from app.core.config import settings
        decoded = jwt.decode(registered_user["refresh_token"], key=settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert decoded["type"] == "refresh"
        assert "exp" in decoded
        assert "sub" in decoded
