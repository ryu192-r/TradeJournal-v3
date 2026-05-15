# ADR-003: AI Provider Routing (Ollama Native vs OpenAI-Compatible)

## Status
Accepted

## Context
The AI Coach supports 8 providers. Ollama has two modes: local (native `/api/chat` endpoint) and cloud (OpenAI-compatible). Other providers (OpenAI, DeepSeek, Anthropic, Google, Custom, OpenCode Zen) use OpenAI-compatible format.

## Decision
Two format constants in `AI_PROVIDERS`:
- `FORMAT_OLLAMA` — native Ollama `/api/chat` endpoint (local mode)
- `FORMAT_OPENAI` — OpenAI-compatible `/v1/chat/completions` endpoint

The `AIProviderClient` routes based on format:
- `FORMAT_OLLAMA` → `_ollama_chat()` — POST to `{base_url}/api/chat` with `{model, messages, stream}`
- `FORMAT_OPENAI` → `_openai_chat()` — POST to `{base_url}/v1/chat/completions` with OpenAI schema

## Consequences
- ✅ Ollama local mode works without OpenAI shim
- ✅ All other providers share single OpenAI-compatible code path
- ✅ Easy to add new OpenAI-compatible providers
- ⚠️ Two code paths to maintain
- ⚠️ Ollama cloud models must use `FORMAT_OPENAI` (not native)

## Implementation
- `backend/app/core/ai_config.py` — `AI_PROVIDERS` dict with format constants
- `backend/app/core/ai_provider_client.py` — `_ollama_chat()` and `_openai_chat()` handlers
- `frontend/src/pages/AICoachPage.tsx` — `getAiProviders()` extracts `.data.providers`
