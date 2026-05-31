"""Security regressions for user-scoped AI provider settings."""

import pytest

from app.core.config import settings
from app.models.ai_provider_setting import AIProviderSetting


def _register(client, suffix: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"ai-security-{suffix}@example.com",
            "full_name": f"AI Security {suffix}",
            "password": "pyt12345",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _payload(base_url: str, api_key: str | None = "secret-key") -> dict:
    return {
        "provider": "custom",
        "base_url": base_url,
        "api_key": api_key,
        "model": "secure-model",
        "timeout": 60,
        "max_retries": 2,
        "temperature": 0.3,
    }


@pytest.mark.parametrize(
    "blocked_url",
    [
        "http://example.com",
        "http://localhost:11434",
        "https://localhost:11434",
        "https://127.0.0.1:11434",
        "https://0.0.0.0:11434",
        "https://10.0.0.1",
        "https://172.16.0.10",
        "https://192.168.1.5",
        "https://169.254.169.254/latest/meta-data",
        "https://host.docker.internal:11434",
        "https://model.internal",
    ],
)
def test_ai_config_blocks_local_and_internal_urls(client, monkeypatch, blocked_url):
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "ALLOW_LOCAL_AI_URLS", False)
    token = _register(client, blocked_url.replace(":", "-").replace("/", "-")[:30])

    resp = client.put(
        "/api/v1/ai/config",
        json=_payload(blocked_url),
        headers=_headers(token),
    )

    assert resp.status_code == 400
    assert "base_url" in resp.json()["detail"]


def test_ai_config_allows_local_url_when_explicitly_enabled(client, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "ALLOW_LOCAL_AI_URLS", True)
    token = _register(client, "local-allowed")

    resp = client.put(
        "/api/v1/ai/config",
        json=_payload("http://localhost:11434", api_key=None),
        headers=_headers(token),
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["base_url"] == "http://localhost:11434"


def test_ai_config_is_user_scoped_and_never_exposes_api_key(client):
    token_a = _register(client, "user-a")
    token_b = _register(client, "user-b")

    save_a = client.put(
        "/api/v1/ai/config",
        json=_payload("https://api-a.example.com", api_key="secret-a"),
        headers=_headers(token_a),
    )
    assert save_a.status_code == 200, save_a.text
    assert save_a.json()["has_api_key"] is True
    assert "api_key" not in save_a.json()

    config_b = client.get("/api/v1/ai/config", headers=_headers(token_b))
    assert config_b.status_code == 200
    assert config_b.json()["base_url"] != "https://api-a.example.com"
    assert "api_key" not in config_b.json()


def test_empty_api_key_payload_preserves_existing_key(client, db_session):
    token = _register(client, "preserve-key")
    headers = _headers(token)

    first = client.put(
        "/api/v1/ai/config",
        json=_payload("https://api.example.com", api_key="secret-a"),
        headers=headers,
    )
    assert first.status_code == 200, first.text

    second = client.put(
        "/api/v1/ai/config",
        json=_payload("https://api.example.com", api_key=""),
        headers=headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["has_api_key"] is True
    assert "api_key" not in second.json()

    setting = db_session.query(AIProviderSetting).one()
    assert setting.api_key == "secret-a"
