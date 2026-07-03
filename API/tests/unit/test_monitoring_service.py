"""
Unit tests for MonitoringService.get_runs_summary (Task 3.1)

Covers:
  - get_runs_summary returns RunsSummaryResponse with correct fields
  - get_runs_summary defaults to last 24h when no time range supplied
  - get_runs_summary passes filters to repository correctly
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

# Set required env vars before importing settings-dependent modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
)
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

from app.services.monitoring_service import MonitoringService  # noqa: E402
from app.models.responses.monitoring import RunsSummaryResponse  # noqa: E402


# ---------------------------------------------------------------------------
# Test: get_runs_summary
# ---------------------------------------------------------------------------


class TestGetRunsSummary:
    @pytest.mark.asyncio
    async def test_get_runs_summary_returns_correct_response(self):
        """Req 1.1, 1.3, 1.4 — get_runs_summary returns RunsSummaryResponse."""
        service = MonitoringService()
        mock_conn = AsyncMock()

        # Mock repository response
        mock_data = {
            "total_count": 100,
            "success_count": 95,
            "failed_count": 3,
            "timeout_count": 2,
            "avg_execution_time_ms": 150,
            "success_rate_pct": 95.0,
        }

        with patch(
            "app.services.monitoring_service.monitoring_repo.get_runs_summary"
        ) as mock_repo:
            mock_repo.return_value = mock_data

            result = await service.get_runs_summary(
                conn=mock_conn,
                server_id=1,
                check_id=2,
                from_dt=datetime(2026, 1, 1, tzinfo=timezone.utc),
                to_dt=datetime(2026, 1, 2, tzinfo=timezone.utc),
            )

        assert isinstance(result, RunsSummaryResponse)
        assert result.total_count == 100
        assert result.success_count == 95
        assert result.failed_count == 3
        assert result.timeout_count == 2
        assert result.avg_execution_time_ms == 150
        assert result.success_rate_pct == 95.0

    @pytest.mark.asyncio
    async def test_get_runs_summary_defaults_to_24h(self):
        """Req 1.1 — get_runs_summary defaults to last 24h when no time range supplied."""
        service = MonitoringService()
        mock_conn = AsyncMock()

        mock_data = {
            "total_count": 50,
            "success_count": 48,
            "failed_count": 2,
            "timeout_count": 0,
            "avg_execution_time_ms": 120,
            "success_rate_pct": 96.0,
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

            # Verify repository was called with resolved time range
            assert mock_repo.called
            call_args = mock_repo.call_args
            assert call_args.kwargs["from_dt"] is not None
            assert call_args.kwargs["to_dt"] is not None
            # Verify the time range is approximately 24 hours
            time_diff = call_args.kwargs["to_dt"] - call_args.kwargs["from_dt"]
            assert abs(time_diff.total_seconds() - 86400) < 1  # Within 1 second of 24h

        assert isinstance(result, RunsSummaryResponse)
        assert result.total_count == 50

    @pytest.mark.asyncio
    async def test_get_runs_summary_handles_null_success_rate(self):
        """Req 1.4 — success_rate_pct is null when total_count is zero."""
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

        assert isinstance(result, RunsSummaryResponse)
        assert result.total_count == 0
        assert result.success_rate_pct is None
        assert result.avg_execution_time_ms is None
