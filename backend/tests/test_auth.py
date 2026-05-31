"""Auth endpoint tests: register, login, refresh, /me, change-password."""


# ── helpers ─────────────────────────────────────────────────────

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


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})


# ── tests ───────────────────────────────────────────────────────


def test_register_ok(client):
    resp = _register(client)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate_email(client):
    _register(client)
    resp = _register(client)
    assert resp.status_code == 409
    assert "Registration failed" in resp.json()["detail"]


def test_register_rejects_weak_passwords(client):
    weak_passwords = ["", "short1", "password", "12345678", "aaaaaaaa"]
    for idx, password in enumerate(weak_passwords):
        resp = _register(client, email=f"weak-{idx}@test.com", password=password)
        assert resp.status_code == 422
        assert "Password must be at least 8 characters" in resp.text


def test_login_ok(client):
    _register(client)
    resp = _login(client)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client):
    _register(client)
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "user@test.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert "Incorrect" in resp.json()["detail"]


def test_me_ok(client):
    _register(client)
    login = _login(client)
    token = login.json()["access_token"]
    resp = _me(client, token)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "user@test.com"
    assert data["full_name"] == "Test"
    assert data["is_active"] is True


def test_me_no_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_refresh_ok(client):
    _register(client)
    login = _login(client)
    refresh_token = login.json()["refresh_token"]
    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "token_type" in data


def test_refresh_invalid_token(client):
    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid.token.here"},
    )
    assert resp.status_code == 401


def test_change_password_ok(client):
    _register(client)
    login = _login(client)
    token = login.json()["access_token"]
    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Pass1234!", "new_password": "NewPass5678!"},
    )
    assert resp.status_code == 204

    # Old password should now fail
    old = _login(client, password="Pass1234!")
    assert old.status_code == 401

    # New password should work
    new = _login(client, password="NewPass5678!")
    assert new.status_code == 200


def test_change_password_rejects_weak_new_password(client):
    _register(client)
    login = _login(client)
    token = login.json()["access_token"]

    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Pass1234!", "new_password": "weak"},
    )

    assert resp.status_code == 422

    still_valid = _login(client, password="Pass1234!")
    assert still_valid.status_code == 200
