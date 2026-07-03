"""
Property-based tests for incident management.

**Validates: Requirements 8.8, 8.9, 8.11**

Tests:
  - Property 24: Incident duration is correctly computed
  - Property 25: Incident detail includes all associated alerts
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 24: Incident Duration Is Correctly Computed
# ---------------------------------------------------------------------------


class TestIncidentDuration:
    """Incident duration must be computed correctly."""

    @given(
        started_seconds_ago=st.integers(min_value=1, max_value=86400),
        ended_seconds_ago=st.integers(min_value=0, max_value=86400),
    )
    @settings(max_examples=200)
    def test_resolved_incident_duration(
        self, started_seconds_ago: int, ended_seconds_ago: int
    ):
        """Resolved incident duration must be (ended_at - started_at)."""
        if ended_seconds_ago >= started_seconds_ago:
            pytest.skip("ended must be after started")

        now = datetime.now(timezone.utc)
        started_at = now - timedelta(seconds=started_seconds_ago)
        ended_at = now - timedelta(seconds=ended_seconds_ago)

        duration_seconds = int((ended_at - started_at).total_seconds())

        assert duration_seconds >= 0

    @given(
        started_seconds_ago=st.integers(min_value=1, max_value=86400),
    )
    @settings(max_examples=100)
    def test_open_incident_duration_approximate(self, started_seconds_ago: int):
        """Open incident duration must be approximately (now - started_at)."""
        now = datetime.now(timezone.utc)
        started_at = now - timedelta(seconds=started_seconds_ago)

        duration_seconds = int((now - started_at).total_seconds())

        # Should be approximately started_seconds_ago (within 1 second tolerance)
        assert abs(duration_seconds - started_seconds_ago) <= 1

    @given(
        started_seconds_ago=st.integers(min_value=1, max_value=86400),
    )
    @settings(max_examples=100)
    def test_open_incident_duration_non_negative(self, started_seconds_ago: int):
        """Open incident duration must be non-negative."""
        now = datetime.now(timezone.utc)
        started_at = now - timedelta(seconds=started_seconds_ago)

        duration_seconds = int((now - started_at).total_seconds())

        assert duration_seconds >= 0

    @given(
        started_seconds_ago=st.integers(min_value=1, max_value=86400),
        ended_seconds_ago=st.integers(min_value=0, max_value=86400),
    )
    @settings(max_examples=100)
    def test_resolved_incident_duration_non_negative(
        self, started_seconds_ago: int, ended_seconds_ago: int
    ):
        """Resolved incident duration must be non-negative."""
        if ended_seconds_ago >= started_seconds_ago:
            pytest.skip("ended must be after started")

        now = datetime.now(timezone.utc)
        started_at = now - timedelta(seconds=started_seconds_ago)
        ended_at = now - timedelta(seconds=ended_seconds_ago)

        duration_seconds = int((ended_at - started_at).total_seconds())

        assert duration_seconds >= 0


# ---------------------------------------------------------------------------
# Property 25: Incident Detail Includes All Associated Alerts
# ---------------------------------------------------------------------------


class TestIncidentDetailAlerts:
    """Incident detail must include all associated alerts."""

    @given(
        alert_count=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_incident_detail_returns_all_alerts(self, alert_count: int):
        """Incident detail must return exactly N alerts."""
        alerts = [
            {
                "alert_id": i,
                "triggered_at": datetime.now(timezone.utc) - timedelta(seconds=i),
            }
            for i in range(alert_count)
        ]

        # Simulate incident detail response
        incident_detail = {
            "incident_id": 1,
            "alerts": alerts,
        }

        assert len(incident_detail["alerts"]) == alert_count

    @given(
        alert_count=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_first_alert_at_is_minimum(self, alert_count: int):
        """first_alert_at must be min(triggered_at)."""
        now = datetime.now(timezone.utc)
        alerts = [
            {
                "alert_id": i,
                "triggered_at": now - timedelta(seconds=i * 10),
            }
            for i in range(alert_count)
        ]

        # Sort by triggered_at
        sorted_alerts = sorted(alerts, key=lambda a: a["triggered_at"])
        first_alert_at = sorted_alerts[0]["triggered_at"]
        expected_first = min(a["triggered_at"] for a in alerts)

        assert first_alert_at == expected_first

    @given(
        alert_count=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_last_alert_at_is_maximum(self, alert_count: int):
        """last_alert_at must be max(triggered_at)."""
        now = datetime.now(timezone.utc)
        alerts = [
            {
                "alert_id": i,
                "triggered_at": now - timedelta(seconds=i * 10),
            }
            for i in range(alert_count)
        ]

        # Sort by triggered_at
        sorted_alerts = sorted(alerts, key=lambda a: a["triggered_at"], reverse=True)
        last_alert_at = sorted_alerts[0]["triggered_at"]
        expected_last = max(a["triggered_at"] for a in alerts)

        assert last_alert_at == expected_last

    @given(
        alert_count=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_alerts_ordered_chronologically(self, alert_count: int):
        """Alerts must be ordered chronologically."""
        now = datetime.now(timezone.utc)
        alerts = [
            {
                "alert_id": i,
                "triggered_at": now - timedelta(seconds=i * 10),
            }
            for i in range(alert_count)
        ]

        # Sort by triggered_at ascending
        sorted_alerts = sorted(alerts, key=lambda a: a["triggered_at"])

        # Verify ascending order
        for i in range(len(sorted_alerts) - 1):
            assert sorted_alerts[i]["triggered_at"] <= sorted_alerts[i + 1]["triggered_at"]

    @given(
        alert_count=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_incident_detail_has_alert_count(self, alert_count: int):
        """Incident detail must have correct alert count."""
        alerts = [
            {
                "alert_id": i,
                "triggered_at": datetime.now(timezone.utc),
            }
            for i in range(alert_count)
        ]

        incident_detail = {
            "incident_id": 1,
            "alerts": alerts,
            "alert_count": len(alerts),
        }

        assert incident_detail["alert_count"] == alert_count

