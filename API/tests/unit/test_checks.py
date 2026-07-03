"""
Unit tests for check management endpoints (Task 64)

Covers:
  - Duplicate check_code returns HTTP 409
  - Hard delete of check with monitoring data returns HTTP 409
  - Mapping update with consecutive_failures field is rejected
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
from app.routers.checks import router as checks_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    """Create a minimal FastAPI app with checks router."""
    app = FastAPI()
    app.include_router(checks_router, prefix="/api/v1")
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
# Test: Duplicate check_code
# ---------------------------------------------------------------------------


class TestDuplicateCheckCode:
    @pytest.mark.asyncio
    async def test_duplicate_check_code_returns_409(self, client, admin_token):
        """Req 2.3 — duplicate check_code returns HTTP 409."""
        with patch("app.routers.checks.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock create_check to raise a unique constraint violation
            with patch(
                "app.services.check_service.CheckRepository.create_check"
            ) as mock_create:
                from asyncpg import UniqueViolationError

                mock_create.side_effect = UniqueViolationError(
                    "Duplicate key value violates unique constraint"
                )

                response = client.post(
                    "/api/v1/checks",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={
                        "check_code": "cpu_usage",
                        "category": "system",
                        "check_name": "CPU Usage Check",
                        "query_text": "SELECT cpu_usage FROM metrics;",
                    },
                )

        assert response.status_code == 409
        data = response.json()
        assert "already_exists" in data.get("error", {}).get("code", "")


# ---------------------------------------------------------------------------
# Test: Hard delete of check with monitoring data
# ---------------------------------------------------------------------------


class TestHardDeleteCheckWithMonitoringData:
    @pytest.mark.asyncio
    async def test_hard_delete_check_with_monitoring_data_returns_409(
        self, client, admin_token
    ):
        """Req 2.13 — hard delete of check with monitoring data returns HTTP 409."""
        with patch("app.routers.checks.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock has_monitoring_data_for_check to return True
            with patch(
                "app.services.check_service.CheckRepository.has_monitoring_data_for_check"
            ) as mock_has_data:
                mock_has_data.return_value = True

                response = client.delete(
                    "/api/v1/checks/1",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 409
        data = response.json()
        assert "has_monitoring_data" in data.get("error", {}).get("code", "")

    @pytest.mark.asyncio
    async def test_hard_delete_check_without_monitoring_data_succeeds(
        self, client, admin_token
    ):
        """Hard delete of check without monitoring data should succeed."""
        with patch("app.routers.checks.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock has_monitoring_data_for_check to return False
            with patch(
                "app.services.check_service.CheckRepository.has_monitoring_data_for_check"
            ) as mock_has_data:
                mock_has_data.return_value = False

                # Mock delete_check to return True
                with patch(
                    "app.services.check_service.CheckRepository.delete_check"
                ) as mock_delete:
                    mock_delete.return_value = True

                    response = client.delete(
                        "/api/v1/checks/1",
                        headers={"Authorization": f"Bearer {admin_token}"},
                    )

        assert response.status_code == 204


# ---------------------------------------------------------------------------
# Test: Mapping update validation
# ---------------------------------------------------------------------------


class TestMappingUpdateValidation:
    @pytest.mark.asyncio
    async def test_mapping_update_with_consecutive_failures_rejected(
        self, client, admin_token
    ):
        """Req 2.6 — mapping update with consecutive_failures field is rejected."""
        with patch("app.routers.checks.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            response = client.put(
                "/api/v1/mappings/1",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "custom_frequency_sec": 60,
                    "is_enabled": True,
                    "consecutive_failures": 5,  # This should be rejected
                },
            )

        # Should return 422 validation error
        assert response.status_code == 422
        data = response.json()
        assert "validation_error" in data.get("error", {}).get("code", "")

    @pytest.mark.asyncio
    async def test_mapping_update_with_backoff_until_rejected(self, client, admin_token):
        """Mapping update with backoff_until field should be rejected."""
        with patch("app.routers.checks.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            response = client.put(
                "/api/v1/mappings/1",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "custom_frequency_sec": 60,
                    "is_enabled": True,
                    "backoff_until": "2026-01-01T00:00:00Z",  # This should be rejected
                },
            )

        # Should return 422 validation error
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_mapping_update_with_allowed_fields_succeeds(self, client, admin_token):
        """Mapping update with only allowed fields should succeed."""
        with patch("app.routers.checks.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock update_mapping to return updated mapping
            with patch(
                "app.services.check_service.CheckRepository.update_mapping"
            ) as mock_update:
                mock_update.return_value = {
                    "mapping_id": 1,
                    "server_id": 1,
                    "check_id": 1,
                    "custom_frequency_sec": 120,
                    "is_enabled": False,
                    "consecutive_failures": 0,
                    "backoff_until": None,
                    "created_at": "2026-01-01T00:00:00Z",
                    "updated_at": "2026-01-01T00:00:00Z",
                }

                response = client.put(
                    "/api/v1/mappings/1",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={
                        "custom_frequency_sec": 120,
                        "is_enabled": False,
                    },
                )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["custom_frequency_sec"] == 120
        assert data["data"]["is_enabled"] is False
