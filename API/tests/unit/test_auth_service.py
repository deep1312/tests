"""
Unit tests for api/app/services/auth_service.py and api/app/repositories/user_repo.py

Covers:
  - AuthService.login: valid credentials return TokenResponse
  - AuthService.login: invalid username raises HTTP 401
  - AuthService.login: wrong password raises HTTP 401
  - AuthService.login: error message is generic (does not reveal which field was wrong)
  - AuthService.refresh: valid token returns new TokenResponse
  - AuthService.refresh: expired token raises HTTP 401
  - AuthService.refresh: invalid token raises HTTP 401
  - AuthService.verify_token: valid token returns UserContext
  - AuthService.verify_token: invalid token raises HTTP 401
  - TokenResponse and UserContext model fields
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock

import anyio
import pytest
from unittest.mock import MagicMock

# Set required env vars before importing settings-dependent modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
)
os.environ.setdefault("JWT_SECRET", "unit-test-secret-for-auth")
os.environ.setdefault("JWT_EXPIRY_SECONDS", "3600")

from fastapi import HTTPException  # noqa: E402

from app.core.security import create_access_token, decode_token, hash_password  # noqa: E402
from app.models.responses.auth import TokenResponse, UserContext  # noqa: E402
from app.services.auth_service import AuthService  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(username: str = "alice", role: str = "admin") -> dict:
    """Return a fake user dict as would be returned by get_user_by_username."""
    return {
        "user_id": "00000000-0000-0000-0000-000000000001",
        "username": username,
        "password_hash": hash_password("correct-password"),
        "role": role,
        "is_active": True,
        "created_at": None,
        "updated_at": None,
    }


def _make_service_with_user(user: dict | None) -> AuthService:
    """Return an AuthService backed by a mock connection that returns *user*."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=user)
    return AuthService(conn)


def _run(coro):
    """Run a coroutine synchronously using anyio."""
    return anyio.from_thread.run_sync(lambda: None) if False else anyio.run(lambda: coro)


# ---------------------------------------------------------------------------
# TokenResponse model
# ---------------------------------------------------------------------------


class TestTokenResponse:
    def test_fields_present(self):
        tr = TokenResponse(token="abc.def.ghi", expires_in=3600)
        assert tr.token == "abc.def.ghi"
        assert tr.expires_in == 3600

    def test_model_dump(self):
        tr = TokenResponse(token="t", expires_in=60)
        d = tr.model_dump()
        assert set(d.keys()) == {"token", "expires_in"}


# ---------------------------------------------------------------------------
# UserContext model
# ---------------------------------------------------------------------------


class TestUserContext:
    def test_fields_present(self):
        uc = UserContext(user_id="uid-1", role="viewer")
        assert uc.user_id == "uid-1"
        assert uc.role == "viewer"

    def test_admin_role(self):
        uc = UserContext(user_id="uid-2", role="admin")
        assert uc.role == "admin"


# ---------------------------------------------------------------------------
# AuthService.login
# ---------------------------------------------------------------------------


class TestAuthServiceLogin:
    def test_valid_credentials_return_token_response(self):
        user = _make_user("alice", "admin")
        service = _make_service_with_user(user)

        async def _run():
            return await service.login("alice", "correct-password")

        result = anyio.run(_run)
        assert isinstance(result, TokenResponse)
        assert result.token
        assert result.expires_in > 0

    def test_unknown_username_raises_401(self):
        service = _make_service_with_user(None)

        async def _run():
            return await service.login("unknown", "any-password")

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.status_code == 401

    def test_wrong_password_raises_401(self):
        user = _make_user("alice", "admin")
        service = _make_service_with_user(user)

        async def _run():
            return await service.login("alice", "wrong-password")

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.status_code == 401

    def test_error_message_is_generic_for_unknown_user(self):
        """Req 10.7 — message must not reveal whether username or password was wrong."""
        service = _make_service_with_user(None)

        async def _run():
            return await service.login("unknown", "any")

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.detail == "Invalid credentials."

    def test_error_message_is_generic_for_wrong_password(self):
        """Req 10.7 — same generic message for wrong password."""
        user = _make_user("alice", "admin")
        service = _make_service_with_user(user)

        async def _run():
            return await service.login("alice", "wrong")

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.detail == "Invalid credentials."

    def test_viewer_role_preserved_in_token(self):
        user = _make_user("bob", "viewer")
        service = _make_service_with_user(user)

        async def _run():
            return await service.login("bob", "correct-password")

        result = anyio.run(_run)
        claims = decode_token(result.token)
        assert claims["role"] == "viewer"

    def test_admin_role_preserved_in_token(self):
        user = _make_user("alice", "admin")
        service = _make_service_with_user(user)

        async def _run():
            return await service.login("alice", "correct-password")

        result = anyio.run(_run)
        claims = decode_token(result.token)
        assert claims["role"] == "admin"


# ---------------------------------------------------------------------------
# AuthService.refresh
# ---------------------------------------------------------------------------


class TestAuthServiceRefresh:
    def test_valid_token_returns_new_token_response(self):
        conn = AsyncMock()
        service = AuthService(conn)
        original = create_access_token("user-1", "admin", 3600)

        async def _run():
            return await service.refresh(original)

        result = anyio.run(_run)
        assert isinstance(result, TokenResponse)
        assert result.token  # a non-empty token was issued
        assert result.expires_in > 0
        # Verify the new token is valid and has the correct claims
        claims = decode_token(result.token)
        assert claims["sub"] == "user-1"
        assert claims["role"] == "admin"

    def test_expired_token_raises_401(self):
        conn = AsyncMock()
        service = AuthService(conn)
        expired = create_access_token("user-1", "admin", -1)

        async def _run():
            return await service.refresh(expired)

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.status_code == 401

    def test_invalid_token_raises_401(self):
        conn = AsyncMock()
        service = AuthService(conn)

        async def _run():
            return await service.refresh("not.a.valid.token")

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.status_code == 401

    def test_refreshed_token_has_same_role(self):
        conn = AsyncMock()
        service = AuthService(conn)
        original = create_access_token("user-2", "viewer", 3600)

        async def _run():
            return await service.refresh(original)

        result = anyio.run(_run)
        claims = decode_token(result.token)
        assert claims["role"] == "viewer"
        assert claims["sub"] == "user-2"


# ---------------------------------------------------------------------------
# AuthService.verify_token
# ---------------------------------------------------------------------------


class TestAuthServiceVerifyToken:
    def test_valid_token_returns_user_context(self):
        conn = AsyncMock()
        service = AuthService(conn)
        token = create_access_token("user-3", "admin", 3600)
        ctx = service.verify_token(token)
        assert isinstance(ctx, UserContext)
        assert ctx.user_id == "user-3"
        assert ctx.role == "admin"

    def test_expired_token_raises_401(self):
        conn = AsyncMock()
        service = AuthService(conn)
        expired = create_access_token("user-4", "admin", -1)
        with pytest.raises(HTTPException) as exc_info:
            service.verify_token(expired)
        assert exc_info.value.status_code == 401

    def test_invalid_token_raises_401(self):
        conn = AsyncMock()
        service = AuthService(conn)
        with pytest.raises(HTTPException) as exc_info:
            service.verify_token("garbage.token.here")
        assert exc_info.value.status_code == 401

    def test_viewer_role_in_context(self):
        conn = AsyncMock()
        service = AuthService(conn)
        token = create_access_token("user-5", "viewer", 3600)
        ctx = service.verify_token(token)
        assert ctx.role == "viewer"


# ---------------------------------------------------------------------------
# RBAC: require_role dependency
# ---------------------------------------------------------------------------


class TestRequireRole:
    """Tests for the require_role dependency in dependencies.py."""

    def test_admin_passes_admin_requirement(self):
        from app.core.dependencies import require_role

        request = MagicMock()
        request.state.user_context = UserContext(user_id="u1", role="admin")
        dep = require_role("admin")

        async def _run():
            return await dep(request)

        # Should not raise
        anyio.run(_run)

    def test_viewer_passes_viewer_requirement(self):
        from app.core.dependencies import require_role

        request = MagicMock()
        request.state.user_context = UserContext(user_id="u2", role="viewer")
        dep = require_role("viewer")

        async def _run():
            return await dep(request)

        anyio.run(_run)

    def test_viewer_fails_admin_requirement(self):
        """Req 10.3 — viewer on write endpoint returns HTTP 403."""
        from app.core.dependencies import require_role

        request = MagicMock()
        request.state.user_context = UserContext(user_id="u3", role="viewer")
        dep = require_role("admin")

        async def _run():
            return await dep(request)

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.status_code == 403

    def test_missing_user_context_raises_401(self):
        from app.core.dependencies import require_role

        request = MagicMock()
        # Simulate missing user_context (auth middleware didn't run)
        del request.state.user_context
        request.state = MagicMock(spec=[])  # no user_context attribute
        dep = require_role("viewer")

        async def _run():
            return await dep(request)

        with pytest.raises(HTTPException) as exc_info:
            anyio.run(_run)
        assert exc_info.value.status_code == 401
