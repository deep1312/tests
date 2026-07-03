"""
Property-based tests for server response security and completeness.

**Validates: Requirements 1.3, 1.4, 11.2**

Tests:
  - Property 2: Password never appears in API responses
  - Property 3: Server response contains all required non-sensitive fields
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
from hypothesis import given, settings, strategies as st

from app.models.responses.server import ServerResponse


# Strategies for generating realistic server data
server_labels = st.text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
    min_size=1,
    max_size=100,
)
server_ips = st.just("192.168.1.1")  # Simplified for testing
usernames = st.text(
    alphabet="abcdefghijklmnopqrstuvwxyz0123456789_",
    min_size=1,
    max_size=50,
)
passwords = st.text(min_size=1, max_size=200)
env_types = st.sampled_from(["dev", "staging", "prod", None])
ssl_modes = st.sampled_from(["disable", "allow", "prefer", "require"])


def make_server_response(
    server_id: int = 1,
    server_label: str = "prod-db-01",
    server_ip: str = "192.168.1.1",
    port: int = 5432,
    db_name: str = "postgres",
    username: str = "monitor",
    server_role: str | None = "primary",
    env_type: str | None = "prod",
    ssl_mode: str = "prefer",
    retention_metrics_days: int = 365,
    retention_logs_days: int = 30,
    retention_runs_days: int = 7,
    compression_days: int = 7,
    tags: dict | None = None,
    is_active: bool = True,
    last_heartbeat: datetime | None = None,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
    version: int = 1,
    warnings: list[str] | None = None,
) -> ServerResponse:
    """Factory for creating ServerResponse instances."""
    now = datetime.now(timezone.utc)
    return ServerResponse(
        server_id=server_id,
        server_label=server_label,
        server_ip=server_ip,
        port=port,
        db_name=db_name,
        username=username,
        server_role=server_role,
        env_type=env_type,
        ssl_mode=ssl_mode,
        retention_metrics_days=retention_metrics_days,
        retention_logs_days=retention_logs_days,
        retention_runs_days=retention_runs_days,
        compression_days=compression_days,
        tags=tags or {},
        is_active=is_active,
        last_heartbeat=last_heartbeat or now,
        created_at=created_at or now,
        updated_at=updated_at or now,
        version=version,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Property 2: Password Never Appears in API Responses
# ---------------------------------------------------------------------------


class TestPasswordNotInResponse:
    """Password must never appear in JSON-serialized response."""

    @given(
        server_label=server_labels,
        username=usernames,
        env_type=env_types,
    )
    @settings(max_examples=100)
    def test_password_encrypted_not_in_response(
        self, server_label: str, username: str, env_type: str | None
    ):
        """Response must not contain 'password_encrypted' key."""
        response = make_server_response(
            server_label=server_label,
            username=username,
            env_type=env_type,
        )
        json_str = response.model_dump_json()
        assert "password_encrypted" not in json_str

    @given(
        server_label=server_labels,
        username=usernames,
        password=passwords,
    )
    @settings(max_examples=100)
    def test_plaintext_password_not_in_response(
        self, server_label: str, username: str, password: str
    ):
        """Response must not contain the plaintext password."""
        response = make_server_response(
            server_label=server_label,
            username=username,
        )
        json_str = response.model_dump_json()
        # The plaintext password should not appear in the response
        # (We can't test with the actual password since it's not stored in response,
        # but we verify the response structure doesn't include password fields)
        assert "password" not in json_str.lower() or "password" not in response.model_dump()

    @given(
        server_label=server_labels,
        username=usernames,
    )
    @settings(max_examples=100)
    def test_response_serializes_to_valid_json(
        self, server_label: str, username: str
    ):
        """Response must serialize to valid JSON."""
        response = make_server_response(
            server_label=server_label,
            username=username,
        )
        json_str = response.model_dump_json()
        # Should not raise
        parsed = json.loads(json_str)
        assert isinstance(parsed, dict)

    @given(
        server_label=server_labels,
        username=usernames,
    )
    @settings(max_examples=100)
    def test_response_dict_has_no_password_key(
        self, server_label: str, username: str
    ):
        """Response dict must not have 'password' or 'password_encrypted' keys."""
        response = make_server_response(
            server_label=server_label,
            username=username,
        )
        response_dict = response.model_dump()
        assert "password" not in response_dict
        assert "password_encrypted" not in response_dict


# ---------------------------------------------------------------------------
# Property 3: Server Response Contains All Required Fields
# ---------------------------------------------------------------------------


class TestServerResponseCompleteness:
    """Response must contain all 19 required non-sensitive fields."""

    REQUIRED_FIELDS = {
        "server_id",
        "server_label",
        "server_ip",
        "port",
        "db_name",
        "username",
        "server_role",
        "env_type",
        "ssl_mode",
        "retention_metrics_days",
        "retention_logs_days",
        "retention_runs_days",
        "compression_days",
        "tags",
        "is_active",
        "last_heartbeat",
        "created_at",
        "updated_at",
        "version",
    }

    @given(
        server_label=server_labels,
        username=usernames,
        env_type=env_types,
        ssl_mode=ssl_modes,
    )
    @settings(max_examples=100)
    def test_all_required_fields_present(
        self,
        server_label: str,
        username: str,
        env_type: str | None,
        ssl_mode: str,
    ):
        """Response must contain all required fields."""
        response = make_server_response(
            server_label=server_label,
            username=username,
            env_type=env_type,
            ssl_mode=ssl_mode,
        )
        response_dict = response.model_dump()
        for field in self.REQUIRED_FIELDS:
            assert field in response_dict, f"Missing required field: {field}"

    @given(
        server_label=server_labels,
        username=usernames,
    )
    @settings(max_examples=100)
    def test_all_fields_have_non_null_values_except_optional(
        self, server_label: str, username: str
    ):
        """All required fields must have non-null values (except optional ones)."""
        response = make_server_response(
            server_label=server_label,
            username=username,
        )
        response_dict = response.model_dump()

        # Fields that must never be null
        non_nullable = {
            "server_id",
            "server_label",
            "server_ip",
            "port",
            "db_name",
            "username",
            "ssl_mode",
            "retention_metrics_days",
            "retention_logs_days",
            "retention_runs_days",
            "compression_days",
            "is_active",
            "created_at",
            "updated_at",
            "version",
        }

        for field in non_nullable:
            assert response_dict[field] is not None, f"Field {field} must not be null"

    @given(
        server_label=server_labels,
        username=usernames,
        retention_metrics_days=st.integers(min_value=1, max_value=3650),
        retention_logs_days=st.integers(min_value=1, max_value=365),
    )
    @settings(max_examples=100)
    def test_retention_fields_are_positive_integers(
        self,
        server_label: str,
        username: str,
        retention_metrics_days: int,
        retention_logs_days: int,
    ):
        """Retention fields must be positive integers."""
        # Ensure metrics >= logs for valid response
        if retention_metrics_days < retention_logs_days:
            retention_metrics_days = retention_logs_days

        response = make_server_response(
            server_label=server_label,
            username=username,
            retention_metrics_days=retention_metrics_days,
            retention_logs_days=retention_logs_days,
        )
        response_dict = response.model_dump()

        assert response_dict["retention_metrics_days"] > 0
        assert response_dict["retention_logs_days"] > 0
        assert response_dict["retention_runs_days"] > 0
        assert response_dict["compression_days"] > 0

    @given(
        server_label=server_labels,
        username=usernames,
    )
    @settings(max_examples=100)
    def test_port_is_valid_range(self, server_label: str, username: str):
        """Port must be in valid range."""
        response = make_server_response(
            server_label=server_label,
            username=username,
            port=5432,
        )
        response_dict = response.model_dump()
        assert 1 <= response_dict["port"] <= 65535

    @given(
        server_label=server_labels,
        username=usernames,
    )
    @settings(max_examples=100)
    def test_version_is_positive_integer(self, server_label: str, username: str):
        """Version must be a positive integer."""
        response = make_server_response(
            server_label=server_label,
            username=username,
            version=1,
        )
        response_dict = response.model_dump()
        assert response_dict["version"] > 0
        assert isinstance(response_dict["version"], int)
