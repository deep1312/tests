"""
FastAPI application factory for the PostgreSQL Health Monitoring API.

Middleware registration order (outermost → innermost):
  CORS → Request ID → Auth → Rate Limit

Routers registered under /api/v1:
  auth, servers, checks, thresholds, monitoring, alerts, incidents,
  dashboard, admin, audit
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.openapi.utils import get_openapi

# ---------------------------------------------------------------------------
# Router imports
# ---------------------------------------------------------------------------
from app.routers import (
    auth as auth_router,
    servers as servers_router,
    checks as checks_router,
    thresholds as thresholds_router,
    monitoring as monitoring_router,
    alerts as alerts_router,
    incidents as incidents_router,
    dashboard as dashboard_router,
    admin as admin_router,
    audit as audit_router,
    schema_tables as schema_tables_router,
)

# ---------------------------------------------------------------------------
# Middleware imports
# ---------------------------------------------------------------------------
from app.middleware.cors import add_cors_middleware
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

# ---------------------------------------------------------------------------
# Core / Infrastructure imports
# ---------------------------------------------------------------------------
from app.db.pool import create_pool, close_pool
from app.core.encryption import CredentialEncryptor
from app.core.config import get_settings
from app.utils.envelope import error_response

logger = logging.getLogger(__name__)
API_V1_PREFIX = "/api/v1"


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown event handlers
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):

    # 1. Initialize DB Pool
    app.state.pool = await create_pool()

    # 2. Reset Rate Limit Buckets
    from app.middleware.rate_limit import _buckets
    _buckets.clear()

    # 3. Validate and Initialize Credential Encryption (Req 11.4)
    try:
        settings = get_settings()

        encryptor = CredentialEncryptor(
            key_b64=settings.CREDENTIAL_ENCRYPTION_KEY
        )

        app.state.encryptor = encryptor

        logger.info(
            "CredentialEncryptor initialized successfully."
        )

    except Exception as exc:
        logger.critical(
            "Failed to initialize CredentialEncryptor: %s",
            exc,
        )

        raise RuntimeError(
            "Service cannot start without a valid encryption key."
        ) from exc

    yield

    # 4. Graceful Shutdown
    await close_pool()


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:

    app = FastAPI(
        title="PostgreSQL Health Monitoring API",
        version="1.0.0",
        description=(
            "Backend API for the PostgreSQL Health Monitoring Platform. "
            "Manages server configuration, check definitions, thresholds, "
            "monitoring visibility, alerts, incidents, and audit logs."
        ),
        lifespan=lifespan,
    )

    # -----------------------------------------------------------------------
    # Swagger / OpenAPI Security
    # -----------------------------------------------------------------------

    def custom_openapi():

        if app.openapi_schema:
            return app.openapi_schema

        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )

        # ---------------------------------------------------------------
        # JWT Bearer Security Scheme
        # ---------------------------------------------------------------

        openapi_schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }

        # ---------------------------------------------------------------
        # Apply security to ALL endpoints globally
        # ---------------------------------------------------------------

        for path in openapi_schema["paths"].values():
            for operation in path.values():
                operation["security"] = [{"BearerAuth": []}]

        app.openapi_schema = openapi_schema

        return app.openapi_schema

    app.openapi = custom_openapi

    # -----------------------------------------------------------------------
    # Middleware registration
    # -----------------------------------------------------------------------

    add_cors_middleware(app)

    app.add_middleware(RequestIDMiddleware)

    app.add_middleware(AuthMiddleware)

    app.add_middleware(RateLimitMiddleware)

    # -----------------------------------------------------------------------
    # Router registration
    # -----------------------------------------------------------------------

    app.include_router(
        auth_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        servers_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        checks_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        checks_router._mappings_router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        thresholds_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        monitoring_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        alerts_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        incidents_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        dashboard_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        admin_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        audit_router.router,
        prefix=API_V1_PREFIX,
    )

    app.include_router(
        schema_tables_router.router,
        prefix=API_V1_PREFIX,
    )

    # -----------------------------------------------------------------------
    # Health check
    # -----------------------------------------------------------------------

    @app.get("/", tags=["Health"])
    async def root():

        return {
            "status": "online",
            "message": "PostgreSQL Health Monitoring API",
        }

    # -----------------------------------------------------------------------
    # Exception handlers
    # -----------------------------------------------------------------------

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ):

        fields = {}

        for err in exc.errors():

            loc = err.get("loc", ())

            parts = [
                str(p)
                for p in loc
                if p != "body"
            ]

            key = ".".join(parts) if parts else "request"

            fields[key] = err["msg"]

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response(
                code="validation_error",
                message="The request data was invalid.",
                fields=fields,
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request,
        exc: StarletteHTTPException,
    ):

        code_map = {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            409: "conflict",
            429: "rate_limit_exceeded",
            500: "internal_error",
            503: "db_query_timeout",
        }

        code = code_map.get(
            exc.status_code,
            "http_error",
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(
                code=code,
                message=str(exc.detail),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request,
        exc: Exception,
    ):

        logger.exception(
            "Internal Server Error: %s",
            exc,
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response(
                code="internal_error",
                message=(
                    "An unexpected error occurred. "
                    "Please try again later."
                ),
            ),
        )

    return app


# ---------------------------------------------------------------------------
# Module-level app instance for uvicorn
# ---------------------------------------------------------------------------

app = create_app()