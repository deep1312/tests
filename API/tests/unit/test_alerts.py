"""
Unit tests for alert management endpoints (Task 65)

Covers:
  - Acknowledge alert success
  - Already-acknowledged alert returns HTTP 409
  - Non-existent alert returns HTTP 404
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

# Set required env vars before importing settings-dependent modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
)
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.routers.alerts import router as alerts_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    """Create a minimal FastAPI app with alerts router."""
    app = FastAPI()
    app.include_router(alerts_router, prefix="/api/v1")
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def admin_token():
    """Create an admin JWT token."""
    return create_access_token("admin-user", "admin", 3600)


@pytest.fixture
def viewer_token():
    """Create a viewer JWT token."""
    return create_access_token("viewer-user", "viewer", 3600)


# ---------------------------------------------------------------------------
# Test: Acknowledge alert success
# ---------------------------------------------------------------------------


class TestAcknowledgeAlertSuccess:
    @pytest.mark.asyncio
    async def test_acknowledge_alert_success(self, client, admin_token):
        """Req 7.8 — acknowledge alert success."""
        triggered_at = datetime.now(timezone.utc).isoformat()

        with patch("app.routers.alerts.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock acknowledge_alert to return updated alert
            with patch(
                "app.services.alert_service.AlertRepository.acknowledge_alert"
            ) as mock_ack:
                mock_ack.return_value = {
                    "alert_id": 1,
                    "triggered_at": triggered_at,
                    "incident_id": 1,
                    "server_id": 1,
                    "check_id": 1,
                    "metric_name": "cpu_usage",
                    "observed_value": 95.5,
                    "status": 2,  # CRITICAL
                    "acknowledged_at": datetime.now(timezone.utc).isoformat(),
                }

                response = client.post(
                    "/api/v1/alerts/1/acknowledge",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"triggered_at": triggered_at},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["acknowledged_at"] is not None

    @pytest.mark.asyncio
    async def test_acknowledge_alert_returns_updated_alert(self, client, admin_token):
        """Verify acknowledge returns the updated alert record."""
        triggered_at = datetime.now(timezone.utc).isoformat()
        ack_time = datetime.now(timezone.utc).isoformat()

        with patch("app.routers.alerts.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.alert_service.AlertRepository.acknowledge_alert"
            ) as mock_ack:
                mock_ack.return_value = {
                    "alert_id": 2,
                    "triggered_at": triggered_at,
                    "incident_id": 1,
                    "server_id": 1,
                    "check_id": 1,
                    "metric_name": "memory_usage",
                    "observed_value": 87.2,
                    "status": 1,  # WARNING
                    "acknowledged_at": ack_time,
                }

                response = client.post(
                    "/api/v1/alerts/2/acknowledge",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"triggered_at": triggered_at},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["alert_id"] == 2
        assert data["data"]["acknowledged_at"] == ack_time


# ---------------------------------------------------------------------------
# Test: Already-acknowledged alert
# ---------------------------------------------------------------------------


class TestAlreadyAcknowledgedAlert:
    @pytest.mark.asyncio
    async def test_acknowledge_already_acknowledged_alert_returns_409(
        self, client, admin_token
    ):
        """Req 7.9 — already-acknowledged alert returns HTTP 409."""
        triggered_at = datetime.now(timezone.utc).isoformat()

        with patch("app.routers.alerts.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock acknowledge_alert to return None (already acknowledged)
            with patch(
                "app.services.alert_service.AlertRepository.acknowledge_alert"
            ) as mock_ack:
                mock_ack.return_value = None

                response = client.post(
                    "/api/v1/alerts/1/acknowledge",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"triggered_at": triggered_at},
                )

        assert response.status_code == 409
        data = response.json()
        assert "already_acknowledged" in data.get("error", {}).get("code", "")


# ---------------------------------------------------------------------------
# Test: Non-existent alert
# ---------------------------------------------------------------------------


class TestNonExistentAlert:
    @pytest.mark.asyncio
    async def test_acknowledge_nonexistent_alert_returns_404(
        self, client, admin_token
    ):
        """Req 7.9 — non-existent alert returns HTTP 404."""
        triggered_at = datetime.now(timezone.utc).isoformat()

        with patch("app.routers.alerts.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock acknowledge_alert to raise not found
            with patch(
                "app.services.alert_service.AlertRepository.acknowledge_alert"
            ) as mock_ack:
                from asyncpg import NoDataFoundError

                mock_ack.side_effect = NoDataFoundError("Alert not found")

                response = client.post(
                    "/api/v1/alerts/999/acknowledge",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"triggered_at": triggered_at},
                )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Test: RBAC for acknowledge
# ---------------------------------------------------------------------------


class TestAcknowledgeRBAC:
    @pytest.mark.asyncio
    async def test_acknowledge_viewer_returns_403(self, client, viewer_token):
        """Viewer role cannot acknowledge alerts."""
        triggered_at = datetime.now(timezone.utc).isoformat()

        response = client.post(
            "/api/v1/alerts/1/acknowledge",
            headers={"Authorization": f"Bearer {viewer_token}"},
            json={"triggered_at": triggered_at},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_acknowledge_admin_allowed(self, client, admin_token):
        """Admin role can acknowledge alerts."""
        triggered_at = datetime.now(timezone.utc).isoformat()

        with patch("app.routers.alerts.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.alert_service.AlertRepository.acknowledge_alert"
            ) as mock_ack:
                mock_ack.return_value = {
                    "alert_id": 1,
                    "triggered_at": triggered_at,
                    "incident_id": 1,
                    "server_id": 1,
                    "check_id": 1,
                    "metric_name": "cpu_usage",
                    "observed_value": 95.5,
                    "status": 2,
                    "acknowledged_at": datetime.now(timezone.utc).isoformat(),
                }

                response = client.post(
                    "/api/v1/alerts/1/acknowledge",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"triggered_at": triggered_at},
                )

        assert response.status_code == 200
