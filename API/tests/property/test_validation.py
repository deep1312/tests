"""
Property-based tests for request validation.

**Validates: Requirements 1.7, 3.3**

Tests:
  - Property 4: Retention constraint validation
  - Property 13: Invalid comparison operator is rejected
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st
from pydantic import ValidationError

from app.models.requests.server import ServerCreateRequest  # noqa: E402
from app.models.requests.threshold import ThresholdCreateRequest  # noqa: E402


# ---------------------------------------------------------------------------
# Property 4: Retention Constraint Validation
# ---------------------------------------------------------------------------


class TestRetentionConstraint:
    """For metrics_days < logs_days, validation must fail."""

    @given(
        metrics_days=st.integers(min_value=1, max_value=100),
        logs_days=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=200)
    def test_metrics_less_than_logs_raises_validation_error(
        self, metrics_days: int, logs_days: int
    ):
        """When metrics_days < logs_days, validation must fail."""
        if metrics_days >= logs_days:
            # Skip this case; we only test the failure case
            pytest.skip("metrics_days >= logs_days")

        with pytest.raises(ValidationError) as exc_info:
            ServerCreateRequest(
                server_label="test-server",
                server_ip="192.168.1.1",
                port=5432,
                db_name="postgres",
                username="monitor",
                password="secret",
                retention_metrics_days=metrics_days,
                retention_logs_days=logs_days,
            )

        # Verify the error message mentions the constraint
        error_str = str(exc_info.value)
        assert "retention" in error_str.lower()

    @given(
        metrics_days=st.integers(min_value=1, max_value=100),
        logs_days=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=200)
    def test_metrics_equal_or_greater_than_logs_succeeds(
        self, metrics_days: int, logs_days: int
    ):
        """When metrics_days >= logs_days, validation must succeed."""
        if metrics_days < logs_days:
            # Skip this case; we only test the success case
            pytest.skip("metrics_days < logs_days")

        # Should not raise
        request = ServerCreateRequest(
            server_label="test-server",
            server_ip="192.168.1.1",
            port=5432,
            db_name="postgres",
            username="monitor",
            password="secret",
            retention_metrics_days=metrics_days,
            retention_logs_days=logs_days,
        )
        assert request.retention_metrics_days >= request.retention_logs_days

    @given(
        metrics_days=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_equal_retention_days_succeeds(self, metrics_days: int):
        """When metrics_days == logs_days, validation must succeed."""
        request = ServerCreateRequest(
            server_label="test-server",
            server_ip="192.168.1.1",
            port=5432,
            db_name="postgres",
            username="monitor",
            password="secret",
            retention_metrics_days=metrics_days,
            retention_logs_days=metrics_days,
        )
        assert request.retention_metrics_days == request.retention_logs_days


# ---------------------------------------------------------------------------
# Property 13: Invalid Comparison Operator is Rejected
# ---------------------------------------------------------------------------


class TestComparisonOperatorValidation:
    """Invalid operators must be rejected; valid ones accepted."""

    VALID_OPERATORS = {">", "<", "=", "!=", "~"}
    INVALID_OPERATORS = {
        ">>",
        "<<",
        "==",
        "<>",
        ">=",
        "<=",
        "!",
        "~=",
        "LIKE",
        "IN",
        "NOT",
        "AND",
        "OR",
        "XOR",
        "BETWEEN",
        "IS",
        "ISNULL",
        "NOTNULL",
        "CONTAINS",
        "MATCHES",
        "REGEX",
        "GLOB",
        "COLLATE",
        "ESCAPE",
        "SIMILAR",
        "ILIKE",
        "CITEXT",
        "JSONB",
        "ARRAY",
        "RANGE",
        "INET",
        "MACADDR",
        "UUID",
        "BYTEA",
        "BIT",
        "VARBIT",
        "BOOLEAN",
        "SMALLINT",
        "INTEGER",
        "BIGINT",
        "DECIMAL",
        "NUMERIC",
        "REAL",
        "DOUBLE",
        "SERIAL",
        "BIGSERIAL",
        "MONEY",
        "CHARACTER",
        "VARCHAR",
        "TEXT",
        "NAME",
        "BYTEA",
        "TIMESTAMP",
        "DATE",
        "TIME",
        "INTERVAL",
        "BOOLEAN",
        "POINT",
        "LINE",
        "LSEG",
        "BOX",
        "PATH",
        "POLYGON",
        "CIRCLE",
        "CIDR",
        "INET",
        "MACADDR",
        "TSVECTOR",
        "TSQUERY",
        "JSON",
        "JSONB",
        "XML",
        "ENUM",
        "COMPOSITE",
        "RANGE",
        "MULTIRANGE",
        "DOMAIN",
        "BASE",
        "PSEUDO",
        "INTERNAL",
        "OPAQUE",
        "VOID",
        "CSTRING",
        "RECORD",
        "ANYARRAY",
        "ANYNONARRAY",
        "ANYENUM",
        "ANYRANGE",
        "ANYMULTIRANGE",
        "ANYCOMPATIBLE",
        "ANYCOMPATIBLEARRAY",
        "ANYCOMPATIBLENONARRAY",
        "ANYCOMPATIBLERANGE",
        "TRIGGER",
        "EVENT_TRIGGER",
        "LANGUAGE_HANDLER",
        "FDW_HANDLER",
        "INDEX_AM_HANDLER",
        "TSM_HANDLER",
        "TABLE_AM_HANDLER",
        "ACCESS_METHOD",
        "OPERATOR_CLASS",
        "OPERATOR_FAMILY",
        "CAST",
        "CONVERSION",
        "AGGREGATE",
        "WINDOW",
        "PROCEDURE",
        "ROUTINE",
        "FUNCTION",
        "TRANSFORM",
        "SCHEMA",
        "NAMESPACE",
        "DATABASE",
        "TABLESPACE",
        "ROLE",
        "USER",
        "GROUP",
        "EXTENSION",
        "FOREIGN_DATA_WRAPPER",
        "FOREIGN_SERVER",
        "USER_MAPPING",
        "PUBLICATION",
        "SUBSCRIPTION",
        "STATISTICS",
        "POLICY",
        "RULE",
        "TRIGGER",
        "CONSTRAINT",
        "INDEX",
        "SEQUENCE",
        "VIEW",
        "MATERIALIZED_VIEW",
        "TABLE",
        "PARTITIONED_TABLE",
        "PARTITION",
        "COLUMN",
        "ATTRIBUTE",
        "PARAMETER",
        "ARGUMENT",
        "RETURN_TYPE",
        "RETURN_VALUE",
        "RETURN_RECORD",
        "RETURN_SET",
        "RETURN_TABLE",
        "RETURN_VOID",
        "RETURN_TRIGGER",
        "RETURN_EVENT_TRIGGER",
        "RETURN_LANGUAGE_HANDLER",
        "RETURN_FDW_HANDLER",
        "RETURN_INDEX_AM_HANDLER",
        "RETURN_TSM_HANDLER",
        "RETURN_TABLE_AM_HANDLER",
        "RETURN_ACCESS_METHOD",
        "RETURN_OPERATOR_CLASS",
        "RETURN_OPERATOR_FAMILY",
        "RETURN_CAST",
        "RETURN_CONVERSION",
        "RETURN_AGGREGATE",
        "RETURN_WINDOW",
        "RETURN_PROCEDURE",
        "RETURN_ROUTINE",
        "RETURN_FUNCTION",
        "RETURN_TRANSFORM",
        "RETURN_SCHEMA",
        "RETURN_NAMESPACE",
        "RETURN_DATABASE",
        "RETURN_TABLESPACE",
        "RETURN_ROLE",
        "RETURN_USER",
        "RETURN_GROUP",
        "RETURN_EXTENSION",
        "RETURN_FOREIGN_DATA_WRAPPER",
        "RETURN_FOREIGN_SERVER",
        "RETURN_USER_MAPPING",
        "RETURN_PUBLICATION",
        "RETURN_SUBSCRIPTION",
        "RETURN_STATISTICS",
        "RETURN_POLICY",
        "RETURN_RULE",
        "RETURN_TRIGGER",
        "RETURN_CONSTRAINT",
        "RETURN_INDEX",
        "RETURN_SEQUENCE",
        "RETURN_VIEW",
        "RETURN_MATERIALIZED_VIEW",
        "RETURN_TABLE",
        "RETURN_PARTITIONED_TABLE",
        "RETURN_PARTITION",
        "RETURN_COLUMN",
        "RETURN_ATTRIBUTE",
        "RETURN_PARAMETER",
        "RETURN_ARGUMENT",
    }

    @given(operator=st.sampled_from(list(VALID_OPERATORS)))
    @settings(max_examples=50)
    def test_valid_operators_accepted(self, operator: str):
        """Valid operators must be accepted."""
        # Should not raise
        request = ThresholdCreateRequest(
            check_id=1,
            metric_name="cpu_usage",
            comparison_operator=operator,
        )
        assert request.comparison_operator == operator

    @given(operator=st.sampled_from(list(INVALID_OPERATORS)[:50]))  # Limit to 50
    @settings(max_examples=50)
    def test_invalid_operators_rejected(self, operator: str):
        """Invalid operators must be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ThresholdCreateRequest(
                check_id=1,
                metric_name="cpu_usage",
                comparison_operator=operator,
            )

        error_str = str(exc_info.value)
        assert "comparison_operator" in error_str.lower() or "operator" in error_str.lower()

    @given(
        operator=st.text(
            alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()",
            min_size=1,
            max_size=10,
        )
    )
    @settings(max_examples=100)
    def test_random_operators_either_accepted_or_rejected(self, operator: str):
        """Random operators must either be accepted (if valid) or rejected."""
        try:
            request = ThresholdCreateRequest(
                check_id=1,
                metric_name="cpu_usage",
                comparison_operator=operator,
            )
            # If it succeeded, the operator must be valid
            assert operator in self.VALID_OPERATORS
        except ValidationError:
            # If it failed, the operator must be invalid
            assert operator not in self.VALID_OPERATORS
