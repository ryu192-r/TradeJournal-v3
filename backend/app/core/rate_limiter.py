"""Simple IP-based rate limiter middleware (pure ASGI).

Uses a sliding window of recent request timestamps per IP.
No external dependencies — just stdlib + Starlette.
"""

import os
import time
from collections import defaultdict
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Send, Scope


class _RateLimiterConfig:
    GENERAL_LIMIT = 60   # requests per minute
    AUTH_LIMIT = 10       # requests per minute
    WINDOW_SECONDS = 60


# Disable all rate limiting when set (useful for CI/tests in Docker)
RATE_LIMIT_DISABLED = os.environ.get("RATE_LIMIT_OFF", "false").lower() == "true"


class RateLimiter:
    """IP-based rate limiter with per-path limits.

    Buckets:
      - health: unlimited
      - auth: 10 req/min for paths containing '/auth'
      - general: 60 req/min for everything else

    Note: This is a best-effort in-memory limiter (per-process).
    Behind a load balancer you'd want Redis-backed limiting.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._config = _RateLimiterConfig()
        # key = f"{ip}:{bucket}" → list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_bucket(self, path: str) -> str:
        if path == "/health" or path.startswith("/api/v1/health"):
            return "health"
        if "/auth" in path:
            return "auth"
        return "general"

    def _check_rate(self, client_ip: str, bucket: str) -> tuple[bool, int]:
        if bucket == "health":
            return True, 0

        limit = (self._config.AUTH_LIMIT if bucket == "auth"
                 else self._config.GENERAL_LIMIT)

        now = time.time()
        cutoff = now - self._config.WINDOW_SECONDS
        key = f"{client_ip}:{bucket}"

        # Prune expired timestamps
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= limit:
            oldest = self._requests[key][0]
            retry_after = int(oldest + self._config.WINDOW_SECONDS - now) + 1
            return False, max(retry_after, 1)

        self._requests[key].append(now)
        return True, 0

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or RATE_LIMIT_DISABLED:
            if scope["type"] == "http":
                await self.app(scope, receive, send)
            return
            return

        request = Request(scope, receive)
        client_ip = request.client.host if request.client else "unknown"
        bucket = self._get_bucket(scope["path"])

        # Allow bypass via env var (tests, development)
        if os.environ.get("RATE_LIMIT_OFF", "").lower() in ("1", "true", "yes"):
            await self.app(scope, receive, send)
            return

        allowed, retry_after = self._check_rate(client_ip, bucket)

        if not allowed:
            body = (
                f'Rate limit exceeded. '
                f'Try again in {retry_after} seconds.'
            ).encode()
            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"retry-after", str(retry_after).encode()),
                    (b"content-length", str(len(body)).encode()),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": body,
            })
            return

        await self.app(scope, receive, send)
