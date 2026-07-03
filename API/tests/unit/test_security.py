"""
Unit tests for api/app/core/security.py

Covers:
  - JWT creation and round-trip decoding
  - Expired token raises ExpiredSignatureError
  - Invalid token raises JWTError
  - Password hashing is one-way and verifiable
  - Salting: two hashes of the same plaintext differ
  - Wrong password returns False from verify_password
"""

from __future__ import annotations

import os
import time

import pytest

# Set required env vars before importing settings-dependent modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY", "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
)
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

from jose import ExpiredSignatureError, JWTError  # noqa: E402

from app.core.security import (  # noqa: E402
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


# ---------------------------------------------------------------------------
# JWT tests
# ---------------------------------------------------------------------------


class TestCreateAndDecodeToken:
    def test_round_trip_returns_correct_claims(self):
        token = create_access_token("user-42", "admin", 3600)
        claims = decode_token(token)
        assert claims["sub"] == "user-42"
        assert claims["role"] == "admin"

    def test_iat_and_exp_are_set(self):
        before = int(time.time())
        token = create_access_token("u1", "viewer", 60)
        claims = decode_token(token)
        after = int(time.time())
        assert before <= claims["iat"] <= after
        assert claims["exp"] == claims["iat"] + 60

    def test_viewer_role_preserved(self):
        token = create_access_token("u2", "viewer", 300)
        claims = decode_token(token)
        assert claims["role"] == "viewer"

    def test_returns_dict(self):
        token = create_access_token("u3", "admin", 3600)
        result = decode_token(token)
        assert isinstance(result, dict)


class TestExpiredToken:
    def test_expired_token_raises_expired_signature_error(self):
        # expiry_seconds=-1 creates a token already in the past
        token = create_access_token("u4", "admin", -1)
        with pytest.raises(ExpiredSignatureError):
            decode_token(token)


class TestInvalidToken:
    def test_garbage_token_raises_jwt_error(self):
        with pytest.raises(JWTError):
            decode_token("not.a.valid.token")

    def test_tampered_token_raises_jwt_error(self):
        token = create_access_token("u5", "admin", 3600)
        # Flip the last character to corrupt the signature
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        with pytest.raises(JWTError):
            decode_token(tampered)


# ---------------------------------------------------------------------------
# Password hashing tests
# ---------------------------------------------------------------------------


class TestHashPassword:
    def test_hash_differs_from_plaintext(self):
        hashed = hash_password("secret123")
        assert hashed != "secret123"

    def test_hash_is_non_empty(self):
        hashed = hash_password("x")
        assert hashed and len(hashed) > 0

    def test_two_hashes_of_same_password_differ(self):
        """bcrypt uses a random salt, so two hashes must never be equal."""
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2

    def test_hash_starts_with_bcrypt_prefix(self):
        hashed = hash_password("test")
        # bcrypt hashes always start with $2b$ (or $2a$)
        assert hashed.startswith("$2")


class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", hashed) is True

    def test_wrong_password_returns_false(self):
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("wrong-password", hashed) is False

    def test_empty_password_does_not_match_non_empty_hash(self):
        hashed = hash_password("nonempty")
        assert verify_password("", hashed) is False

    def test_verify_is_consistent_across_calls(self):
        hashed = hash_password("consistent")
        assert verify_password("consistent", hashed) is True
        assert verify_password("consistent", hashed) is True
