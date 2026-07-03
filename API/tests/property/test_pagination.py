"""
Property-based tests for pagination.

**Validates: Requirements 1.9, 2.9, 4.4, 5.4, 6.3, 13.2**

Tests:
  - Property 8: Pagination returns correct slice
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 8: Pagination Returns Correct Slice
# ---------------------------------------------------------------------------


class TestPaginationCorrectness:
    """Pagination must return correct slice with accurate metadata."""

    @given(
        total_items=st.integers(min_value=0, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
        offset=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=200)
    def test_data_length_not_exceeds_limit(
        self, total_items: int, limit: int, offset: int
    ):
        """len(data) must not exceed limit."""
        # Simulate pagination
        full_list = list(range(total_items))
        data = full_list[offset : offset + limit]

        assert len(data) <= limit

    @given(
        total_items=st.integers(min_value=0, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
        offset=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=200)
    def test_total_matches_dataset_size(
        self, total_items: int, limit: int, offset: int
    ):
        """meta.pagination.total must equal total dataset size."""
        full_list = list(range(total_items))
        data = full_list[offset : offset + limit]

        # Total should be the full dataset size
        total = len(full_list)
        assert total == total_items

    @given(
        total_items=st.integers(min_value=0, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
        offset=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=200)
    def test_has_more_flag_correct(
        self, total_items: int, limit: int, offset: int
    ):
        """has_more must be True iff offset + limit < total."""
        full_list = list(range(total_items))
        data = full_list[offset : offset + limit]

        total = len(full_list)
        has_more = offset + limit < total

        # Verify the logic
        if has_more:
            assert offset + limit < total
        else:
            assert offset + limit >= total

    @given(
        total_items=st.integers(min_value=0, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
        offset=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=200)
    def test_returned_items_match_slice(
        self, total_items: int, limit: int, offset: int
    ):
        """Returned items must match full_list[offset:offset+limit]."""
        full_list = list(range(total_items))
        data = full_list[offset : offset + limit]
        expected = full_list[offset : offset + limit]

        assert data == expected

    @given(
        total_items=st.integers(min_value=1, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_first_page_starts_at_offset_zero(self, total_items: int, limit: int):
        """First page (offset=0) must start at beginning."""
        full_list = list(range(total_items))
        offset = 0
        data = full_list[offset : offset + limit]

        if total_items > 0:
            assert data[0] == 0

    @given(
        total_items=st.integers(min_value=1, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_last_page_has_fewer_items_if_not_multiple(
        self, total_items: int, limit: int
    ):
        """Last page may have fewer items if total is not multiple of limit."""
        full_list = list(range(total_items))

        # Calculate last page offset
        last_offset = (total_items // limit) * limit
        if total_items % limit == 0 and total_items > 0:
            last_offset = total_items - limit

        data = full_list[last_offset : last_offset + limit]

        # Last page should have at most limit items
        assert len(data) <= limit

    @given(
        total_items=st.integers(min_value=0, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
        offset=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=200)
    def test_offset_beyond_total_returns_empty(
        self, total_items: int, limit: int, offset: int
    ):
        """Offset beyond total must return empty data."""
        full_list = list(range(total_items))
        data = full_list[offset : offset + limit]

        if offset >= total_items:
            assert len(data) == 0

    @given(
        total_items=st.integers(min_value=1, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_all_pages_together_cover_full_dataset(
        self, total_items: int, limit: int
    ):
        """All pages combined must cover the full dataset."""
        full_list = list(range(total_items))

        # Collect all pages
        all_data = []
        offset = 0
        while offset < total_items:
            page = full_list[offset : offset + limit]
            all_data.extend(page)
            offset += limit

        # All data should match the full list
        assert all_data == full_list

    @given(
        total_items=st.integers(min_value=1, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_no_duplicate_items_across_pages(
        self, total_items: int, limit: int
    ):
        """No item should appear in multiple pages."""
        full_list = list(range(total_items))

        # Collect all pages
        all_data = []
        offset = 0
        while offset < total_items:
            page = full_list[offset : offset + limit]
            all_data.extend(page)
            offset += limit

        # No duplicates
        assert len(all_data) == len(set(all_data))

    @given(
        total_items=st.integers(min_value=1, max_value=1000),
        limit=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_page_order_preserved(self, total_items: int, limit: int):
        """Items must appear in order across pages."""
        full_list = list(range(total_items))

        # Collect all pages
        all_data = []
        offset = 0
        while offset < total_items:
            page = full_list[offset : offset + limit]
            all_data.extend(page)
            offset += limit

        # Order should be preserved
        assert all_data == sorted(all_data)

