"""
CORS middleware configuration.

Exposes a single helper function ``add_cors_middleware(app)`` that attaches
Starlette's built-in ``CORSMiddleware`` to the FastAPI application.

Allowed origins are read from ``Settings.CORS_ORIGINS`` (a ``List[str]``
defaulting to ``["*"]``).  All HTTP methods and headers are permitted so that
the API can be consumed by any frontend without additional CORS configuration.
"""

from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def add_cors_middleware(app: FastAPI) -> None:
    """
    Attach ``CORSMiddleware`` to *app* using the origins defined in settings.

    This function must be called **before** any other middleware is added so
    that CORS pre-flight (OPTIONS) requests are handled before authentication
    or rate-limiting logic runs.

    Args:
        app: The FastAPI application instance to configure.
    """
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
