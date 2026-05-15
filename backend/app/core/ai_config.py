"""Runtime AI provider configuration manager.

Loads/saves provider settings from a JSON file under the project core/
directory. Falls back to environment-variable-based Settings when the
file does not exist.
"""

import json
from pathlib import Path
from typing import Any

import structlog

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
    "personality": {
        "minervini": 50,
        "manas_arora": 50,
        "chartitude": 50,
        "quallamagie": 50,
        "pradeep_bonde": 50,
    },
}

MENTORS = {
    "minervini": {"name": "Mark Minervini", "description": "SEPA methodology, momentum, risk management"},
    "manas_arora": {"name": "Manas Arora", "description": "Indian markets, price action, discipline"},
    "chartitude": {"name": "Chartitude", "description": "Technical analysis, chart patterns, patience"},
    "quallamagie": {"name": "QuallaMagie", "description": "Quantitative edge, data-driven, systematic"},
    "pradeep_bonde": {"name": "Pradeep Bonde", "description": "Swing trading, trend following, psychology"},
}


# ─── Public API ────────────────────────────────────────────────────────


def get_ai_config() -> dict[str, Any]:
    """Return the current AI provider configuration.

    Priority:
      1. ai_config.json (if it exists and parses cleanly)
      2. Fallback to env var–based defaults from Settings
    """
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            # Ensure every key from the defaults is present
            for key, val in _DEFAULT_CONFIG.items():
                data.setdefault(key, val)
            return _sanitize(data)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("ai_config_read_failed", path=str(CONFIG_PATH), error=str(exc))

    return _env_fallback()


def save_ai_config(cfg: dict[str, Any]) -> dict[str, Any]:
    """Persist *cfg* and return the merged canonical config.

    Unknown top-level keys are silently dropped; defaults fill any gaps.
    """
    merged = {**_DEFAULT_CONFIG, **{k: v for k, v in cfg.items() if k in _DEFAULT_CONFIG}}
    merged = _sanitize(merged)
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
    cfg["api_key"] = str(cfg.get("api_key", "")).strip()
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


def _env_fallback() -> dict[str, Any]:
    """Build config from legacy environment variables."""
    from app.core.config import settings

    return {
        "provider": "ollama_cloud",
        "base_url": settings.OLLAMA_BASE_URL,
        "api_key": settings.OLLAMA_API_KEY,
        "model": settings.OLLAMA_MODEL,
        "timeout": settings.OLLAMA_TIMEOUT,
        "max_retries": settings.OLLAMA_MAX_RETRIES,
        "temperature": 0.3,
    }
