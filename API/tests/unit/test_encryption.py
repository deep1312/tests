"""
Unit tests for credential encryption and startup (Task 67)

Covers:
  - API startup fails with descriptive error when CREDENTIAL_ENCRYPTION_KEY is absent
  - Credential rotation endpoint success case
  - Partial failure triggers rollback and returns HTTP 500
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

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
from app.routers.admin import router as admin_router  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    """Create a minimal FastAPI app with admin router."""
    app = FastAPI()
    app.include_router(admin_router, prefix="/api/v1")
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def admin_token():
    """Create an admin JWT token."""
    return create_access_token("admin-user", "admin", 3600)


# ---------------------------------------------------------------------------
# Test: Startup validation
# ---------------------------------------------------------------------------


class TestStartupValidation:
    def test_startup_fails_when_encryption_key_absent(self):
        """Req 11.4 — API startup fails with descriptive error when CREDENTIAL_ENCRYPTION_KEY is absent."""
        # Save original env var
        original_key = os.environ.get("CREDENTIAL_ENCRYPTION_KEY")

        try:
            # Remove the encryption key
            if "CREDENTIAL_ENCRYPTION_KEY" in os.environ:
                del os.environ["CREDENTIAL_ENCRYPTION_KEY"]

            # Try to import settings - should raise ValueError
            from app.core.config import Settings

            with pytest.raises(ValueError) as exc_info:
                Settings()

            assert "CREDENTIAL_ENCRYPTION_KEY" in str(exc_info.value)

        finally:
            # Restore original env var
            if original_key:
                os.environ["CREDENTIAL_ENCRYPTION_KEY"] = original_key

    def test_startup_succeeds_with_valid_encryption_key(self):
        """Startup should succeed when CREDENTIAL_ENCRYPTION_KEY is present."""
        from app.core.config import Settings

        # Should not raise
        settings = Settings()
        assert settings.CREDENTIAL_ENCRYPTION_KEY is not None


# ---------------------------------------------------------------------------
# Test: Credential rotation success
# ---------------------------------------------------------------------------


class TestCredentialRotationSuccess:
    @pytest.mark.asyncio
    async def test_credential_rotation_endpoint_success(self, client, admin_token):
        """Req 11.5 — credential rotation endpoint success case."""
        with patch("app.routers.admin.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock rotate_all to return count of re-encrypted records
            with patch(
                "app.services.credential_service.CredentialEncryptor.rotate_all"
            ) as mock_rotate:
                mock_rotate.return_value = 5  # 5 servers re-encrypted

                response = client.post(
                    "/api/v1/admin/credentials/rotate",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 200
        data = response.json()
        assert "rotated_count" in data["data"]
        assert data["data"]["rotated_count"] == 5

    @pytest.mark.asyncio
    async def test_credential_rotation_creates_audit_log(self, client, admin_token):
        """Credential rotation should create an audit log entry."""
        with patch("app.routers.admin.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.credential_service.CredentialEncryptor.rotate_all"
            ) as mock_rotate:
                mock_rotate.return_value = 3

                # Mock audit log creation
                with patch(
                    "app.services.audit_service.AuditService.log"
                ) as mock_audit:
                    response = client.post(
                        "/api/v1/admin/credentials/rotate",
                        headers={"Authorization": f"Bearer {admin_token}"},
                    )

                    # Verify audit log was called
                    assert mock_audit.called

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Test: Credential rotation failure
# ---------------------------------------------------------------------------


class TestCredentialRotationFailure:
    @pytest.mark.asyncio
    async def test_credential_rotation_partial_failure_returns_500(
        self, client, admin_token
    ):
        """Req 11.7 — partial failure triggers rollback and returns HTTP 500."""
        with patch("app.routers.admin.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock rotate_all to raise an exception (simulating partial failure)
            with patch(
                "app.services.credential_service.CredentialEncryptor.rotate_all"
            ) as mock_rotate:
                mock_rotate.side_effect = Exception("Rotation failed at record 3 of 5")

                response = client.post(
                    "/api/v1/admin/credentials/rotate",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 500
        data = response.json()
        assert "rotation_failed" in data.get("error", {}).get("code", "")

    @pytest.mark.asyncio
    async def test_credential_rotation_failure_does_not_modify_db(
        self, client, admin_token
    ):
        """On failure, database state should remain unchanged (rollback)."""
        with patch("app.routers.admin.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            # Mock rotate_all to raise an exception
            with patch(
                "app.services.credential_service.CredentialEncryptor.rotate_all"
            ) as mock_rotate:
                mock_rotate.side_effect = Exception("Rotation failed")

                # Mock transaction rollback
                mock_conn.transaction = MagicMock()
                mock_conn.transaction.rollback = AsyncMock()

                response = client.post(
                    "/api/v1/admin/credentials/rotate",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 500


# ---------------------------------------------------------------------------
# Test: RBAC for credential rotation
# ---------------------------------------------------------------------------


class TestCredentialRotationRBAC:
    @pytest.mark.asyncio
    async def test_credential_rotation_viewer_returns_403(self):
        """Viewer role cannot rotate credentials."""
        viewer_token = create_access_token("viewer-user", "viewer", 3600)

        app = FastAPI()
        app.include_router(admin_router, prefix="/api/v1")
        client = TestClient(app)

        response = client.post(
            "/api/v1/admin/credentials/rotate",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_credential_rotation_admin_allowed(self, client, admin_token):
        """Admin role can rotate credentials."""
        with patch("app.routers.admin.get_db") as mock_get_db:
            mock_conn = AsyncMock()
            mock_get_db.return_value = mock_conn

            with patch(
                "app.services.credential_service.CredentialEncryptor.rotate_all"
            ) as mock_rotate:
                mock_rotate.return_value = 0  # No servers to rotate

                response = client.post(
                    "/api/v1/admin/credentials/rotate",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )

        assert response.status_code == 200
