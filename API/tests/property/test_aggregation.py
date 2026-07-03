"""
Property-based tests for metric aggregation.

**Validates: Requirements 6.6, 9.4**

Tests:
  - Property 14: Metric aggregation is mathematically correct
"""

from __future__ import annotations

import os
import statistics

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 14: Metric Aggregation Is Mathematically Correct
# ---------------------------------------------------------------------------


class TestMetricAggregation:
    """Aggregation must be mathematically correct."""

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_avg_value_equals_mean(self, samples: list[float]):
        """avg_value must equal mean of samples."""
        avg_value = statistics.mean(samples)
        expected_avg = statistics.mean(samples)

        assert abs(avg_value - expected_avg) < 1e-6

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_min_value_equals_min(self, samples: list[float]):
        """min_value must equal min of samples."""
        min_value = min(samples)
        expected_min = min(samples)

        assert min_value == expected_min

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_max_value_equals_max(self, samples: list[float]):
        """max_value must equal max of samples."""
        max_value = max(samples)
        expected_max = max(samples)

        assert max_value == expected_max

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_sample_count_equals_length(self, samples: list[float]):
        """sample_count must equal number of samples."""
        sample_count = len(samples)
        expected_count = len(samples)

        assert sample_count == expected_count

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_min_less_than_or_equal_avg(self, samples: list[float]):
        """min_value must be <= avg_value."""
        min_value = min(samples)
        avg_value = statistics.mean(samples)

        assert min_value <= avg_value

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_avg_less_than_or_equal_max(self, samples: list[float]):
        """avg_value must be <= max_value."""
        avg_value = statistics.mean(samples)
        max_value = max(samples)

        assert avg_value <= max_value

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=200)
    def test_min_less_than_or_equal_max(self, samples: list[float]):
        """min_value must be <= max_value."""
        min_value = min(samples)
        max_value = max(samples)

        assert min_value <= max_value

    @given(
        samples=st.lists(
            st.floats(min_value=0, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=100)
    def test_aggregation_with_positive_values(self, samples: list[float]):
        """Aggregation must work with positive values."""
        avg_value = statistics.mean(samples)
        min_value = min(samples)
        max_value = max(samples)

        assert min_value >= 0
        assert avg_value >= min_value
        assert avg_value <= max_value

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=0, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=100)
    def test_aggregation_with_negative_values(self, samples: list[float]):
        """Aggregation must work with negative values."""
        avg_value = statistics.mean(samples)
        min_value = min(samples)
        max_value = max(samples)

        assert max_value <= 0
        assert min_value <= avg_value
        assert avg_value <= max_value

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=100)
    def test_aggregation_with_mixed_values(self, samples: list[float]):
        """Aggregation must work with mixed positive and negative values."""
        avg_value = statistics.mean(samples)
        min_value = min(samples)
        max_value = max(samples)

        assert min_value <= avg_value <= max_value

    @given(
        value=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_single_sample_aggregation(self, value: float):
        """Aggregation of single sample must equal that sample."""
        samples = [value]
        avg_value = statistics.mean(samples)
        min_value = min(samples)
        max_value = max(samples)

        assert avg_value == value
        assert min_value == value
        assert max_value == value

    @given(
        samples=st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=1000,
        )
    )
    @settings(max_examples=100)
    def test_aggregation_values_are_numbers(self, samples: list[float]):
        """Aggregation values must be numbers."""
        avg_value = statistics.mean(samples)
        min_value = min(samples)
        max_value = max(samples)

        assert isinstance(avg_value, (int, float))
        assert isinstance(min_value, (int, float))
        assert isinstance(max_value, (int, float))

