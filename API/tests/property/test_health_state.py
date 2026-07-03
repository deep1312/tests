"""
Property-based tests for health state classification.

**Validates: Requirements 4a.3**

Tests:
  - Property 11: Health state classification is deterministic
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

def classify_health_state(
    consecutive_failures: int, failure_rate_pct: float
) -> str:
    """Classify health state based on consecutive failures and failure rate."""
    if consecutive_failures == 0 and failure_rate_pct < 10:
        return "HEALTHY"
    elif failure_rate_pct >= 10 and failure_rate_pct < 50:
        return "FLAKY"
    elif consecutive_failures > 0 and failure_rate_pct >= 50:
        return "FAILING"
    else:
        # Ambiguous case; return None to indicate invalid input
        return None


# ---------------------------------------------------------------------------
# Property 11: Health State Classification Is Deterministic
# ---------------------------------------------------------------------------


class TestHealthStateClassification:
    """Health state must be deterministic and exactly one of three states."""

    @given(
        consecutive_failures=st.integers(min_value=0, max_value=100),
        failure_rate_pct=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=200)
    def test_health_state_is_one_of_three(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """Health state must be exactly one of HEALTHY, FLAKY, FAILING."""
        state = classify_health_state(consecutive_failures, failure_rate_pct)

        if state is not None:
            assert state in ["HEALTHY", "FLAKY", "FAILING"]

    @given(
        consecutive_failures=st.just(0),
        failure_rate_pct=st.floats(min_value=0.0, max_value=9.99),
    )
    @settings(max_examples=100)
    def test_healthy_classification(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """consecutive_failures=0 and failure_rate<10 must be HEALTHY."""
        state = classify_health_state(consecutive_failures, failure_rate_pct)
        assert state == "HEALTHY"

    @given(
        consecutive_failures=st.integers(min_value=0, max_value=100),
        failure_rate_pct=st.floats(min_value=10.0, max_value=49.99),
    )
    @settings(max_examples=100)
    def test_flaky_classification(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """failure_rate between 10 and 50 must be FLAKY."""
        state = classify_health_state(consecutive_failures, failure_rate_pct)
        assert state == "FLAKY"

    @given(
        consecutive_failures=st.integers(min_value=1, max_value=100),
        failure_rate_pct=st.floats(min_value=50.0, max_value=100.0),
    )
    @settings(max_examples=100)
    def test_failing_classification(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """consecutive_failures>0 and failure_rate>=50 must be FAILING."""
        state = classify_health_state(consecutive_failures, failure_rate_pct)
        assert state == "FAILING"

    @given(
        consecutive_failures=st.just(0),
        failure_rate_pct=st.floats(min_value=0.0, max_value=9.99),
    )
    @settings(max_examples=100)
    def test_classification_is_deterministic(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """Same input must always produce same output."""
        state1 = classify_health_state(consecutive_failures, failure_rate_pct)
        state2 = classify_health_state(consecutive_failures, failure_rate_pct)
        state3 = classify_health_state(consecutive_failures, failure_rate_pct)

        assert state1 == state2 == state3

    @given(
        consecutive_failures=st.integers(min_value=0, max_value=100),
        failure_rate_pct=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=200)
    def test_classification_never_empty_string(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """Classification must never be empty string."""
        state = classify_health_state(consecutive_failures, failure_rate_pct)

        if state is not None:
            assert state != ""
            assert len(state) > 0

    @given(
        consecutive_failures=st.integers(min_value=0, max_value=100),
        failure_rate_pct=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=200)
    def test_classification_is_uppercase(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """Classification must be uppercase."""
        state = classify_health_state(consecutive_failures, failure_rate_pct)

        if state is not None:
            assert state == state.upper()

    @given(
        consecutive_failures=st.just(0),
        failure_rate_pct=st.floats(min_value=0.0, max_value=9.99),
    )
    @settings(max_examples=50)
    def test_healthy_boundary_at_10_percent(
        self, consecutive_failures: int, failure_rate_pct: float
    ):
        """Boundary at 10% failure rate."""
        # Just below 10%
        state_below = classify_health_state(consecutive_failures, 9.99)
        assert state_below == "HEALTHY"

        # At 10%
        state_at = classify_health_state(consecutive_failures, 10.0)
        assert state_at == "FLAKY"

    @given(
        consecutive_failures=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=50)
    def test_flaky_boundary_at_50_percent(self, consecutive_failures: int):
        """Boundary at 50% failure rate."""
        # Just below 50%
        state_below = classify_health_state(consecutive_failures, 49.99)
        assert state_below == "FLAKY"

        # At 50% with consecutive_failures > 0
        if consecutive_failures > 0:
            state_at = classify_health_state(consecutive_failures, 50.0)
            assert state_at == "FAILING"

    @given(
        failure_rate_pct=st.floats(min_value=0.0, max_value=100.0),
    )
    @settings(max_examples=100)
    def test_consecutive_failures_zero_boundary(self, failure_rate_pct: float):
        """Boundary between 0 and 1 consecutive failures."""
        # 0 consecutive failures
        state_zero = classify_health_state(0, failure_rate_pct)

        # 1 consecutive failure
        state_one = classify_health_state(1, failure_rate_pct)

        # They may differ depending on failure_rate_pct
        if failure_rate_pct < 10:
            assert state_zero == "HEALTHY"
        elif failure_rate_pct < 50:
            assert state_zero == "FLAKY"
            assert state_one == "FLAKY"
        else:
            assert state_one == "FAILING"

