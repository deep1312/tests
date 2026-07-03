"""
Property-based tests for monitoring summary endpoint.

**Validates: Requirements 1.1, 1.3, 1.4**

Tests:
  - Property P1: Summary consistency — success_count + failed_count + timeout_count == total_count
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from hypothesis import given, settings, strategies as st

# Set required env vars before importing settings-dependent modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
)
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

from app.services.monitoring_service import MonitoringService  # noqa: E402
from app.models.responses.monitoring import RunsSummaryResponse  # noqa: E402


# ---------------------------------------------------------------------------
# Property P1: Summary Consistency
# ---------------------------------------------------------------------------
# success_count + failed_count + timeout_count == total_count for any valid filter


class TestSummaryConsistency:
    """Summary counts must be mathematically consistent."""

    @given(
        total_count=st.integers(min_value=0, max_value=10000),
        success_ratio=st.floats(min_value=0.0, max_value=1.0),
        failed_ratio=st.floats(min_value=0.0, max_value=1.0),
    )
    @settings(max_examples=200)
    @pytest.mark.asyncio
    async def test_summary_counts_sum_to_total(
        self, total_count: int, success_ratio: float, failed_ratio: float
    ):
        """
        **Validates: Requirements 1.1, 1.3, 1.4**

        For any valid filter combination, success_count + failed_count + timeout_count
        must equal total_count.
        """
        # Ensure ratios don't exceed 1.0 when combined
        if success_ratio + failed_ratio > 1.0:
            failed_ratio = 1.0 - success_ratio

        success_count = int(total_count * success_ratio)
        failed_count = int(total_count * failed_ratio)
        timeout_count = total_count - success_count - failed_count

        # Ensure non-negative counts
        assert success_count >= 0
        assert failed_count >= 0
        assert timeout_count >= 0

        # Calculate success rate
        if total_count > 0:
            success_rate_pct = round((success_count / total_count) * 100, 1)
        else:
            success_rate_pct = None

        service = MonitoringService()
        mock_conn = AsyncMock()

        mock_data = {
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "timeout_count": timeout_count,
            "avg_execution_time_ms": 150 if total_count > 0 else None,
            "success_rate_pct": success_rate_pct,
        }

        with patch(
            "app.services.monitoring_service.monitoring_repo.get_runs_summary"
        ) as mock_repo:
            mock_repo.return_value = mock_data

            result = await service.get_runs_summary(
                conn=mock_conn,
                server_id=None,
                check_id=None,
                from_dt=None,
                to_dt=None,
            )

        # Property P1: success_count + failed_count + timeout_count == total_count
        assert (
            result.success_count + result.failed_count + result.timeout_count
            == result.total_count
        ), (
            f"Count mismatch: {result.success_count} + {result.failed_count} + "
            f"{result.timeout_count} != {result.total_count}"
        )

    @given(
        server_id=st.one_of(st.none(), st.integers(min_value=1, max_value=1000)),
        check_id=st.one_of(st.none(), st.integers(min_value=1, max_value=1000)),
        total_count=st.integers(min_value=0, max_value=5000),
    )
    @settings(max_examples=150)
    @pytest.mark.asyncio
    async def test_summary_consistency_with_filters(
        self, server_id: int | None, check_id: int | None, total_count: int
    ):
        """
        **Validates: Requirements 1.1, 1.3, 1.4**

        Summary consistency must hold for any combination of server_id and check_id filters.
        """
        # Distribute counts across statuses
        success_count = int(total_count * 0.8)
        failed_count = int(total_count * 0.15)
        timeout_count = total_count - success_count - failed_count

        if total_count > 0:
            success_rate_pct = round((success_count / total_count) * 100, 1)
        else:
            success_rate_pct = None

        service = MonitoringService()
        mock_conn = AsyncMock()

        mock_data = {
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "timeout_count": timeout_count,
            "avg_execution_time_ms": 142 if total_count > 0 else None,
            "success_rate_pct": success_rate_pct,
        }

        with patch(
            "app.services.monitoring_service.monitoring_repo.get_runs_summary"
        ) as mock_repo:
            mock_repo.return_value = mock_data

            result = await service.get_runs_summary(
                conn=mock_conn,
                server_id=server_id,
                check_id=check_id,
                from_dt=None,
                to_dt=None,
            )

        # Property P1: success_count + failed_count + timeout_count == total_count
        assert (
            result.success_count + result.failed_count + result.timeout_count
            == result.total_count
        ), (
            f"Count mismatch with filters (server_id={server_id}, check_id={check_id}): "
            f"{result.success_count} + {result.failed_count} + {result.timeout_count} "
            f"!= {result.total_count}"
        )

    @given(
        from_offset_hours=st.integers(min_value=1, max_value=168),
        to_offset_hours=st.integers(min_value=0, max_value=0),
        total_count=st.integers(min_value=0, max_value=3000),
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_summary_consistency_with_time_ranges(
        self, from_offset_hours: int, to_offset_hours: int, total_count: int
    ):
        """
        **Validates: Requirements 1.1, 1.3, 1.4**

        Summary consistency must hold for any time range.
        """
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(hours=from_offset_hours)
        to_dt = now - timedelta(hours=to_offset_hours)

        # Distribute counts across statuses
        success_count = int(total_count * 0.85)
        failed_count = int(total_count * 0.10)
        timeout_count = total_count - success_count - failed_count

        if total_count > 0:
            success_rate_pct = round((success_count / total_count) * 100, 1)
        else:
            success_rate_pct = None

        service = MonitoringService()
        mock_conn = AsyncMock()

        mock_data = {
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "timeout_count": timeout_count,
            "avg_execution_time_ms": 145 if total_count > 0 else None,
            "success_rate_pct": success_rate_pct,
        }

        with patch(
            "app.services.monitoring_service.monitoring_repo.get_runs_summary"
        ) as mock_repo:
            mock_repo.return_value = mock_data

            result = await service.get_runs_summary(
                conn=mock_conn,
                server_id=None,
                check_id=None,
                from_dt=from_dt,
                to_dt=to_dt,
            )

        # Property P1: success_count + failed_count + timeout_count == total_count
        assert (
            result.success_count + result.failed_count + result.timeout_count
            == result.total_count
        ), (
            f"Count mismatch with time range ({from_dt} to {to_dt}): "
            f"{result.success_count} + {result.failed_count} + {result.timeout_count} "
            f"!= {result.total_count}"
        )

    @given(
        total_count=st.integers(min_value=0, max_value=10000),
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_summary_zero_total_count(self, total_count: int):
        """
        **Validates: Requirements 1.4**

        When total_count is zero, all individual counts must be zero and
        success_rate_pct must be None.
        """
        if total_count != 0:
            pytest.skip("Only testing zero total_count")

        service = MonitoringService()
        mock_conn = AsyncMock()

        mock_data = {
            "total_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "timeout_count": 0,
            "avg_execution_time_ms": None,
            "success_rate_pct": None,
        }

        with patch(
            "app.services.monitoring_service.monitoring_repo.get_runs_summary"
        ) as mock_repo:
            mock_repo.return_value = mock_data

            result = await service.get_runs_summary(
                conn=mock_conn,
            )

        # Property P1: success_count + failed_count + timeout_count == total_count
        assert (
            result.success_count + result.failed_count + result.timeout_count
            == result.total_count
        )
        assert result.total_count == 0
        assert result.success_count == 0
        assert result.failed_count == 0
        assert result.timeout_count == 0
        assert result.success_rate_pct is None

    @given(
        success_count=st.integers(min_value=0, max_value=5000),
        failed_count=st.integers(min_value=0, max_value=5000),
        timeout_count=st.integers(min_value=0, max_value=5000),
    )
    @settings(max_examples=200)
    @pytest.mark.asyncio
    async def test_summary_arbitrary_count_distribution(
        self, success_count: int, failed_count: int, timeout_count: int
    ):
        """
        **Validates: Requirements 1.1, 1.3, 1.4**

        Property P1 must hold for any arbitrary distribution of counts.
        """
        total_count = success_count + failed_count + timeout_count

        if total_count > 0:
            success_rate_pct = round((success_count / total_count) * 100, 1)
        else:
            success_rate_pct = None

        service = MonitoringService()
        mock_conn = AsyncMock()

        mock_data = {
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "timeout_count": timeout_count,
            "avg_execution_time_ms": 140 if total_count > 0 else None,
            "success_rate_pct": success_rate_pct,
        }

        with patch(
            "app.services.monitoring_service.monitoring_repo.get_runs_summary"
        ) as mock_repo:
            mock_repo.return_value = mock_data

            result = await service.get_runs_summary(
                conn=mock_conn,
            )

        # Property P1: success_count + failed_count + timeout_count == total_count
        assert (
            result.success_count + result.failed_count + result.timeout_count
            == result.total_count
        ), (
            f"Count mismatch: {result.success_count} + {result.failed_count} + "
            f"{result.timeout_count} != {result.total_count}"
        )
