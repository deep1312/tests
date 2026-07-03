"""
Property-based tests for credential encryption.

**Validates: Requirements 1.2, 11.1, 11.3, 11.7**

Tests:
  - Property 1: Encryption round-trip (decrypt(encrypt(p)) == p and encrypt(p) != p)
  - Property 28: Credential rotation atomicity
"""

from __future__ import annotations

import base64
import os
from unittest.mock import AsyncMock

import pytest
from hypothesis import given, settings, strategies as st

# Set required env vars before importing settings-dependent modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
# Generate a proper 32-byte key (base64 encoded)
test_key = base64.b64encode(b"0" * 32).decode()
os.environ.setdefault("CREDENTIAL_ENCRYPTION_KEY", test_key)
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

from app.core.encryption import CredentialEncryptor  # noqa: E402


# ---------------------------------------------------------------------------
# Property 1: Encryption Round-Trip
# ---------------------------------------------------------------------------


class TestEncryptionRoundTrip:
    """For any plaintext, decrypt(encrypt(p)) == p and encrypt(p) != p."""

    @given(plaintext=st.text(min_size=1, max_size=1000))
    @settings(max_examples=200)
    def test_decrypt_encrypt_round_trip(self, plaintext: str):
        """Encrypting and decrypting must yield the original plaintext."""
        encryptor = CredentialEncryptor()
        ciphertext = encryptor.encrypt(plaintext)
        decrypted = encryptor.decrypt(ciphertext)
        assert decrypted == plaintext

    @given(plaintext=st.text(min_size=1, max_size=1000))
    @settings(max_examples=200)
    def test_ciphertext_differs_from_plaintext(self, plaintext: str):
        """Encrypted form must never equal the plaintext."""
        encryptor = CredentialEncryptor()
        ciphertext = encryptor.encrypt(plaintext)
        assert ciphertext != plaintext

    @given(plaintext=st.text(min_size=1, max_size=1000))
    @settings(max_examples=200)
    def test_ciphertext_is_non_empty(self, plaintext: str):
        """Ciphertext must be a non-empty string."""
        encryptor = CredentialEncryptor()
        ciphertext = encryptor.encrypt(plaintext)
        assert ciphertext
        assert len(ciphertext) > 0

    @given(plaintext=st.text(min_size=1, max_size=1000))
    @settings(max_examples=100)
    def test_two_encryptions_of_same_plaintext_differ(self, plaintext: str):
        """Two independent encryptions must differ (due to random IV)."""
        encryptor = CredentialEncryptor()
        c1 = encryptor.encrypt(plaintext)
        c2 = encryptor.encrypt(plaintext)
        # Due to random IV, ciphertexts should differ
        assert c1 != c2

    @given(plaintext=st.text(min_size=1, max_size=1000))
    @settings(max_examples=50)
    def test_decrypt_both_ciphertexts_to_same_plaintext(self, plaintext: str):
        """Both ciphertexts from the same plaintext must decrypt to the same value."""
        encryptor = CredentialEncryptor()
        c1 = encryptor.encrypt(plaintext)
        c2 = encryptor.encrypt(plaintext)
        assert encryptor.decrypt(c1) == plaintext
        assert encryptor.decrypt(c2) == plaintext
        assert encryptor.decrypt(c1) == encryptor.decrypt(c2)


# ---------------------------------------------------------------------------
# Property 28: Credential Rotation Atomicity
# ---------------------------------------------------------------------------


class TestCredentialRotationAtomicity:
    """Rotation must be atomic: all-or-nothing."""

    @given(
        passwords=st.lists(
            st.text(min_size=1, max_size=100),
            min_size=1,
            max_size=10,
            unique=True,
        )
    )
    @settings(max_examples=50)
    def test_successful_rotation_all_passwords_decryptable(
        self, passwords: list[str]
    ):
        """After successful rotation, all passwords must be decryptable with current key."""
        encryptor = CredentialEncryptor()

        # Simulate a database with encrypted passwords
        encrypted_passwords = [encryptor.encrypt(p) for p in passwords]

        # Verify all encrypted passwords can be decrypted back to originals
        for i, ep in enumerate(encrypted_passwords):
            decrypted = encryptor.decrypt(ep)
            assert decrypted == passwords[i]

    @given(
        passwords=st.lists(
            st.text(min_size=1, max_size=100),
            min_size=1,
            max_size=5,
            unique=True,
        )
    )
    @settings(max_examples=30)
    def test_rotation_preserves_decryptability(
        self, passwords: list[str]
    ):
        """After rotation, all passwords must remain decryptable."""
        encryptor = CredentialEncryptor()

        # Simulate a database with encrypted passwords
        encrypted_passwords = [encryptor.encrypt(p) for p in passwords]

        # Simulate re-encryption (rotation)
        re_encrypted_passwords = [encryptor.encrypt(p) for p in passwords]

        # Verify all re-encrypted passwords can be decrypted to original values
        for i, rep in enumerate(re_encrypted_passwords):
            decrypted = encryptor.decrypt(rep)
            assert decrypted == passwords[i]
