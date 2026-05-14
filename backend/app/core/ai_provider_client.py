"""Multi-provider AI client supporting OpenAI, Anthropic, and Google APIs.

Reads its configuration from ``ai_config.json`` (with env-var fallback)
so that provider switches take effect at runtime without a restart.
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx
import structlog

import app.core.ai_config as _ai_config

logger = structlog.get_logger(__name__)

# API format constants — stored per-provider in AI_PROVIDERS
FORMAT_OPENAI = "openai"
FORMAT_ANTHROPIC = "anthropic"
FORMAT_GOOGLE = "google"


class AIProviderClient:
    """HTTP client that dispatches to the correct API format.

    Usage::

        cfg = get_ai_config()
        client = AIProviderClient(cfg)
        reply = await client.chat([...], temperature=0.7)
        await client.refresh()   # reload config from disk
    """

    def __init__(self, cfg: dict[str, Any] | None = None) -> None:
        if cfg is None:
            cfg = _ai_config.get_ai_config()
        self.base_url = cfg["base_url"].rstrip("/")
        self.api_key = cfg.get("api_key") or ""
        self.model = cfg["model"]
        self.timeout = float(cfg.get("timeout", 60.0))
        self.max_retries = int(cfg.get("max_retries", 3))
        self.temperature = float(cfg.get("temperature", 0.3))

        provider_name = cfg.get("provider", "custom")
        provider_meta = _ai_config.AI_PROVIDERS.get(provider_name, {})
        self.api_format: str = provider_meta.get("api_format", FORMAT_OPENAI)

    async def refresh(self) -> None:
        """Reload every field from the on-disk config (env fallback included)."""
        cfg = _ai_config.get_ai_config()
        self.base_url = cfg["base_url"].rstrip("/")
        self.api_key = cfg.get("api_key") or ""
        self.model = cfg["model"]
        self.timeout = float(cfg.get("timeout", 60.0))
        self.max_retries = int(cfg.get("max_retries", 3))
        self.temperature = float(cfg.get("temperature", 0.3))
        provider_name = cfg.get("provider", "custom")
        provider_meta = _ai_config.AI_PROVIDERS.get(provider_name, {})
        self.api_format = provider_meta.get("api_format", FORMAT_OPENAI)
        logger.info(
            "ai_provider_client_refreshed",
            provider=provider_name,
            model=self.model,
            api_format=self.api_format,
        )

    # ─── Public API ────────────────────────────────────────────────

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float | None = None,
        max_tokens: int = 2000,
    ) -> str:
        """Send a chat-completion request and return the content string."""
        temp = temperature if temperature is not None else self.temperature
        dispatch = {
            FORMAT_OPENAI: self._openai_chat,
            FORMAT_ANTHROPIC: self._anthropic_chat,
            FORMAT_GOOGLE: self._google_chat,
        }
        handler = dispatch.get(self.api_format, self._openai_chat)
        return await handler(messages, temp, max_tokens)

    # ─── OpenAI-compatible (/v1/chat/completions) ─────────────────

    async def _openai_chat(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        url = f"{self.base_url}/v1/chat/completions"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        last_err: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=10.0),
                ) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    content = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                    )
                    if not content:
                        raise ValueError("Empty response from AI provider")
                    logger.info(
                        "openai_chat_response",
                        model=self.model,
                        attempt=attempt,
                        tokens=data.get("usage", {}).get("total_tokens"),
                    )
                    return content
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "ai_chat_error",
                    api_format=self.api_format,
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(2**attempt)
                else:
                    raise RuntimeError(
                        f"AI provider call failed after {self.max_retries} attempts: {last_err}"
                    ) from last_err

        raise RuntimeError("OpenAI chat call exhausted retries")

    # ─── Anthropic (/v1/messages) ─────────────────────────────────

    async def _anthropic_chat(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        url = f"{self.base_url}/v1/messages"
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key or "",
            "anthropic-version": "2023-06-01",
        }

        # Anthropic requires a separate system field (not in messages)
        system_content = ""
        user_messages: list[dict[str, str]] = []
        for m in messages:
            if m.get("role") == "system":
                system_content = m.get("content", "")
            else:
                user_messages.append({"role": m["role"], "content": m["content"]})

        # If no non-system messages exist, add a minimal user prompt
        if not user_messages:
            user_messages.append({"role": "user", "content": "Continue."})

        payload = {
            "model": self.model,
            "system": system_content,
            "messages": user_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        last_err: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=10.0),
                ) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    content = ""
                    for block in data.get("content", []):
                        if block.get("type") == "text":
                            content += block.get("text", "")
                    if not content:
                        raise ValueError("Empty response from Anthropic")
                    logger.info(
                        "anthropic_chat_response",
                        model=self.model,
                        attempt=attempt,
                        usage=data.get("usage"),
                    )
                    return content
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "ai_chat_error",
                    api_format="anthropic",
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(2**attempt)
                else:
                    raise RuntimeError(
                        f"Anthropic API call failed after {self.max_retries} attempts: {last_err}"
                    ) from last_err

        raise RuntimeError("Anthropic chat call exhausted retries")

    # ─── Google Gemini (/v1beta/models/...:generateContent) ───────

    async def _google_chat(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        api_key = self.api_key or ""
        url = (
            f"{self.base_url}/v1beta/models/{self.model}:generateContent"
            f"?key={api_key}"
        )

        system_instructions = ""
        contents: list[dict[str, Any]] = []
        for m in messages:
            role = m.get("role", "user")
            if role == "system":
                system_instructions = m.get("content", "")
            else:
                gemini_role = "model" if role == "assistant" else "user"
                contents.append({"role": gemini_role, "parts": [{"text": m["content"]}]})

        if not contents:
            contents.append({"role": "user", "parts": [{"text": "Continue."}]})

        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instructions:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instructions}]
            }

        last_err: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=10.0),
                ) as client:
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    content = ""
                    for candidate in data.get("candidates", []):
                        for part in candidate.get("content", {}).get("parts", []):
                            content += part.get("text", "")
                    if not content:
                        raise ValueError("Empty response from Google Gemini")
                    logger.info(
                        "google_chat_response",
                        model=self.model,
                        attempt=attempt,
                    )
                    return content
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "ai_chat_error",
                    api_format="google",
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(2**attempt)
                else:
                    raise RuntimeError(
                        f"Google Gemini API call failed after {self.max_retries} attempts: {last_err}"
                    ) from last_err

        raise RuntimeError("Google Gemini chat call exhausted retries")
