"""
Property-based tests for timestamp formatting.

**Validates: Requirements 1.14, 4.7, 6.11, 7.11, 8.13**

Tests:
  - Property 6: All API timestamps are ISO 8601 UTC
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone

import pytest
from hypothesis import given, settings, strategies as st

from app.models.responses.server import ServerResponse  # noqa: E402
from app.models.responses.monitoring import CheckRunResponse  # noqa: E402
from app.models.responses.alert import AlertResponse  # noqa: E402
from app.models.responses.incident import IncidentResponse  # noqa: E402


# ISO 8601 UTC regex pattern
ISO_8601_UTC_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$"
)


def is_iso_8601_utc(timestamp_str: str) -> bool:
    """Check if a string is ISO 8601 UTC format."""
    if not isinstance(timestamp_str, str):
        return False
    return ISO_8601_UTC_PATTERN.match(timestamp_str) is not None


# ---------------------------------------------------------------------------
# Property 6: All API Timestamps Are ISO 8601 UTC
# ---------------------------------------------------------------------------


class TestTimestampFormatting:
    """All timestamps must be ISO 8601 UTC strings."""

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_server_created_at_is_iso_8601_utc(self, dt: datetime):
        """Server created_at must be ISO 8601 UTC."""
        response = ServerResponse(
            server_id=1,
            server_label="test",
            server_ip="192.168.1.1",
            port=5432,
            db_name="postgres",
            username="monitor",
            server_role=None,
            env_type=None,
            ssl_mode="prefer",
            retention_metrics_days=365,
            retention_logs_days=30,
            retention_runs_days=7,
            compression_days=7,
            tags={},
            is_active=True,
            last_heartbeat=dt,
            created_at=dt,
            updated_at=dt,
            version=1,
        )

        # Serialize to JSON and check format
        json_dict = response.model_dump()
        created_at_str = json_dict["created_at"]

        assert isinstance(created_at_str, str)
        assert is_iso_8601_utc(created_at_str), f"Invalid ISO 8601 UTC: {created_at_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_server_updated_at_is_iso_8601_utc(self, dt: datetime):
        """Server updated_at must be ISO 8601 UTC."""
        response = ServerResponse(
            server_id=1,
            server_label="test",
            server_ip="192.168.1.1",
            port=5432,
            db_name="postgres",
            username="monitor",
            server_role=None,
            env_type=None,
            ssl_mode="prefer",
            retention_metrics_days=365,
            retention_logs_days=30,
            retention_runs_days=7,
            compression_days=7,
            tags={},
            is_active=True,
            last_heartbeat=dt,
            created_at=dt,
            updated_at=dt,
            version=1,
        )

        json_dict = response.model_dump()
        updated_at_str = json_dict["updated_at"]

        assert isinstance(updated_at_str, str)
        assert is_iso_8601_utc(updated_at_str), f"Invalid ISO 8601 UTC: {updated_at_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_server_last_heartbeat_is_iso_8601_utc(self, dt: datetime):
        """Server last_heartbeat must be ISO 8601 UTC."""
        response = ServerResponse(
            server_id=1,
            server_label="test",
            server_ip="192.168.1.1",
            port=5432,
            db_name="postgres",
            username="monitor",
            server_role=None,
            env_type=None,
            ssl_mode="prefer",
            retention_metrics_days=365,
            retention_logs_days=30,
            retention_runs_days=7,
            compression_days=7,
            tags={},
            is_active=True,
            last_heartbeat=dt,
            created_at=dt,
            updated_at=dt,
            version=1,
        )

        json_dict = response.model_dump()
        last_heartbeat_str = json_dict["last_heartbeat"]

        assert isinstance(last_heartbeat_str, str)
        assert is_iso_8601_utc(last_heartbeat_str), f"Invalid ISO 8601 UTC: {last_heartbeat_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_check_run_started_at_is_iso_8601_utc(self, dt: datetime):
        """CheckRun started_at must be ISO 8601 UTC."""
        response = CheckRunResponse(
            run_id=1,
            started_at=dt,
            scheduled_at=dt,
            ended_at=dt,
            server_id=1,
            check_id=1,
            status="SUCCESS",
            execution_time_ms=100,
            error_message=None,
        )

        json_dict = response.model_dump()
        started_at_str = json_dict["started_at"]

        assert isinstance(started_at_str, str)
        assert is_iso_8601_utc(started_at_str), f"Invalid ISO 8601 UTC: {started_at_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_alert_triggered_at_is_iso_8601_utc(self, dt: datetime):
        """Alert triggered_at must be ISO 8601 UTC."""
        response = AlertResponse(
            alert_id=1,
            triggered_at=dt,
            incident_id=1,
            server_id=1,
            check_id=1,
            metric_name="cpu_usage",
            observed_value=95.5,
            status="CRITICAL",
            acknowledged_at=None,
        )

        json_dict = response.model_dump()
        triggered_at_str = json_dict["triggered_at"]

        assert isinstance(triggered_at_str, str)
        assert is_iso_8601_utc(triggered_at_str), f"Invalid ISO 8601 UTC: {triggered_at_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_incident_started_at_is_iso_8601_utc(self, dt: datetime):
        """Incident started_at must be ISO 8601 UTC."""
        response = IncidentResponse(
            incident_id=1,
            server_id=1,
            check_id=1,
            status="OPEN",
            started_at=dt,
            ended_at=None,
            root_cause=None,
        )

        json_dict = response.model_dump()
        started_at_str = json_dict["started_at"]

        assert isinstance(started_at_str, str)
        assert is_iso_8601_utc(started_at_str), f"Invalid ISO 8601 UTC: {started_at_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_incident_ended_at_is_iso_8601_utc_when_present(self, dt: datetime):
        """Incident ended_at must be ISO 8601 UTC when present."""
        response = IncidentResponse(
            incident_id=1,
            server_id=1,
            check_id=1,
            status="RESOLVED",
            started_at=dt,
            ended_at=dt,
            root_cause=None,
        )

        json_dict = response.model_dump()
        ended_at_str = json_dict["ended_at"]

        assert isinstance(ended_at_str, str)
        assert is_iso_8601_utc(ended_at_str), f"Invalid ISO 8601 UTC: {ended_at_str}"

    @given(
        dt=st.datetimes(
            min_value=datetime(2020, 1, 1, tzinfo=timezone.utc),
            max_value=datetime(2030, 12, 31, tzinfo=timezone.utc),
            timezones=st.just(timezone.utc),
        )
    )
    @settings(max_examples=100)
    def test_timestamp_ends_with_z_or_offset(self, dt: datetime):
        """Timestamp must end with Z or UTC offset."""
        response = ServerResponse(
            server_id=1,
            server_label="test",
            server_ip="192.168.1.1",
            port=5432,
            db_name="postgres",
            username="monitor",
            server_role=None,
            env_type=None,
            ssl_mode="prefer",
            retention_metrics_days=365,
            retention_logs_days=30,
            retention_runs_days=7,
            compression_days=7,
            tags={},
            is_active=True,
            last_heartbeat=dt,
            created_at=dt,
            updated_at=dt,
            version=1,
        )

        json_dict = response.model_dump()
        created_at_str = json_dict["created_at"]

        # Must end with Z or +00:00 or -00:00
        assert created_at_str.endswith("Z") or "+00:00" in created_at_str or "-00:00" in created_at_str

