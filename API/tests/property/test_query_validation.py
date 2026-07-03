"""
Property-based tests for query validation.

**Validates: Requirements 2.11**

Tests:
  - Property 12: DML/DDL keywords are rejected in query_text
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st
from pydantic import ValidationError

from app.models.requests.check import CheckCreateRequest  # noqa: E402


# ---------------------------------------------------------------------------
# Property 12: DML/DDL Keywords Are Rejected in query_text
# ---------------------------------------------------------------------------


class TestQueryValidation:
    """DML/DDL keywords must be rejected; clean queries accepted."""

    FORBIDDEN_KEYWORDS = {
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "ALTER",
        "DROP",
        "CREATE",
        "GRANT",
        "REVOKE",
    }

    @given(keyword=st.sampled_from(list(FORBIDDEN_KEYWORDS)))
    @settings(max_examples=100)
    def test_forbidden_keywords_rejected(self, keyword: str):
        """Forbidden keywords must be rejected."""
        query_text = f"SELECT * FROM table WHERE id = 1; {keyword} table SET x = 1;"

        with pytest.raises(ValidationError) as exc_info:
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text=query_text,
            )

        error_str = str(exc_info.value)
        assert "query" in error_str.lower() or "dml" in error_str.lower() or "ddl" in error_str.lower()

    @given(keyword=st.sampled_from(list(FORBIDDEN_KEYWORDS)))
    @settings(max_examples=100)
    def test_forbidden_keywords_case_insensitive(self, keyword: str):
        """Forbidden keywords must be rejected case-insensitively."""
        query_text = f"SELECT * FROM table WHERE id = 1; {keyword.lower()} table SET x = 1;"

        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text=query_text,
            )

    @given(
        query_text=st.text(
            alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n\t",
            min_size=1,
            max_size=200,
        )
    )
    @settings(max_examples=100)
    def test_clean_queries_accepted(self, query_text: str):
        """Queries without forbidden keywords must be accepted."""
        # Skip if query contains forbidden keywords
        for keyword in self.FORBIDDEN_KEYWORDS:
            if keyword.lower() in query_text.lower():
                pytest.skip(f"Query contains forbidden keyword: {keyword}")

        # Should not raise
        request = CheckCreateRequest(
            check_code="test-check",
            category="performance",
            check_name="Test Check",
            query_text=query_text,
        )
        assert request.query_text == query_text

    def test_select_query_accepted(self):
        """Simple SELECT query must be accepted."""
        request = CheckCreateRequest(
            check_code="test-check",
            category="performance",
            check_name="Test Check",
            query_text="SELECT * FROM pg_stat_statements LIMIT 10;",
        )
        assert request.query_text == "SELECT * FROM pg_stat_statements LIMIT 10;"

    def test_select_with_join_accepted(self):
        """SELECT with JOIN must be accepted."""
        request = CheckCreateRequest(
            check_code="test-check",
            category="performance",
            check_name="Test Check",
            query_text="SELECT a.id, b.name FROM table_a a JOIN table_b b ON a.id = b.id;",
        )
        assert "JOIN" in request.query_text

    def test_select_with_subquery_accepted(self):
        """SELECT with subquery must be accepted."""
        request = CheckCreateRequest(
            check_code="test-check",
            category="performance",
            check_name="Test Check",
            query_text="SELECT * FROM (SELECT id FROM table WHERE active = true) AS t;",
        )
        assert "SELECT" in request.query_text

    def test_insert_rejected(self):
        """INSERT query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="INSERT INTO table (id, name) VALUES (1, 'test');",
            )

    def test_update_rejected(self):
        """UPDATE query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="UPDATE table SET name = 'new' WHERE id = 1;",
            )

    def test_delete_rejected(self):
        """DELETE query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="DELETE FROM table WHERE id = 1;",
            )

    def test_truncate_rejected(self):
        """TRUNCATE query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="TRUNCATE table;",
            )

    def test_alter_rejected(self):
        """ALTER query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="ALTER TABLE table ADD COLUMN new_col INT;",
            )

    def test_drop_rejected(self):
        """DROP query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="DROP TABLE table;",
            )

    def test_create_rejected(self):
        """CREATE query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="CREATE TABLE new_table (id INT);",
            )

    def test_grant_rejected(self):
        """GRANT query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="GRANT SELECT ON table TO user;",
            )

    def test_revoke_rejected(self):
        """REVOKE query must be rejected."""
        with pytest.raises(ValidationError):
            CheckCreateRequest(
                check_code="test-check",
                category="performance",
                check_name="Test Check",
                query_text="REVOKE SELECT ON table FROM user;",
            )

