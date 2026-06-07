"""AI provider settings router.

Endpoints for managing the AI provider configuration and testing
connectivity.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional

from app.core.ai_config import AI_PROVIDERS, get_ai_config, save_ai_config
from app.core.ai_url_security import AIBaseURLValidationError
from app.core.ai_provider_client import AIProviderClient
from app.db.database import get_db
from app.models.user import User
from app.utils.logging import get_logger
from app.core.dependencies import get_current_user
from sqlalchemy.orm import Session

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/ai", tags=["ai-settings"])
logger = get_logger(__name__)


# ─── Schemas ───────────────────────────────────────────────────────────


class AIConfigUpdate(BaseModel):
    provider: str = Field(default="ollama_local")
    base_url: str = Field(default="")
    api_key: Optional[str] = Field(default=None, repr=False)
    remove_api_key: bool = Field(default=False)
    model: str = Field(default="qwen2.5:latest")
    timeout: float = Field(default=60.0, ge=1.0, le=300.0)
    max_retries: int = Field(default=3, ge=1, le=10)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    personality: Optional[dict[str, int]] = Field(None, description="Mentor personality weights (0-100)")


class AIConfigResponse(BaseModel):
    provider: str
    base_url: str
    model: str
    timeout: float
    max_retries: int
    temperature: float
    has_api_key: bool
    personality: Optional[dict[str, int]] = None


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
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the active AI provider config (api_key masked)."""
    cfg = get_ai_config(db=db, user_id=current_user.id)
    return AIConfigResponse(
        provider=cfg["provider"],
        base_url=cfg["base_url"],
        model=cfg["model"],
        timeout=cfg["timeout"],
        max_retries=cfg["max_retries"],
        temperature=cfg["temperature"],
        has_api_key=bool(cfg.get("api_key")),
        personality=cfg.get("personality"),
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
async def update_config(
    body: AIConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist the new user-scoped configuration."""
    if not body.base_url and body.provider in AI_PROVIDERS:
        body.base_url = AI_PROVIDERS[body.provider].get("default_url", "")

    try:
        merged = save_ai_config(body.model_dump(), db=db, user_id=current_user.id)
    except (AIBaseURLValidationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    logger.info(
        "ai_config_updated",
        user_id=current_user.id,
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
        personality=merged.get("personality"),
    )


@router.post(
    "/test",
    response_model=AITestResponse,
    summary="Test the configured AI provider connection",
)
async def test_ai_provider(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a minimal chat completion to verify connectivity.

    Returns ``{"status": "ok", ...}`` on success or
    ``{"status": "error", "message": "..."}`` on failure.
    """
    cfg = get_ai_config(db=db, user_id=current_user.id)
    try:
        client = AIProviderClient(cfg)
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
            provider=cfg.get("provider", "unknown"),
            model=cfg.get("model", "unknown"),
            error=str(exc),
        )
        return AITestResponse(
            status="error",
            model=cfg.get("model", "unknown"),
            message=str(exc),
        )
