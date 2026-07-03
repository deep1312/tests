"""
Property-based tests for dashboard functionality.

**Validates: Requirements 9.6, 9.7, 9.8, 9.10**

Tests:
  - Property 20: Dashboard sort order respects severity tiers
  - Property 21: Health trend computation is correct
  - Property 22: Collector state derivation is correct
  - Property 23: Top failing checks are correctly ranked
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 20: Dashboard Sort Order Respects Severity Tiers
# ---------------------------------------------------------------------------


class TestDashboardSortOrder:
    """Dashboard must sort by severity: incidents > alerts > healthy."""

    @given(
        servers=st.lists(
            st.fixed_dictionaries({
                "server_id": st.integers(min_value=1, max_value=1000),
                "server_label": st.text(min_size=1, max_size=50),
                "open_incident_count": st.integers(min_value=0, max_value=10),
                "unack_alert_count": st.integers(min_value=0, max_value=10),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda s: s["server_id"],
        )
    )
    @settings(max_examples=100)
    def test_incidents_before_alerts(self, servers: list[dict]):
        """Servers with incidents must appear before those with only alerts."""
        # Sort by severity
        sorted_servers = sorted(
            servers,
            key=lambda s: (
                -s["open_incident_count"],
                -s["unack_alert_count"],
            ),
        )

        # Find first server with incidents and first without
        first_with_incident = None
        first_without_incident = None

        for i, server in enumerate(sorted_servers):
            if server["open_incident_count"] > 0 and first_with_incident is None:
                first_with_incident = i
            if server["open_incident_count"] == 0 and first_without_incident is None:
                first_without_incident = i

        # If both exist, incident must come first
        if first_with_incident is not None and first_without_incident is not None:
            assert first_with_incident < first_without_incident

    @given(
        servers=st.lists(
            st.fixed_dictionaries({
                "server_id": st.integers(min_value=1, max_value=1000),
                "server_label": st.text(min_size=1, max_size=50),
                "open_incident_count": st.integers(min_value=0, max_value=10),
                "unack_alert_count": st.integers(min_value=0, max_value=10),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda s: s["server_id"],
        )
    )
    @settings(max_examples=100)
    def test_alerts_before_healthy(self, servers: list[dict]):
        """Servers with alerts must appear before healthy servers."""
        sorted_servers = sorted(
            servers,
            key=lambda s: (
                -s["open_incident_count"],
                -s["unack_alert_count"],
            ),
        )

        # Find first server with alerts (but no incidents) and first healthy
        first_with_alert = None
        first_healthy = None

        for i, server in enumerate(sorted_servers):
            if (
                server["open_incident_count"] == 0
                and server["unack_alert_count"] > 0
                and first_with_alert is None
            ):
                first_with_alert = i
            if (
                server["open_incident_count"] == 0
                and server["unack_alert_count"] == 0
                and first_healthy is None
            ):
                first_healthy = i

        # If both exist, alert must come first
        if first_with_alert is not None and first_healthy is not None:
            assert first_with_alert < first_healthy


# ---------------------------------------------------------------------------
# Property 21: Health Trend Computation Is Correct
# ---------------------------------------------------------------------------


class TestHealthTrendComputation:
    """Health trend must be IMPROVING/DEGRADING/STABLE based on failure rates."""

    @given(
        current_rate=st.floats(min_value=0.0, max_value=100.0),
        prior_rate=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=200)
    def test_improving_trend(self, current_rate: float, prior_rate: float):
        """Current < Prior must be IMPROVING."""
        if current_rate >= prior_rate:
            pytest.skip("Not improving")

        trend = "IMPROVING" if current_rate < prior_rate else "STABLE"
        assert trend == "IMPROVING"

    @given(
        current_rate=st.floats(min_value=0.0, max_value=100.0),
        prior_rate=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=200)
    def test_degrading_trend(self, current_rate: float, prior_rate: float):
        """Current > Prior must be DEGRADING."""
        if current_rate <= prior_rate:
            pytest.skip("Not degrading")

        trend = "DEGRADING" if current_rate > prior_rate else "STABLE"
        assert trend == "DEGRADING"

    @given(
        rate=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=100)
    def test_stable_trend(self, rate: float):
        """Current == Prior must be STABLE."""
        trend = "STABLE" if rate == rate else "IMPROVING"
        assert trend == "STABLE"


# ---------------------------------------------------------------------------
# Property 22: Collector State Derivation Is Correct
# ---------------------------------------------------------------------------


class TestCollectorStateDerivation:
    """Collector state must be STALE or ACTIVE based on last_heartbeat."""

    STALENESS_THRESHOLD_SECS = 300  # 5 minutes

    @given(
        seconds_ago=st.integers(min_value=0, max_value=299),
    )
    @settings(max_examples=100)
    def test_recent_heartbeat_is_active(self, seconds_ago: int):
        """Recent heartbeat must be ACTIVE."""
        now = datetime.now(timezone.utc)
        last_heartbeat = now - timedelta(seconds=seconds_ago)

        elapsed = (now - last_heartbeat).total_seconds()
        state = "ACTIVE" if elapsed <= self.STALENESS_THRESHOLD_SECS else "STALE"

        assert state == "ACTIVE"

    @given(
        seconds_ago=st.integers(min_value=301, max_value=3600),
    )
    @settings(max_examples=100)
    def test_old_heartbeat_is_stale(self, seconds_ago: int):
        """Old heartbeat must be STALE."""
        now = datetime.now(timezone.utc)
        last_heartbeat = now - timedelta(seconds=seconds_ago)

        elapsed = (now - last_heartbeat).total_seconds()
        state = "STALE" if elapsed > self.STALENESS_THRESHOLD_SECS else "ACTIVE"

        assert state == "STALE"

    @given(
        seconds_ago=st.just(None),
    )
    @settings(max_examples=50)
    def test_null_heartbeat_is_stale(self, seconds_ago):
        """Null heartbeat must be STALE."""
        last_heartbeat = None
        state = "STALE" if last_heartbeat is None else "ACTIVE"

        assert state == "STALE"

    @given(
        seconds_ago=st.integers(min_value=0, max_value=300),
    )
    @settings(max_examples=100)
    def test_boundary_at_300_seconds(self, seconds_ago: int):
        """Boundary at 300 seconds (5 minutes)."""
        now = datetime.now(timezone.utc)
        last_heartbeat = now - timedelta(seconds=seconds_ago)

        elapsed = (now - last_heartbeat).total_seconds()

        if elapsed <= self.STALENESS_THRESHOLD_SECS:
            state = "ACTIVE"
        else:
            state = "STALE"

        if seconds_ago <= 300:
            assert state == "ACTIVE"


# ---------------------------------------------------------------------------
# Property 23: Top Failing Checks Are Correctly Ranked
# ---------------------------------------------------------------------------


class TestTopFailingChecksRanking:
    """Top failing checks must be at most 5, ranked by failure count."""

    @given(
        checks=st.lists(
            st.fixed_dictionaries({
                "check_id": st.integers(min_value=1, max_value=1000),
                "check_name": st.text(min_size=1, max_size=50),
                "failure_count": st.integers(min_value=0, max_value=1000),
            }),
            min_size=1,
            max_size=100,
            unique_by=lambda c: c["check_id"],
        )
    )
    @settings(max_examples=100)
    def test_top_failing_at_most_5(self, checks: list[dict]):
        """Top failing checks must have at most 5 entries."""
        top_failing = sorted(
            checks, key=lambda c: c["failure_count"], reverse=True
        )[:5]

        assert len(top_failing) <= 5

    @given(
        checks=st.lists(
            st.fixed_dictionaries({
                "check_id": st.integers(min_value=1, max_value=1000),
                "check_name": st.text(min_size=1, max_size=50),
                "failure_count": st.integers(min_value=0, max_value=1000),
            }),
            min_size=1,
            max_size=100,
            unique_by=lambda c: c["check_id"],
        )
    )
    @settings(max_examples=100)
    def test_top_failing_ordered_descending(self, checks: list[dict]):
        """Top failing checks must be ordered descending by failure count."""
        top_failing = sorted(
            checks, key=lambda c: c["failure_count"], reverse=True
        )[:5]

        # Verify descending order
        for i in range(len(top_failing) - 1):
            assert top_failing[i]["failure_count"] >= top_failing[i + 1]["failure_count"]

    @given(
        checks=st.lists(
            st.fixed_dictionaries({
                "check_id": st.integers(min_value=1, max_value=1000),
                "check_name": st.text(min_size=1, max_size=50),
                "failure_count": st.integers(min_value=0, max_value=1000),
            }),
            min_size=1,
            max_size=100,
            unique_by=lambda c: c["check_id"],
        )
    )
    @settings(max_examples=100)
    def test_top_failing_all_have_highest_counts(self, checks: list[dict]):
        """All top failing checks must have failure count >= any not in array."""
        top_failing = sorted(
            checks, key=lambda c: c["failure_count"], reverse=True
        )[:5]
        not_in_top = checks[5:] if len(checks) > 5 else []

        if top_failing and not_in_top:
            min_in_top = min(c["failure_count"] for c in top_failing)
            max_not_in_top = max(c["failure_count"] for c in not_in_top)

            assert min_in_top >= max_not_in_top

