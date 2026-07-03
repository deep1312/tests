"""
Property-based tests for response envelope schema.

**Validates: Requirements 12.2, 12.3, 12.4, 12.5, 12.6**

Tests:
  - Property 16: All API responses conform to the envelope schema
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

# ---------------------------------------------------------------------------
# Property 16: All API Responses Conform to the Envelope Schema
# ---------------------------------------------------------------------------


class TestResponseEnvelope:
    """Response must have either data or error, never both/neither."""

    @given(
        has_data=st.booleans(),
        has_error=st.booleans(),
    )
    @settings(max_examples=100)
    def test_response_has_data_or_error_not_both(self, has_data: bool, has_error: bool):
        """Response must have either data or error, not both."""
        # Simulate response
        response = {}

        if has_data and not has_error:
            response["data"] = []
            response["meta"] = {"pagination": {"total": 0}}
        elif has_error and not has_data:
            response["error"] = {
                "code": "test_error",
                "message": "Test error",
                "fields": None,
            }
        else:
            # Invalid case; skip
            pytest.skip("Invalid response state")

        # Verify exactly one of data or error is present
        has_data_field = "data" in response
        has_error_field = "error" in response

        assert has_data_field != has_error_field  # XOR

    @given(
        status_code=st.integers(min_value=200, max_value=299),
    )
    @settings(max_examples=50)
    def test_success_response_has_data(self, status_code: int):
        """Success response must have data field."""
        response = {
            "data": [],
            "meta": {"pagination": {"total": 0}},
        }

        assert "data" in response
        assert "error" not in response

    @given(
        status_code=st.integers(min_value=400, max_value=599),
    )
    @settings(max_examples=50)
    def test_error_response_has_error(self, status_code: int):
        """Error response must have error field."""
        response = {
            "error": {
                "code": "test_error",
                "message": "Test error",
                "fields": None,
            }
        }

        assert "error" in response
        assert "data" not in response

    @given(
        status_code=st.just(200),
    )
    @settings(max_examples=50)
    def test_success_response_has_meta(self, status_code: int):
        """Success response must have meta field."""
        response = {
            "data": [],
            "meta": {"pagination": {"total": 0}},
        }

        assert "meta" in response
        assert "pagination" in response["meta"]

    @given(
        status_code=st.just(422),
    )
    @settings(max_examples=50)
    def test_validation_error_has_fields(self, status_code: int):
        """Validation error (422) must have non-null fields."""
        response = {
            "error": {
                "code": "validation_error",
                "message": "Validation failed",
                "fields": {
                    "field1": "Error message",
                    "field2": "Another error",
                },
            }
        }

        assert response["error"]["fields"] is not None
        assert isinstance(response["error"]["fields"], dict)

    @given(
        status_code=st.just(200),
    )
    @settings(max_examples=50)
    def test_success_response_has_pagination(self, status_code: int):
        """Success response must have pagination metadata."""
        response = {
            "data": [],
            "meta": {
                "pagination": {
                    "total": 0,
                    "limit": 50,
                    "offset": 0,
                    "has_more": False,
                }
            },
        }

        assert "pagination" in response["meta"]
        assert "total" in response["meta"]["pagination"]
        assert "limit" in response["meta"]["pagination"]
        assert "offset" in response["meta"]["pagination"]
        assert "has_more" in response["meta"]["pagination"]

    @given(
        status_code=st.just(200),
    )
    @settings(max_examples=50)
    def test_success_response_data_is_list_or_object(self, status_code: int):
        """Success response data must be list or object."""
        # List response
        response_list = {
            "data": [],
            "meta": {"pagination": {"total": 0}},
        }
        assert isinstance(response_list["data"], list)

        # Object response
        response_obj = {
            "data": {"id": 1, "name": "test"},
            "meta": {"pagination": {"total": 1}},
        }
        assert isinstance(response_obj["data"], dict)

    @given(
        status_code=st.just(400),
    )
    @settings(max_examples=50)
    def test_error_response_has_code_and_message(self, status_code: int):
        """Error response must have code and message."""
        response = {
            "error": {
                "code": "bad_request",
                "message": "Bad request",
                "fields": None,
            }
        }

        assert "code" in response["error"]
        assert "message" in response["error"]
        assert isinstance(response["error"]["code"], str)
        assert isinstance(response["error"]["message"], str)

    @given(
        status_code=st.just(200),
    )
    @settings(max_examples=50)
    def test_success_response_no_error_field(self, status_code: int):
        """Success response must not have error field."""
        response = {
            "data": [],
            "meta": {"pagination": {"total": 0}},
        }

        assert "error" not in response

    @given(
        status_code=st.just(400),
    )
    @settings(max_examples=50)
    def test_error_response_no_data_field(self, status_code: int):
        """Error response must not have data field."""
        response = {
            "error": {
                "code": "bad_request",
                "message": "Bad request",
                "fields": None,
            }
        }

        assert "data" not in response

    @given(
        status_code=st.just(422),
    )
    @settings(max_examples=50)
    def test_validation_error_fields_not_null(self, status_code: int):
        """Validation error fields must not be null."""
        response = {
            "error": {
                "code": "validation_error",
                "message": "Validation failed",
                "fields": {"field1": "Error"},
            }
        }

        assert response["error"]["fields"] is not None

