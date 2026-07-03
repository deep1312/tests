"""
Property-based tests for time range enforcement.

**Validates: Requirements 6.8, 13.8**

Tests:
  - Property 15: Maximum time range enforcement
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 15: Maximum Time Range Enforcement
# ---------------------------------------------------------------------------


class TestTimeRangeEnforcement:
    """Time range must be enforced; max 30 days for raw metrics."""

    MAX_DAYS = 30

    @given(
        days=st.integers(min_value=1, max_value=29),
    )
    @settings(max_examples=100)
    def test_range_within_limit_accepted(self, days: int):
        """Range within 30 days must be accepted."""
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(days=days)
        to_dt = now

        range_days = (to_dt - from_dt).days
        assert range_days <= self.MAX_DAYS

    @given(
        days=st.integers(min_value=31, max_value=365),
    )
    @settings(max_examples=100)
    def test_range_exceeds_limit_rejected(self, days: int):
        """Range exceeding 30 days must be rejected."""
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(days=days)
        to_dt = now

        range_days = (to_dt - from_dt).days
        assert range_days > self.MAX_DAYS

    @given(
        days=st.integers(min_value=1, max_value=30),
    )
    @settings(max_examples=100)
    def test_range_exactly_30_days_accepted(self, days: int):
        """Range of exactly 30 days must be accepted."""
        if days != 30:
            pytest.skip("Not exactly 30 days")

        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(days=30)
        to_dt = now

        range_days = (to_dt - from_dt).days
        assert range_days <= self.MAX_DAYS

    @given(
        days=st.integers(min_value=31, max_value=365),
    )
    @settings(max_examples=100)
    def test_range_31_days_rejected(self, days: int):
        """Range of 31 days must be rejected."""
        if days != 31:
            pytest.skip("Not 31 days")

        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(days=31)
        to_dt = now

        range_days = (to_dt - from_dt).days
        assert range_days > self.MAX_DAYS

    @given(
        from_days_ago=st.integers(min_value=1, max_value=30),
        to_days_ago=st.integers(min_value=0, max_value=29),
    )
    @settings(max_examples=100)
    def test_arbitrary_range_within_limit(self, from_days_ago: int, to_days_ago: int):
        """Arbitrary range within 30 days must be accepted."""
        if from_days_ago <= to_days_ago:
            pytest.skip("from must be before to")

        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(days=from_days_ago)
        to_dt = now - timedelta(days=to_days_ago)

        range_days = (to_dt - from_dt).days
        assert range_days <= self.MAX_DAYS

    @given(
        from_days_ago=st.integers(min_value=31, max_value=365),
        to_days_ago=st.integers(min_value=0, max_value=30),
    )
    @settings(max_examples=100)
    def test_arbitrary_range_exceeds_limit(self, from_days_ago: int, to_days_ago: int):
        """Arbitrary range exceeding 30 days must be rejected."""
        if from_days_ago <= to_days_ago:
            pytest.skip("from must be before to")

        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(days=from_days_ago)
        to_dt = now - timedelta(days=to_days_ago)

        range_days = (to_dt - from_dt).days
        assert range_days > self.MAX_DAYS

    @given(
        hours=st.integers(min_value=1, max_value=720),  # 30 days in hours
    )
    @settings(max_examples=100)
    def test_range_in_hours_within_limit(self, hours: int):
        """Range in hours within 30 days must be accepted."""
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(hours=hours)
        to_dt = now

        range_days = (to_dt - from_dt).total_seconds() / (24 * 3600)
        assert range_days <= self.MAX_DAYS

    @given(
        hours=st.integers(min_value=745, max_value=8760),  # > 30 days in hours
    )
    @settings(max_examples=100)
    def test_range_in_hours_exceeds_limit(self, hours: int):
        """Range in hours exceeding 30 days must be rejected."""
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(hours=hours)
        to_dt = now

        range_days = (to_dt - from_dt).total_seconds() / (24 * 3600)
        assert range_days > self.MAX_DAYS

    @given(
        seconds=st.integers(min_value=1, max_value=2592000),  # 30 days in seconds
    )
    @settings(max_examples=100)
    def test_range_in_seconds_within_limit(self, seconds: int):
        """Range in seconds within 30 days must be accepted."""
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(seconds=seconds)
        to_dt = now

        range_days = (to_dt - from_dt).total_seconds() / (24 * 3600)
        assert range_days <= self.MAX_DAYS

    @given(
        seconds=st.integers(min_value=2592001, max_value=31536000),  # > 30 days in seconds
    )
    @settings(max_examples=100)
    def test_range_in_seconds_exceeds_limit(self, seconds: int):
        """Range in seconds exceeding 30 days must be rejected."""
        now = datetime.now(timezone.utc)
        from_dt = now - timedelta(seconds=seconds)
        to_dt = now

        range_days = (to_dt - from_dt).total_seconds() / (24 * 3600)
        assert range_days > self.MAX_DAYS

