"""Runtime AI provider configuration manager.

Loads/saves provider settings from a JSON file under the project core/
directory. Falls back to environment-variable-based Settings when the
file does not exist.
"""

import json
from pathlib import Path
from typing import Any

import structlog

from app.core.ai_url_security import validate_ai_base_url

logger = structlog.get_logger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent / "ai_config.json"

AI_PROVIDERS: dict[str, dict[str, Any]] = {
    "ollama_local": {
        "label": "Ollama (Local)",
        "default_url": "http://localhost:11434",
        "needs_api_key": False,
        "api_format": "ollama",
        "models": [
            "llama3.2:latest",
            "qwen2.5:latest",
            "mistral:latest",
            "gemma3:latest",
            "phi4:latest",
            "deepseek-r1:latest",
            "codellama:latest",
        ],
    },
    "ollama_cloud": {
        "label": "Ollama Cloud",
        "default_url": "https://ollama.com",
        "needs_api_key": True,
        "api_format": "ollama",
        "models": [
            "deepseek-v4-flash",
            "deepseek-v4-pro",
            "gemma4",
            "qwen3.5",
            "glm-5.1",
            "minimax-m2.7",
            "kimi-k2.6",
            "glm-4.7",
            "nemotron-3-super",
            "qwen3-coder-next",
            "gemini-3-flash-preview",
            "deepseek-v3.2",
        ],
    },
    "openai": {
        "label": "OpenAI",
        "default_url": "https://api.openai.com",
        "needs_api_key": True,
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "o1-mini"],
    },
    "deepseek": {
        "label": "DeepSeek",
        "default_url": "https://api.deepseek.com",
        "needs_api_key": True,
        "models": ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    },
    "anthropic": {
        "label": "Anthropic (Claude)",
        "default_url": "https://api.anthropic.com",
        "needs_api_key": True,
        "models": [
            "claude-sonnet-4-20250514",
            "claude-opus-4-20250514",
            "claude-haiku-3-5-20241022",
        ],
        "api_format": "anthropic",
    },
    "google": {
        "label": "Google (Gemini)",
        "default_url": "https://generativelanguage.googleapis.com",
        "needs_api_key": True,
        "models": ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
        "api_format": "google",
    },
    "custom": {
        "label": "Custom (OpenAI-compatible)",
        "default_url": "",
        "needs_api_key": True,
        "models": [],
    },
    "opencode_zen": {
        "label": "OpenCode Zen",
        "default_url": "https://opencode.ai/zen",
        "needs_api_key": True,
        "models": [
            "deepseek-v4-flash-free",
            "nemotron-3-super-free",
            "big-pickle",
            "minimax-m2.5-free",
            "ring-2.6-1t-free",
            "qwen3.6-plus",
            "qwen3.5-plus",
            "minimax-m2.7",
            "glm-5.1",
            "kimi-k2.6",
            "gpt-5.4-mini",
            "gpt-5.4-nano",
        ],
    },
}


_DEFAULT_CONFIG = {
    "provider": "ollama_local",
    "base_url": "http://localhost:11434",
    "api_key": "",
    "model": "qwen2.5:latest",
    "timeout": 60.0,
    "max_retries": 3,
    "temperature": 0.3,
}


# ─── Public API ────────────────────────────────────────────────────────


def get_ai_config(db: Any | None = None, user_id: int | None = None) -> dict[str, Any]:
    """Return the current AI provider configuration.

    When db/user_id are provided, returns that user's DB-backed settings.
    Legacy non-DB callers still read ai_config.json/env fallback.
    """
    if db is not None and user_id is not None:
        return _get_user_ai_config(db, user_id)

    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            return _canonicalize(data)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("ai_config_read_failed", path=str(CONFIG_PATH), error=str(exc))

    return _default_config()


def save_ai_config(
    cfg: dict[str, Any],
    db: Any | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Persist *cfg* and return the merged canonical config.

    Unknown top-level keys are silently dropped; defaults fill any gaps.
    User-scoped writes preserve the stored API key when the payload omits it
    or sends an empty value.
    """
    if db is not None and user_id is not None:
        return _save_user_ai_config(db, user_id, cfg)

    merged = _merge_config(_DEFAULT_CONFIG, cfg, preserve_empty_api_key=False)
    validate_ai_base_url(merged["base_url"])
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    logger.info("ai_config_saved", path=str(CONFIG_PATH))
    return merged


def delete_ai_config() -> bool:
    """Remove on-disk config so callers fall back to env vars."""
    if CONFIG_PATH.exists():
        CONFIG_PATH.unlink()
        logger.info("ai_config_deleted", path=str(CONFIG_PATH))
        return True
    return False


# ─── Internal helpers ──────────────────────────────────────────────────


def _sanitize(cfg: dict[str, Any]) -> dict[str, Any]:
    """Coerce values to the expected types."""
    cfg["provider"] = str(cfg.get("provider", _DEFAULT_CONFIG["provider"]))
    cfg["base_url"] = str(cfg.get("base_url", "")).rstrip("/")
    api_key = cfg.get("api_key", "")
    cfg["api_key"] = "" if api_key is None else str(api_key).strip()
    cfg["model"] = str(cfg.get("model", _DEFAULT_CONFIG["model"]))
    try:
        cfg["timeout"] = float(cfg.get("timeout", _DEFAULT_CONFIG["timeout"]))
    except (TypeError, ValueError):
        cfg["timeout"] = _DEFAULT_CONFIG["timeout"]
    try:
        cfg["max_retries"] = int(cfg.get("max_retries", _DEFAULT_CONFIG["max_retries"]))
    except (TypeError, ValueError):
        cfg["max_retries"] = _DEFAULT_CONFIG["max_retries"]
    try:
        cfg["temperature"] = float(cfg.get("temperature", _DEFAULT_CONFIG["temperature"]))
    except (TypeError, ValueError):
        cfg["temperature"] = _DEFAULT_CONFIG["temperature"]
    return cfg


def _canonicalize(cfg: dict[str, Any]) -> dict[str, Any]:
    merged = _sanitize({**_DEFAULT_CONFIG, **{k: v for k, v in cfg.items() if k in _DEFAULT_CONFIG}})
    provider_meta = AI_PROVIDERS.get(merged["provider"])
    if provider_meta:
        if not merged["base_url"]:
            merged["base_url"] = provider_meta.get("default_url", "")
        if not merged["model"] and provider_meta.get("models"):
            merged["model"] = provider_meta["models"][0]
    return merged


def _merge_config(
    current: dict[str, Any],
    incoming: dict[str, Any],
    preserve_empty_api_key: bool,
) -> dict[str, Any]:
    allowed = {k: v for k, v in incoming.items() if k in _DEFAULT_CONFIG}
    incoming_api_key = allowed.get("api_key")
    if preserve_empty_api_key and (
        "api_key" not in allowed
        or incoming_api_key is None
        or str(incoming_api_key).strip() == ""
    ):
        allowed.pop("api_key", None)
    merged = _canonicalize({**current, **allowed})
    if merged["provider"] not in AI_PROVIDERS:
        raise ValueError("Unsupported AI provider")
    return merged


def _default_config() -> dict[str, Any]:
    return _canonicalize(_env_fallback())


def _get_user_ai_config(db: Any, user_id: int) -> dict[str, Any]:
    from app.models.ai_provider_setting import AIProviderSetting

    setting = db.query(AIProviderSetting).filter(AIProviderSetting.user_id == user_id).first()
    if setting is None:
        return _default_config()
    return _setting_to_config(setting)


def _save_user_ai_config(db: Any, user_id: int, cfg: dict[str, Any]) -> dict[str, Any]:
    from app.models.ai_provider_setting import AIProviderSetting

    setting = db.query(AIProviderSetting).filter(AIProviderSetting.user_id == user_id).first()
    current = _setting_to_config(setting) if setting else _default_config()
    merged = _merge_config(current, cfg, preserve_empty_api_key=True)
    if cfg.get("remove_api_key") is True:
        merged["api_key"] = ""
    validate_ai_base_url(merged["base_url"])

    if setting is None:
        setting = AIProviderSetting(user_id=user_id)
        db.add(setting)

    _apply_config_to_setting(setting, merged)
    db.commit()
    db.refresh(setting)
    logger.info("ai_config_saved", user_id=user_id, provider=setting.provider)
    return _setting_to_config(setting)


def _setting_to_config(setting: Any) -> dict[str, Any]:
    return _canonicalize(
        {
            "provider": setting.provider,
            "base_url": setting.base_url,
            "api_key": setting.api_key or "",
            "model": setting.model,
            "timeout": setting.timeout,
            "max_retries": setting.max_retries,
            "temperature": setting.temperature,
        }
    )


def _apply_config_to_setting(setting: Any, cfg: dict[str, Any]) -> None:
    setting.provider = cfg["provider"]
    setting.base_url = cfg["base_url"]
    setting.api_key = cfg.get("api_key") or None
    setting.model = cfg["model"]
    setting.timeout = cfg["timeout"]
    setting.max_retries = cfg["max_retries"]
    setting.temperature = cfg["temperature"]


def _env_fallback() -> dict[str, Any]:
    """Build config from legacy environment variables."""
    from app.core.config import settings

    return {
        "provider": "ollama_cloud",
        "base_url": settings.OLLAMA_BASE_URL or AI_PROVIDERS["ollama_cloud"]["default_url"],
        "api_key": settings.OLLAMA_API_KEY,
        "model": settings.OLLAMA_MODEL,
        "timeout": settings.OLLAMA_TIMEOUT,
        "max_retries": settings.OLLAMA_MAX_RETRIES,
        "temperature": 0.3,
    }
