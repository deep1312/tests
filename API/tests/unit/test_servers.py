"""
Unit tests for server management endpoints (Task 63)

Covers:
  - Connection validation in strict mode returns HTTP 422 on failure
  - Connection validation in warn mode persists record with warnings array
  - Soft delete sets is_active = false without deleting record
  - Hard delete blocked by monitoring data returns HTTP 409
  - Duplicate server_label returns HTTP 409
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
os.environ.setdefault("CONNECTION_VALIDATION_MODE", "warn")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.routers.servers import router as servers_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    """Create a minimal FastAPI app with servers router."""
    app = FastAPI()
    app.include_router(servers_router, prefix="/api/v1")
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
# Test: Connection validation in strict mode
# ---------------------------------------------------------------------------


class TestConnectionValidationStrict:
    @pytest.mark.asyncio
    async def test_connection_validation_strict_mode_failure_returns_422(
        self, client, admin_token
    ):
        """Req 1.11 — connection validation in strict mode returns HTTP 422 on failure."""
        with patch("app.routers.servers.get_db") as mock_get_db, patch(
            "app.services.server_service.validate_connection"
        ) as mock_validate:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock connection validation to fail
            mock_validate.side_effect = Exception("Connection failed")

            # Mock settings to use strict mode
            with patch("app.services.server_service.settings") as mock_settings:
                mock_settings.CONNECTION_VALIDATION_MODE = "strict"

                response = client.post(
                    "/api/v1/servers",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={
                        "server_label": "prod-db-1",
                        "server_ip": "192.168.1.100",
                        "port": 5432,
                        "db_name": "postgres",
                        "username": "monitor",
                        "password": "secret",
                    },
                )

        assert response.status_code == 422
        data = response.json()
        assert "connection_validation_failed" in data.get("error", {}).get("code", "")


# ---------------------------------------------------------------------------
# Test: Connection validation in warn mode
# ---------------------------------------------------------------------------


class TestConnectionValidationWarn:
    @pytest.mark.asyncio
    async def test_connection_validation_warn_mode_persists_with_warnings(
        self, client, admin_token
    ):
        """Req 1.11 — connection validation in warn mode persists record with warnings array."""
        with patch("app.routers.servers.get_db") as mock_get_db, patch(
            "app.services.server_service.validate_connection"
        ) as mock_validate:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock connection validation to fail
            mock_validate.side_effect = Exception("Connection failed")

            # Mock settings to use warn mode
            with patch("app.services.server_service.settings") as mock_settings:
                mock_settings.CONNECTION_VALIDATION_MODE = "warn"

                # Mock the create_server repo call to return a server record
                with patch(
                    "app.services.server_service.ServerRepository.create_server"
                ) as mock_create:
                    mock_create.return_value = {
                        "server_id": 1,
                        "server_label": "prod-db-1",
                        "server_ip": "192.168.1.100",
                        "port": 5432,
                        "db_name": "postgres",
                        "username": "monitor",
                        "is_active": True,
                        "created_at": "2026-01-01T00:00:00Z",
                        "updated_at": "2026-01-01T00:00:00Z",
                        "version": 1,
                    }

                    response = client.post(
                        "/api/v1/servers",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={
                            "server_label": "prod-db-1",
                            "server_ip": "192.168.1.100",
                            "port": 5432,
                            "db_name": "postgres",
                            "username": "monitor",
                            "password": "secret",
                        },
                    )

        assert response.status_code == 201
        data = response.json()
        assert "warnings" in data.get("data", {})
        assert isinstance(data["data"]["warnings"], list)


# ---------------------------------------------------------------------------
# Test: Soft delete
# ---------------------------------------------------------------------------


class TestSoftDelete:
    @pytest.mark.asyncio
    async def test_soft_delete_sets_is_active_false(self, client, admin_token):
        """Req 1.10 — soft delete sets is_active = false without deleting record."""
        with patch("app.routers.servers.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock the deactivate_server repo call
            with patch(
                "app.services.server_service.ServerRepository.deactivate_server"
            ) as mock_deactivate:
                mock_deactivate.return_value = {
                    "server_id": 1,
                    "server_label": "prod-db-1",
                    "server_ip": "192.168.1.100",
                    "port": 5432,
                    "db_name": "postgres",
                    "username": "monitor",
                    "is_active": False,  # soft deleted
                    "created_at": "2026-01-01T00:00:00Z",
                    "updated_at": "2026-01-01T00:00:00Z",
                    "version": 2,
                }

                response = client.patch(
                    "/api/v1/servers/1/deactivate",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["is_active"] is False


# ---------------------------------------------------------------------------
# Test: Hard delete blocked by monitoring data
# ---------------------------------------------------------------------------


class TestHardDeleteBlockedByMonitoringData:
    @pytest.mark.asyncio
    async def test_hard_delete_with_monitoring_data_returns_409(
        self, client, admin_token
    ):
        """Req 1.12 — hard delete blocked by monitoring data returns HTTP 409."""
        with patch("app.routers.servers.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock has_monitoring_data to return True
            with patch(
                "app.services.server_service.ServerRepository.has_monitoring_data"
            ) as mock_has_data:
                mock_has_data.return_value = True

                response = client.delete(
                    "/api/v1/servers/1",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 409
        data = response.json()
        assert "has_monitoring_data" in data.get("error", {}).get("code", "")

    @pytest.mark.asyncio
    async def test_hard_delete_without_monitoring_data_succeeds(
        self, client, admin_token
    ):
        """Hard delete without monitoring data should succeed."""
        with patch("app.routers.servers.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock has_monitoring_data to return False
            with patch(
                "app.services.server_service.ServerRepository.has_monitoring_data"
            ) as mock_has_data:
                mock_has_data.return_value = False

                # Mock delete_server to return True
                with patch(
                    "app.services.server_service.ServerRepository.delete_server"
                ) as mock_delete:
                    mock_delete.return_value = True

                    response = client.delete(
                        "/api/v1/servers/1",
                        headers={"Authorization": f"Bearer {admin_token}"},
                    )

        assert response.status_code == 204


# ---------------------------------------------------------------------------
# Test: Duplicate server_label
# ---------------------------------------------------------------------------


class TestDuplicateServerLabel:
    @pytest.mark.asyncio
    async def test_duplicate_server_label_returns_409(self, client, admin_token):
        """Req 1.6 — duplicate server_label returns HTTP 409."""
        with patch("app.routers.servers.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock create_server to raise a unique constraint violation
            with patch(
                "app.services.server_service.ServerRepository.create_server"
            ) as mock_create:
                from asyncpg import UniqueViolationError

                mock_create.side_effect = UniqueViolationError(
                    "Duplicate key value violates unique constraint"
                )

                response = client.post(
                    "/api/v1/servers",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={
                        "server_label": "prod-db-1",
                        "server_ip": "192.168.1.100",
                        "port": 5432,
                        "db_name": "postgres",
                        "username": "monitor",
                        "password": "secret",
                    },
                )

        assert response.status_code == 409
        data = response.json()
        assert "already_exists" in data.get("error", {}).get("code", "")
