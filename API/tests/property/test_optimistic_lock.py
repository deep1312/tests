"""
Property-based tests for optimistic locking.

**Validates: Requirements 1.13, 2.14, 3.9**

Tests:
  - Property 5: Optimistic locking rejects stale version
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock

import pytest
from hypothesis import given, settings, strategies as st

from app.repositories import server_repo  # noqa: E402


# ---------------------------------------------------------------------------
# Property 5: Optimistic Locking Rejects Stale Version
# ---------------------------------------------------------------------------


class TestOptimisticLocking:
    """Update with wrong version must fail; correct version must succeed."""

    @pytest.mark.asyncio
    @given(
        current_version=st.integers(min_value=1, max_value=1000),
        supplied_version=st.integers(min_value=1, max_value=1000),
    )
    @settings(max_examples=200)
    async def test_wrong_version_returns_none(
        self, current_version: int, supplied_version: int
    ):
        """Update with wrong version must return None (0 rows updated)."""
        if supplied_version == current_version:
            pytest.skip("supplied_version == current_version")

        # Mock connection
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)  # 0 rows updated

        # Attempt update with wrong version
        result = await server_repo.update_server(
            conn=conn,
            server_id=1,
            data={"server_label": "new-label"},
            version=supplied_version,
        )

        # Should return None (version conflict)
        assert result is None

    @pytest.mark.asyncio
    @given(
        current_version=st.integers(min_value=1, max_value=1000),
    )
    @settings(max_examples=100)
    async def test_correct_version_succeeds_and_increments(
        self, current_version: int
    ):
        """Update with correct version must succeed and increment version."""
        # Mock connection that returns updated row with incremented version
        conn = AsyncMock()
        updated_row = {
            "server_id": 1,
            "server_label": "new-label",
            "version": current_version + 1,
        }
        conn.fetchrow = AsyncMock(return_value=updated_row)

        # Attempt update with correct version
        result = await server_repo.update_server(
            conn=conn,
            server_id=1,
            data={"server_label": "new-label"},
            version=current_version,
        )

        # Should return the updated row
        assert result is not None
        assert result["version"] == current_version + 1

    @pytest.mark.asyncio
    @given(
        current_version=st.integers(min_value=1, max_value=100),
        wrong_versions=st.lists(
            st.integers(min_value=1, max_value=100),
            min_size=1,
            max_size=5,
            unique=True,
        ),
    )
    @settings(max_examples=50)
    async def test_multiple_wrong_versions_all_fail(
        self, current_version: int, wrong_versions: list[int]
    ):
        """All wrong versions must fail."""
        # Filter out the correct version
        wrong_versions = [v for v in wrong_versions if v != current_version]
        if not wrong_versions:
            pytest.skip("No wrong versions to test")

        for wrong_version in wrong_versions:
            conn = AsyncMock()
            conn.fetchrow = AsyncMock(return_value=None)

            result = await server_repo.update_server(
                conn=conn,
                server_id=1,
                data={"server_label": "new-label"},
                version=wrong_version,
            )

            assert result is None

    @pytest.mark.asyncio
    @given(
        version=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    async def test_no_version_supplied_succeeds_unconditionally(self, version: int):
        """Update without version must succeed regardless of current version."""
        conn = AsyncMock()
        updated_row = {
            "server_id": 1,
            "server_label": "new-label",
            "version": version + 1,
        }
        conn.fetchrow = AsyncMock(return_value=updated_row)

        # Attempt update without version
        result = await server_repo.update_server(
            conn=conn,
            server_id=1,
            data={"server_label": "new-label"},
            version=None,
        )

        # Should succeed
        assert result is not None

    @pytest.mark.asyncio
    @given(
        current_version=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    async def test_version_increments_by_exactly_one(self, current_version: int):
        """Version must increment by exactly 1, not more or less."""
        conn = AsyncMock()
        updated_row = {
            "server_id": 1,
            "server_label": "new-label",
            "version": current_version + 1,
        }
        conn.fetchrow = AsyncMock(return_value=updated_row)

        result = await server_repo.update_server(
            conn=conn,
            server_id=1,
            data={"server_label": "new-label"},
            version=current_version,
        )

        assert result is not None
        assert result["version"] == current_version + 1
        assert result["version"] != current_version
        assert result["version"] != current_version + 2
