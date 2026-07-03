"""
Middleware package for the PostgreSQL Health Monitoring API.

Exports:
  - ``RequestIDMiddleware`` — injects / echoes ``X-Request-ID`` header
  - ``add_cors_middleware``  — attaches ``CORSMiddleware`` with settings-driven origins
  - ``RateLimitMiddleware``  — per-user token-bucket rate limiter (HTTP 429)
  - ``AuthMiddleware``       — JWT validation; injects ``UserContext`` into request state
"""

from app.middleware.auth import AuthMiddleware
from app.middleware.cors import add_cors_middleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_id import RequestIDMiddleware

__all__ = [
    "RequestIDMiddleware",
    "add_cors_middleware",
    "RateLimitMiddleware",
    "AuthMiddleware",
]
