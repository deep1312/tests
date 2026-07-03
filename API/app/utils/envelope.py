"""
Response envelope builder functions for the PostgreSQL Health Monitoring API.

All API responses use a consistent envelope structure:

Success:
    {
        "data": { ... },
        "meta": {
            "pagination": { "total": 150, "limit": 50, "offset": 0, "has_more": true },
            "filters": { "env_type": "prod", "is_active": true }
        }
    }

Error:
    {
        "error": {
            "code": "version_conflict",
            "message": "...",
            "fields": null
        }
    }
"""

from typing import Any


def success_response(
    data: Any,
    pagination: dict | None = None,
    filters: dict | None = None,
) -> dict:
    """
    Build a success response envelope.

    Args:
        data: The response payload (dict, list, or any JSON-serialisable value).
        pagination: Optional pagination metadata dict with keys:
                    total, limit, offset, has_more.
        filters: Optional dict of filter parameters that were applied to the query.

    Returns:
        A plain dict with ``data`` and ``meta`` keys, ready to be passed to
        ``JSONResponse(content=...)``.
    """
    meta: dict[str, Any] = {}
    if pagination is not None:
        meta["pagination"] = pagination
    if filters is not None:
        meta["filters"] = filters

    return {
        "data": data,
        "meta": meta,
    }


def error_response(
    code: str,
    message: str,
    fields: dict[str, str] | None = None,
) -> dict:
    """
    Build an error response envelope.

    Args:
        code: Machine-readable snake_case error code (e.g. ``"version_conflict"``).
        message: Human-readable description of the error.
        fields: Optional mapping of field names to per-field error messages.
                Populated for HTTP 422 validation errors; ``None`` otherwise.

    Returns:
        A plain dict with an ``error`` key, ready to be passed to
        ``JSONResponse(content=...)``.
    """
    return {
        "error": {
            "code": code,
            "message": message,
            "fields": fields,
        }
    }
