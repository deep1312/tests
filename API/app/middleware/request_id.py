"""
Request ID middleware.

Injects an ``X-Request-ID`` header into every request and response:
  - If the incoming request already carries an ``X-Request-ID`` header, that
    value is echoed back unchanged.
  - If the header is absent, a new UUID4 is generated and used.

The request ID is also stored on ``request.state.request_id`` so that it can
be included in structured log records by downstream handlers.
"""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that ensures every request has a unique trace ID."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Honour an existing X-Request-ID header (e.g. from a load balancer or
        # upstream proxy) so that the ID can be correlated across services.
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Expose the ID on request.state so that log handlers and downstream
        # middleware can reference it without re-parsing the headers.
        request.state.request_id = request_id

        response: Response = await call_next(request)

        # Echo the ID back in the response so clients can correlate log lines.
        response.headers["X-Request-ID"] = request_id
        return response
