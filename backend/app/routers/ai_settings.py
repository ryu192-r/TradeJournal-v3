"""AI provider settings router.

Endpoints for managing the AI provider configuration and testing
connectivity.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.core.ai_config import AI_PROVIDERS, get_ai_config, save_ai_config
from app.core.ai_provider_client import AIProviderClient
from app.utils.logging import get_logger

router = APIRouter(prefix="/ai", tags=["ai-settings"])
logger = get_logger(__name__)


# ─── Schemas ───────────────────────────────────────────────────────────


class AIConfigUpdate(BaseModel):
    provider: str = Field(default="ollama_local")
    base_url: str = Field(default="")
    api_key: str = Field(default="", repr=False)
    model: str = Field(default="qwen2.5:latest")
    timeout: float = Field(default=60.0, ge=1.0, le=300.0)
    max_retries: int = Field(default=3, ge=1, le=10)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)


class AIConfigResponse(BaseModel):
    provider: str
    base_url: str
    model: str
    timeout: float
    max_retries: int
    temperature: float
    has_api_key: bool


class ProviderInfo(BaseModel):
    label: str
    default_url: str
    needs_api_key: bool
    models: list[str]
    api_format: Optional[str] = None


class ProvidersResponse(BaseModel):
    providers: dict[str, ProviderInfo]


class AITestResponse(BaseModel):
    status: str
    model: str
    response: Optional[str] = None
    message: Optional[str] = None


# ─── Endpoints ─────────────────────────────────────────────────────────


@router.get(
    "/config",
    response_model=AIConfigResponse,
    summary="Get current AI provider configuration",
)
def get_config():
    """Return the active AI provider config (api_key masked)."""
    cfg = get_ai_config()
    return AIConfigResponse(
        provider=cfg["provider"],
        base_url=cfg["base_url"],
        model=cfg["model"],
        timeout=cfg["timeout"],
        max_retries=cfg["max_retries"],
        temperature=cfg["temperature"],
        has_api_key=bool(cfg.get("api_key")),
    )


@router.get(
    "/providers",
    response_model=ProvidersResponse,
    summary="List all supported AI providers and their models",
)
def get_providers():
    """Return the provider catalog (static)."""
    return ProvidersResponse(
        providers={
            key: ProviderInfo(**info) for key, info in AI_PROVIDERS.items()
        }
    )


@router.put(
    "/config",
    response_model=AIConfigResponse,
    summary="Save new AI provider configuration",
)
async def update_config(body: AIConfigUpdate):
    """Persist the new configuration and refresh all singleton services."""
    if not body.base_url and body.provider in AI_PROVIDERS:
        body.base_url = AI_PROVIDERS[body.provider].get("default_url", "")

    merged = save_ai_config(body.model_dump())
    await _refresh_singletons()
    logger.info(
        "ai_config_updated",
        provider=merged["provider"],
        model=merged["model"],
        base_url=merged["base_url"],
    )
    return AIConfigResponse(
        provider=merged["provider"],
        base_url=merged["base_url"],
        model=merged["model"],
        timeout=merged["timeout"],
        max_retries=merged["max_retries"],
        temperature=merged["temperature"],
        has_api_key=bool(merged.get("api_key")),
    )


@router.post(
    "/test",
    response_model=AITestResponse,
    summary="Test the configured AI provider connection",
)
async def test_ai_provider():
    """Send a minimal chat completion to verify connectivity.

    Returns ``{"status": "ok", ...}`` on success or
    ``{"status": "error", "message": "..."}`` on failure.
    """
    cfg = get_ai_config()
    client = AIProviderClient(cfg)
    try:
        response = await client.chat(
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Reply with exactly: Connection test successful. "
                        "Do not add any additional text."
                    ),
                }
            ],
            temperature=0.0,
            max_tokens=30,
        )
        logger.info("ai_provider_test_ok", provider=cfg["provider"], model=cfg["model"])
        return AITestResponse(
            status="ok",
            model=cfg["model"],
            response=response.strip(),
        )
    except Exception as exc:
        logger.error(
            "ai_provider_test_failed",
            provider=cfg["provider"],
            model=cfg["model"],
            error=str(exc),
        )
        return AITestResponse(
            status="error",
            model=cfg["model"],
            message=str(exc),
        )


# ─── Singleton refresh ─────────────────────────────────────────────────


async def _refresh_singletons():
    """Reload config in all live singleton services."""
    from app.services.ai_coach import ai_coach

    try:
        await ai_coach.refresh()
        logger.info("ai_coach_refreshed")
    except Exception as exc:
        logger.warning("ai_coach_refresh_failed", error=str(exc))
