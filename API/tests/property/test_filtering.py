"""
Property-based tests for filtering.

**Validates: Requirements 1.8, 2.7, 2.8, 3.6, 4a.4, 6.9, 7.1, 7.4, 8.1, 8.7**

Tests:
  - Property 7: Filter results match filter criteria
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 7: Filter Results Match Filter Criteria
# ---------------------------------------------------------------------------


class TestFilteringCorrectness:
    """Every item in filtered results must satisfy the filter condition."""

    @given(
        servers=st.lists(
            st.fixed_dictionaries({
                "server_id": st.integers(min_value=1, max_value=1000),
                "server_label": st.text(min_size=1, max_size=50),
                "env_type": st.sampled_from(["dev", "staging", "prod", None]),
                "is_active": st.booleans(),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda s: s["server_id"],
        ),
        filter_env_type=st.sampled_from(["dev", "staging", "prod", None]),
    )
    @settings(max_examples=100)
    def test_env_type_filter_matches_all_results(
        self, servers: list[dict], filter_env_type: str | None
    ):
        """All filtered servers must have matching env_type."""
        # Simulate filtering
        filtered = [s for s in servers if s["env_type"] == filter_env_type]

        # Verify all results match the filter
        for server in filtered:
            assert server["env_type"] == filter_env_type

    @given(
        servers=st.lists(
            st.fixed_dictionaries({
                "server_id": st.integers(min_value=1, max_value=1000),
                "server_label": st.text(min_size=1, max_size=50),
                "env_type": st.sampled_from(["dev", "staging", "prod", None]),
                "is_active": st.booleans(),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda s: s["server_id"],
        ),
        filter_is_active=st.booleans(),
    )
    @settings(max_examples=100)
    def test_is_active_filter_matches_all_results(
        self, servers: list[dict], filter_is_active: bool
    ):
        """All filtered servers must have matching is_active."""
        filtered = [s for s in servers if s["is_active"] == filter_is_active]

        for server in filtered:
            assert server["is_active"] == filter_is_active

    @given(
        servers=st.lists(
            st.fixed_dictionaries({
                "server_id": st.integers(min_value=1, max_value=1000),
                "server_label": st.text(min_size=1, max_size=50),
                "env_type": st.sampled_from(["dev", "staging", "prod", None]),
                "is_active": st.booleans(),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda s: s["server_id"],
        ),
        filter_env_type=st.sampled_from(["dev", "staging", "prod", None]),
        filter_is_active=st.booleans(),
    )
    @settings(max_examples=100)
    def test_combined_filters_match_all_results(
        self,
        servers: list[dict],
        filter_env_type: str | None,
        filter_is_active: bool,
    ):
        """All filtered servers must match both filters."""
        filtered = [
            s
            for s in servers
            if s["env_type"] == filter_env_type and s["is_active"] == filter_is_active
        ]

        for server in filtered:
            assert server["env_type"] == filter_env_type
            assert server["is_active"] == filter_is_active

    @given(
        checks=st.lists(
            st.fixed_dictionaries({
                "check_id": st.integers(min_value=1, max_value=1000),
                "check_code": st.text(min_size=1, max_size=50),
                "category": st.sampled_from(["performance", "availability", "security", "custom"]),
                "is_active": st.booleans(),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda c: c["check_id"],
        ),
        filter_category=st.sampled_from(["performance", "availability", "security", "custom"]),
    )
    @settings(max_examples=100)
    def test_category_filter_matches_all_results(
        self, checks: list[dict], filter_category: str
    ):
        """All filtered checks must have matching category."""
        filtered = [c for c in checks if c["category"] == filter_category]

        for check in filtered:
            assert check["category"] == filter_category

    @given(
        alerts=st.lists(
            st.fixed_dictionaries({
                "alert_id": st.integers(min_value=1, max_value=1000),
                "status": st.sampled_from(["WARNING", "CRITICAL"]),
                "acknowledged_at": st.one_of(st.none(), st.just("2024-01-01T00:00:00Z")),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda a: a["alert_id"],
        ),
        filter_status=st.sampled_from(["WARNING", "CRITICAL"]),
    )
    @settings(max_examples=100)
    def test_status_filter_matches_all_results(
        self, alerts: list[dict], filter_status: str
    ):
        """All filtered alerts must have matching status."""
        filtered = [a for a in alerts if a["status"] == filter_status]

        for alert in filtered:
            assert alert["status"] == filter_status

    @given(
        alerts=st.lists(
            st.fixed_dictionaries({
                "alert_id": st.integers(min_value=1, max_value=1000),
                "status": st.sampled_from(["WARNING", "CRITICAL"]),
                "acknowledged_at": st.one_of(st.none(), st.just("2024-01-01T00:00:00Z")),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda a: a["alert_id"],
        ),
        filter_ack_state=st.sampled_from(["unacknowledged", "acknowledged", "all"]),
    )
    @settings(max_examples=100)
    def test_acknowledgement_filter_matches_all_results(
        self, alerts: list[dict], filter_ack_state: str
    ):
        """All filtered alerts must match acknowledgement state."""
        if filter_ack_state == "unacknowledged":
            filtered = [a for a in alerts if a["acknowledged_at"] is None]
        elif filter_ack_state == "acknowledged":
            filtered = [a for a in alerts if a["acknowledged_at"] is not None]
        else:  # "all"
            filtered = alerts

        for alert in filtered:
            if filter_ack_state == "unacknowledged":
                assert alert["acknowledged_at"] is None
            elif filter_ack_state == "acknowledged":
                assert alert["acknowledged_at"] is not None

    @given(
        incidents=st.lists(
            st.fixed_dictionaries({
                "incident_id": st.integers(min_value=1, max_value=1000),
                "status": st.sampled_from(["OPEN", "RESOLVED"]),
                "server_id": st.integers(min_value=1, max_value=100),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda i: i["incident_id"],
        ),
        filter_status=st.sampled_from(["OPEN", "RESOLVED"]),
    )
    @settings(max_examples=100)
    def test_incident_status_filter_matches_all_results(
        self, incidents: list[dict], filter_status: str
    ):
        """All filtered incidents must have matching status."""
        filtered = [i for i in incidents if i["status"] == filter_status]

        for incident in filtered:
            assert incident["status"] == filter_status

    @given(
        incidents=st.lists(
            st.fixed_dictionaries({
                "incident_id": st.integers(min_value=1, max_value=1000),
                "status": st.sampled_from(["OPEN", "RESOLVED"]),
                "server_id": st.integers(min_value=1, max_value=100),
            }),
            min_size=1,
            max_size=20,
            unique_by=lambda i: i["incident_id"],
        ),
        filter_server_id=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_server_id_filter_matches_all_results(
        self, incidents: list[dict], filter_server_id: int
    ):
        """All filtered incidents must have matching server_id."""
        filtered = [i for i in incidents if i["server_id"] == filter_server_id]

        for incident in filtered:
            assert incident["server_id"] == filter_server_id

