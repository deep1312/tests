"""
Per-user token-bucket rate limiter middleware.

Implements a token-bucket algorithm keyed by user identity:
  - If ``request.state.user_context`` is set (i.e. the Auth middleware ran
    first and validated the JWT), the bucket key is the user's ``user_id``.
  - Otherwise the client's IP address is used as the key (covers public
    endpoints such as ``/auth/login``).

The bucket capacity and refill rate are both equal to ``RATE_LIMIT_RPM``
(requests per minute) from settings.  Tokens are refilled continuously based
on elapsed wall-clock time, so a client that sends requests at a steady rate
below the limit will never be throttled.

When the bucket is empty the middleware returns HTTP 429 with a
``Retry-After`` header indicating how many seconds the client must wait before
the next token becomes available.

Thread safety is provided by a per-bucket ``asyncio.Lock``.  The global
``_buckets`` dict is protected by a separate ``_registry_lock`` to avoid race
conditions when creating new bucket entries.

Req 13.6 — per-user rate limiting with HTTP 429 + Retry-After.
"""

from __future__ import annotations

import asyncio
import json
import math
import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings


class _TokenBucket:
    """A single token bucket for one user/IP."""

    __slots__ = ("capacity", "tokens", "refill_rate", "last_refill", "lock")

    def __init__(self, capacity: int, refill_rate: float) -> None:
        self.capacity: int = capacity
        self.tokens: float = float(capacity)
        self.refill_rate: float = refill_rate  # tokens per second
        self.last_refill: float = time.monotonic()
        self.lock: asyncio.Lock = asyncio.Lock()

    async def consume(self) -> tuple[bool, float]:
        """
        Attempt to consume one token.

        Returns:
            (allowed, retry_after_seconds)
              - ``allowed=True, retry_after=0.0`` when a token was consumed.
              - ``allowed=False, retry_after=N`` when the bucket is empty;
                N is the number of seconds until the next token is available.
        """
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_rate,
            )
            self.last_refill = now

            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return True, 0.0

            # Seconds until the next token arrives.
            retry_after = (1.0 - self.tokens) / self.refill_rate
            return False, retry_after


# ---------------------------------------------------------------------------
# Global bucket registry
# ---------------------------------------------------------------------------

_buckets: dict[str, _TokenBucket] = {}
_registry_lock: asyncio.Lock = asyncio.Lock()


async def _get_bucket(key: str, capacity: int, refill_rate: float) -> _TokenBucket:
    """Return the existing bucket for *key*, or create a new one."""
    if key in _buckets:
        return _buckets[key]

    async with _registry_lock:
        # Double-checked locking: another coroutine may have created the
        # bucket while we were waiting for the registry lock.
        if key not in _buckets:
            _buckets[key] = _TokenBucket(capacity=capacity, refill_rate=refill_rate)
        return _buckets[key]


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter keyed by authenticated user ID or client IP."""

    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        rpm: int = settings.RATE_LIMIT_RPM

        # Capacity = RPM; refill rate = RPM / 60 tokens per second.
        capacity = rpm
        refill_rate = rpm / 60.0

        # Determine the bucket key.
        user_context: Any = getattr(request.state, "user_context", None)
        if user_context is not None:
            key = f"user:{user_context.user_id}"
        else:
            # Fall back to the client IP address.
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                key = f"ip:{forwarded_for.split(',')[0].strip()}"
            else:
                key = f"ip:{request.client.host if request.client else 'unknown'}"

        bucket = await _get_bucket(key, capacity, refill_rate)
        allowed, retry_after = await bucket.consume()

        if allowed:
            return await call_next(request)

        # Round up to the nearest whole second for the Retry-After header.
        retry_after_secs = math.ceil(retry_after)
        body = json.dumps(
            {
                "error": {
                    "code": "too_many_requests",
                    "message": (
                        "Rate limit exceeded. "
                        f"Please retry after {retry_after_secs} second(s)."
                    ),
                    "fields": None,
                }
            }
        )
        return Response(
            content=body,
            status_code=429,
            headers={
                "Content-Type": "application/json",
                "Retry-After": str(retry_after_secs),
            },
        )
