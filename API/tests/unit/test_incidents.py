"""
Unit tests for incident management endpoints (Task 65)

Covers:
  - Root cause PATCH succeeds for admin
  - Root cause PATCH returns HTTP 403 for viewer
"""

from __future__ import annotations

import os
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
from app.routers.incidents import router as incidents_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    """Create a minimal FastAPI app with incidents router."""
    app = FastAPI()
    app.include_router(incidents_router, prefix="/api/v1")
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
# Test: Root cause PATCH for admin
# ---------------------------------------------------------------------------


class TestRootCausePatchAdmin:
    @pytest.mark.asyncio
    async def test_root_cause_patch_succeeds_for_admin(self, client, admin_token):
        """Req 8.10 — root_cause PATCH succeeds for admin."""
        with patch("app.routers.incidents.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock patch_root_cause to return updated incident
            with patch(
                "app.services.incident_service.IncidentRepository.patch_root_cause"
            ) as mock_patch:
                mock_patch.return_value = {
                    "incident_id": 1,
                    "server_id": 1,
                    "check_id": 1,
                    "status": 1,  # OPEN
                    "started_at": "2026-01-01T00:00:00Z",
                    "ended_at": None,
                    "root_cause": "Database connection pool exhausted",
                    "duration_seconds": 3600,
                }

                response = client.patch(
                    "/api/v1/incidents/1",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"root_cause": "Database connection pool exhausted"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["root_cause"] == "Database connection pool exhausted"

    @pytest.mark.asyncio
    async def test_root_cause_patch_updates_field(self, client, admin_token):
        """Verify root_cause field is updated."""
        with patch("app.routers.incidents.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.incident_service.IncidentRepository.patch_root_cause"
            ) as mock_patch:
                new_root_cause = "Disk space full on replica"
                mock_patch.return_value = {
                    "incident_id": 2,
                    "server_id": 1,
                    "check_id": 2,
                    "status": 2,  # RESOLVED
                    "started_at": "2026-01-01T00:00:00Z",
                    "ended_at": "2026-01-01T02:00:00Z",
                    "root_cause": new_root_cause,
                    "duration_seconds": 7200,
                }

                response = client.patch(
                    "/api/v1/incidents/2",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"root_cause": new_root_cause},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["root_cause"] == new_root_cause


# ---------------------------------------------------------------------------
# Test: Root cause PATCH for viewer
# ---------------------------------------------------------------------------


class TestRootCausePatchViewer:
    @pytest.mark.asyncio
    async def test_root_cause_patch_returns_403_for_viewer(self, client, viewer_token):
        """Req 8.10 — root_cause PATCH returns HTTP 403 for viewer."""
        response = client.patch(
            "/api/v1/incidents/1",
            headers={"Authorization": f"Bearer {viewer_token}"},
            json={"root_cause": "Some root cause"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_root_cause_patch_admin_allowed(self, client, admin_token):
        """Admin role can patch root_cause."""
        with patch("app.routers.incidents.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.incident_service.IncidentRepository.patch_root_cause"
            ) as mock_patch:
                mock_patch.return_value = {
                    "incident_id": 3,
                    "server_id": 1,
                    "check_id": 1,
                    "status": 1,
                    "started_at": "2026-01-01T00:00:00Z",
                    "ended_at": None,
                    "root_cause": "Admin root cause",
                    "duration_seconds": 1800,
                }

                response = client.patch(
                    "/api/v1/incidents/3",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"root_cause": "Admin root cause"},
                )

        assert response.status_code == 200
