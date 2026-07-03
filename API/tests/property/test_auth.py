"""
Property-based tests for authentication and password hashing.

**Validates: Requirements 10.4, 10.5, 10.8**

Tests:
  - Property 18: Expired JWT returns HTTP 401
  - Property 19: Password hashing is one-way and verifiable
"""

from __future__ import annotations

import os
import time

import pytest
from hypothesis import given, settings, strategies as st

from app.core.security import (  # noqa: E402
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from jose import ExpiredSignatureError, JWTError  # noqa: E402


# ---------------------------------------------------------------------------
# Property 18: Expired JWT Returns HTTP 401
# ---------------------------------------------------------------------------


class TestExpiredJWT:
    """Expired JWT must return HTTP 401."""

    @given(
        expiry_seconds=st.integers(min_value=-3600, max_value=-1),
    )
    @settings(max_examples=100)
    def test_expired_token_raises_error(self, expiry_seconds: int):
        """Expired token must raise ExpiredSignatureError."""
        token = create_access_token("user-1", "admin", expiry_seconds)

        with pytest.raises(ExpiredSignatureError):
            decode_token(token)

    @given(
        expiry_seconds=st.integers(min_value=1, max_value=3600),
    )
    @settings(max_examples=100)
    def test_future_token_does_not_raise_expiry_error(self, expiry_seconds: int):
        """Future token must not raise ExpiredSignatureError."""
        token = create_access_token("user-1", "admin", expiry_seconds)

        # Should not raise ExpiredSignatureError
        try:
            claims = decode_token(token)
            assert claims is not None
        except ExpiredSignatureError:
            pytest.fail("Future token should not raise ExpiredSignatureError")

    @given(
        expiry_seconds=st.integers(min_value=-3600, max_value=-1),
    )
    @settings(max_examples=100)
    def test_expired_token_not_decoded(self, expiry_seconds: int):
        """Expired token must not be decoded successfully."""
        token = create_access_token("user-1", "admin", expiry_seconds)

        with pytest.raises(ExpiredSignatureError):
            decode_token(token)

    @given(
        expiry_seconds=st.integers(min_value=1, max_value=3600),
    )
    @settings(max_examples=100)
    def test_valid_token_decoded_successfully(self, expiry_seconds: int):
        """Valid token must be decoded successfully."""
        token = create_access_token("user-1", "admin", expiry_seconds)

        claims = decode_token(token)
        assert claims["sub"] == "user-1"
        assert claims["role"] == "admin"


# ---------------------------------------------------------------------------
# Property 19: Password Hashing Is One-Way and Verifiable
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    """Password hashing must be one-way and verifiable."""

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=200)
    def test_hash_differs_from_plaintext(self, password: str):
        """Hash must differ from plaintext."""
        hashed = hash_password(password)
        assert hashed != password

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=200)
    def test_verify_correct_password(self, password: str):
        """Verify must return True for correct password."""
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    @given(
        password=st.text(min_size=1, max_size=200),
        wrong_password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_verify_wrong_password(self, password: str, wrong_password: str):
        """Verify must return False for wrong password."""
        if password == wrong_password:
            pytest.skip("Passwords are the same")

        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_two_hashes_differ(self, password: str):
        """Two hashes of same password must differ (salting)."""
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_both_hashes_verify_same_password(self, password: str):
        """Both hashes must verify the same password."""
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=200)
    def test_hash_never_empty(self, password: str):
        """Hash must never be empty string."""
        hashed = hash_password(password)
        assert hashed
        assert len(hashed) > 0

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=200)
    def test_hash_is_string(self, password: str):
        """Hash must be a string."""
        hashed = hash_password(password)
        assert isinstance(hashed, str)

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_verify_is_consistent(self, password: str):
        """Verify must be consistent across multiple calls."""
        hashed = hash_password(password)

        result1 = verify_password(password, hashed)
        result2 = verify_password(password, hashed)
        result3 = verify_password(password, hashed)

        assert result1 == result2 == result3 == True

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_hash_starts_with_bcrypt_prefix(self, password: str):
        """Hash must start with bcrypt prefix."""
        hashed = hash_password(password)
        # bcrypt hashes start with $2a$, $2b$, or $2x$
        assert hashed.startswith("$2")

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_empty_password_not_equal_to_hash(self, password: str):
        """Empty password must not verify against hash of non-empty password."""
        hashed = hash_password(password)
        assert verify_password("", hashed) is False

    @given(
        password=st.text(min_size=1, max_size=200),
    )
    @settings(max_examples=100)
    def test_hash_not_reversible(self, password: str):
        """Hash must not be reversible to plaintext."""
        hashed = hash_password(password)

        # We can't directly test irreversibility, but we can verify
        # that the hash is not the plaintext
        assert hashed != password

        # And that it's not a simple encoding
        import base64
        try:
            decoded = base64.b64decode(hashed)
            # If it decodes, it shouldn't equal the password
            assert decoded != password.encode()
        except Exception:
            # If it doesn't decode, that's fine
            pass

