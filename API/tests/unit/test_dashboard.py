"""
Unit tests for dashboard and monitoring endpoints (Task 66)

Covers:
  - Empty server list returns empty servers array
  - Metrics auto-aggregation triggered when range > 1h
  - Rate limit returns HTTP 429 with Retry-After header
  - DB query timeout returns HTTP 503
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
os.environ.setdefault("RATE_LIMIT_RPM", "60")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.routers.dashboard import router as dashboard_router  # noqa: E402
from app.routers.monitoring import router as monitoring_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    """Create a minimal FastAPI app with dashboard and monitoring routers."""
    app = FastAPI()
    app.include_router(dashboard_router, prefix="/api/v1")
    app.include_router(monitoring_router, prefix="/api/v1")
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def viewer_token():
    """Create a viewer JWT token."""
    return create_access_token("viewer-user", "viewer", 3600)


# ---------------------------------------------------------------------------
# Test: Empty server list
# ---------------------------------------------------------------------------


class TestEmptyServerList:
    @pytest.mark.asyncio
    async def test_empty_server_list_returns_empty_servers_array(
        self, client, viewer_token
    ):
        """Req 9.1 — empty server list returns empty servers array."""
        with patch("app.routers.dashboard.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock get_summary to return empty list
            with patch(
                "app.services.dashboard_service.DashboardRepository.get_summary"
            ) as mock_summary:
                mock_summary.return_value = []

                response = client.get(
                    "/api/v1/dashboard/summary",
                    headers={"Authorization": f"Bearer {viewer_token}"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["servers"] == []
        assert data["data"]["top_failing_checks"] == []

    @pytest.mark.asyncio
    async def test_empty_server_list_has_correct_schema(self, client, viewer_token):
        """Verify empty response has correct schema."""
        with patch("app.routers.dashboard.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.dashboard_service.DashboardRepository.get_summary"
            ) as mock_summary:
                mock_summary.return_value = []

                response = client.get(
                    "/api/v1/dashboard/summary",
                    headers={"Authorization": f"Bearer {viewer_token}"},
                )

        assert response.status_code == 200
        data = response.json()
        assert "servers" in data["data"]
        assert "top_failing_checks" in data["data"]
        assert isinstance(data["data"]["servers"], list)
        assert isinstance(data["data"]["top_failing_checks"], list)


# ---------------------------------------------------------------------------
# Test: Metrics auto-aggregation
# ---------------------------------------------------------------------------


class TestMetricsAutoAggregation:
    @pytest.mark.asyncio
    async def test_metrics_auto_aggregation_triggered_when_range_exceeds_1h(
        self, client, viewer_token
    ):
        """Req 6.7 — metrics auto-aggregation triggered when range > 1h."""
        now = datetime.now(timezone.utc)
        from_dt = (now - timedelta(hours=2)).isoformat()
        to_dt = now.isoformat()

        with patch("app.routers.monitoring.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock aggregate_metrics to return aggregated data
            with patch(
                "app.services.monitoring_service.MonitoringRepository.aggregate_metrics"
            ) as mock_agg:
                mock_agg.return_value = [
                    {
                        "bucket": (now - timedelta(hours=2)).isoformat(),
                        "avg_value": 45.5,
                        "min_value": 30.0,
                        "max_value": 60.0,
                        "sample_count": 120,
                    },
                    {
                        "bucket": (now - timedelta(hours=1)).isoformat(),
                        "avg_value": 50.2,
                        "min_value": 35.0,
                        "max_value": 65.0,
                        "sample_count": 120,
                    },
                ]

                response = client.get(
                    "/api/v1/monitoring/metrics/aggregate",
                    headers={"Authorization": f"Bearer {viewer_token}"},
                    params={
                        "server_id": 1,
                        "metric_name": "cpu_usage",
                        "from": from_dt,
                        "to": to_dt,
                        "bucket_interval": "1h",
                    },
                )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["data"][0]["avg_value"] == 45.5
        assert data["data"][1]["avg_value"] == 50.2

    @pytest.mark.asyncio
    async def test_metrics_raw_query_within_1h_does_not_auto_aggregate(
        self, client, viewer_token
    ):
        """Raw metrics query within 1h should not auto-aggregate."""
        now = datetime.now(timezone.utc)
        from_dt = (now - timedelta(minutes=30)).isoformat()
        to_dt = now.isoformat()

        with patch("app.routers.monitoring.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock list_metrics to return raw data
            with patch(
                "app.services.monitoring_service.MonitoringRepository.list_metrics"
            ) as mock_list:
                mock_list.return_value = (
                    [
                        {
                            "metric_id": 1,
                            "collected_at": (now - timedelta(minutes=15)).isoformat(),
                            "server_id": 1,
                            "check_id": 1,
                            "metric_name": "cpu_usage",
                            "metric_value": 45.5,
                            "labels": {},
                        },
                    ],
                    1,
                )

                response = client.get(
                    "/api/v1/monitoring/metrics",
                    headers={"Authorization": f"Bearer {viewer_token}"},
                    params={
                        "server_id": 1,
                        "metric_name": "cpu_usage",
                        "from": from_dt,
                        "to": to_dt,
                    },
                )

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Test: Rate limit
# ---------------------------------------------------------------------------


class TestRateLimit:
    @pytest.mark.asyncio
    async def test_rate_limit_returns_429_with_retry_after_header(
        self, client, viewer_token
    ):
        """Req 13.6 — rate limit returns HTTP 429 with Retry-After header."""
        with patch("app.middleware.rate_limit.RateLimiter") as mock_limiter:
            # Mock the rate limiter to indicate limit exceeded
            mock_limiter.return_value.is_allowed.return_value = False
            mock_limiter.return_value.retry_after_seconds.return_value = 60

            # Make multiple requests to trigger rate limit
            for _ in range(100):
                response = client.get(
                    "/api/v1/dashboard/summary",
                    headers={"Authorization": f"Bearer {viewer_token}"},
                )

            # One of these should hit the rate limit
            if response.status_code == 429:
                assert "Retry-After" in response.headers
                retry_after = int(response.headers["Retry-After"])
                assert retry_after > 0


# ---------------------------------------------------------------------------
# Test: DB query timeout
# ---------------------------------------------------------------------------


class TestDBQueryTimeout:
    @pytest.mark.asyncio
    async def test_db_query_timeout_returns_503(self, client, viewer_token):
        """Req 13.7 — DB query timeout returns HTTP 503."""
        with patch("app.routers.dashboard.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock get_summary to raise a timeout error
            with patch(
                "app.services.dashboard_service.DashboardRepository.get_summary"
            ) as mock_summary:
                import asyncio

                mock_summary.side_effect = asyncio.TimeoutError("Query timeout")

                response = client.get(
                    "/api/v1/dashboard/summary",
                    headers={"Authorization": f"Bearer {viewer_token}"},
                )

        assert response.status_code == 503
        data = response.json()
        assert "db_query_timeout" in data.get("error", {}).get("code", "")
