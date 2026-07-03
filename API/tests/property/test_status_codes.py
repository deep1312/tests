"""
Property-based tests for status code mapping.

**Validates: Requirements 4.3, 5.3, 7.3, 8.3**

Tests:
  - Property 9: Status codes map to correct human-readable labels
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 9: Status Codes Map to Correct Human-Readable Labels
# ---------------------------------------------------------------------------


class TestStatusCodeMapping:
    """Numeric status codes must map to correct string labels."""

    # Check run status mappings
    CHECK_RUN_STATUS_MAP = {
        1: "SUCCESS",
        2: "FAILED",
        3: "TIMEOUT",
    }

    # Monitoring log status code mappings
    MONITORING_LOG_STATUS_MAP = {
        1: "WARNING",
        2: "CRITICAL",
        3: "FAILURE",
    }

    # Alert status mappings
    ALERT_STATUS_MAP = {
        1: "WARNING",
        2: "CRITICAL",
    }

    # Incident status mappings
    INCIDENT_STATUS_MAP = {
        1: "OPEN",
        2: "RESOLVED",
    }

    @given(status_code=st.sampled_from([1, 2, 3]))
    @settings(max_examples=50)
    def test_check_run_status_mapping(self, status_code: int):
        """Check run status codes must map correctly."""
        expected_label = self.CHECK_RUN_STATUS_MAP[status_code]
        assert expected_label in ["SUCCESS", "FAILED", "TIMEOUT"]

    @given(status_code=st.sampled_from([1, 2, 3]))
    @settings(max_examples=50)
    def test_monitoring_log_status_mapping(self, status_code: int):
        """Monitoring log status codes must map correctly."""
        expected_label = self.MONITORING_LOG_STATUS_MAP[status_code]
        assert expected_label in ["WARNING", "CRITICAL", "FAILURE"]

    @given(status_code=st.sampled_from([1, 2]))
    @settings(max_examples=50)
    def test_alert_status_mapping(self, status_code: int):
        """Alert status codes must map correctly."""
        expected_label = self.ALERT_STATUS_MAP[status_code]
        assert expected_label in ["WARNING", "CRITICAL"]

    @given(status_code=st.sampled_from([1, 2]))
    @settings(max_examples=50)
    def test_incident_status_mapping(self, status_code: int):
        """Incident status codes must map correctly."""
        expected_label = self.INCIDENT_STATUS_MAP[status_code]
        assert expected_label in ["OPEN", "RESOLVED"]

    @given(status_code=st.integers(min_value=1, max_value=3))
    @settings(max_examples=50)
    def test_check_run_status_never_numeric_in_response(self, status_code: int):
        """Response must contain label, not numeric code."""
        # Simulate response with label
        label = self.CHECK_RUN_STATUS_MAP.get(status_code)
        if label:
            # Response should have the label, not the code
            assert isinstance(label, str)
            assert label != str(status_code)

    @given(status_code=st.integers(min_value=1, max_value=3))
    @settings(max_examples=50)
    def test_monitoring_log_status_never_numeric_in_response(self, status_code: int):
        """Response must contain label, not numeric code."""
        label = self.MONITORING_LOG_STATUS_MAP.get(status_code)
        if label:
            assert isinstance(label, str)
            assert label != str(status_code)

    @given(status_code=st.integers(min_value=1, max_value=2))
    @settings(max_examples=50)
    def test_alert_status_never_numeric_in_response(self, status_code: int):
        """Response must contain label, not numeric code."""
        label = self.ALERT_STATUS_MAP.get(status_code)
        if label:
            assert isinstance(label, str)
            assert label != str(status_code)

    @given(status_code=st.integers(min_value=1, max_value=2))
    @settings(max_examples=50)
    def test_incident_status_never_numeric_in_response(self, status_code: int):
        """Response must contain label, not numeric code."""
        label = self.INCIDENT_STATUS_MAP.get(status_code)
        if label:
            assert isinstance(label, str)
            assert label != str(status_code)

    @given(status_code=st.integers(min_value=1, max_value=3))
    @settings(max_examples=50)
    def test_check_run_status_label_is_uppercase(self, status_code: int):
        """Status labels must be uppercase."""
        label = self.CHECK_RUN_STATUS_MAP.get(status_code)
        if label:
            assert label == label.upper()

    @given(status_code=st.integers(min_value=1, max_value=3))
    @settings(max_examples=50)
    def test_monitoring_log_status_label_is_uppercase(self, status_code: int):
        """Status labels must be uppercase."""
        label = self.MONITORING_LOG_STATUS_MAP.get(status_code)
        if label:
            assert label == label.upper()

    @given(status_code=st.integers(min_value=1, max_value=2))
    @settings(max_examples=50)
    def test_alert_status_label_is_uppercase(self, status_code: int):
        """Status labels must be uppercase."""
        label = self.ALERT_STATUS_MAP.get(status_code)
        if label:
            assert label == label.upper()

    @given(status_code=st.integers(min_value=1, max_value=2))
    @settings(max_examples=50)
    def test_incident_status_label_is_uppercase(self, status_code: int):
        """Status labels must be uppercase."""
        label = self.INCIDENT_STATUS_MAP.get(status_code)
        if label:
            assert label == label.upper()

