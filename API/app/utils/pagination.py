"""
Pagination utilities for the PostgreSQL Health Monitoring API.

Provides:
  - ``PaginationParams`` — FastAPI dependency class for ``limit`` / ``offset``
    query parameters with sensible defaults and a hard cap.
  - ``PaginationMeta`` — Pydantic model representing the pagination block
    returned inside ``meta.pagination``.
  - ``build_pagination_meta`` — helper that constructs a ``PaginationMeta``
    from a total row count plus the current limit/offset values.
"""

from dataclasses import dataclass

from fastapi import Query
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_LIMIT = 100
_DEFAULT_OFFSET = 0
_MAX_LIMIT = 1000


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


class PaginationParams:
    """
    FastAPI dependency that extracts and validates ``limit`` and ``offset``
    query parameters.

    Usage::

        @router.get("/items")
        async def list_items(pagination: PaginationParams = Depends()):
            ...

    Attributes:
        limit:  Maximum number of items to return (1–1000, default 100).
        offset: Number of items to skip (≥ 0, default 0).
    """

    def __init__(
        self,
        limit: int = Query(
            default=_DEFAULT_LIMIT,
            ge=1,
            le=_MAX_LIMIT,
            description=f"Maximum number of items to return (1–{_MAX_LIMIT}).",
        ),
        offset: int = Query(
            default=_DEFAULT_OFFSET,
            ge=0,
            description="Number of items to skip before returning results.",
        ),
    ) -> None:
        self.limit = limit
        self.offset = offset


# ---------------------------------------------------------------------------
# Pagination metadata model
# ---------------------------------------------------------------------------


class PaginationMeta(BaseModel):
    """
    Pagination metadata included in every paginated list response.

    Attributes:
        total:    Total number of items matching the query (before pagination).
        limit:    The ``limit`` value that was applied.
        offset:   The ``offset`` value that was applied.
        has_more: ``True`` when there are additional items beyond this page.
    """

    total: int
    limit: int
    offset: int
    has_more: bool


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def build_pagination_meta(total: int, limit: int, offset: int) -> dict:
    """
    Build a pagination metadata dict suitable for use in ``success_response``.

    Args:
        total:  Total number of matching rows (before pagination).
        limit:  The limit that was applied to the query.
        offset: The offset that was applied to the query.

    Returns:
        A plain dict with ``total``, ``limit``, ``offset``, and ``has_more``
        keys, ready to be passed as the ``pagination`` argument of
        :func:`~app.utils.envelope.success_response`.
    """
    return PaginationMeta(
        total=total,
        limit=limit,
        offset=offset,
        has_more=(offset + limit) < total,
    ).model_dump()
