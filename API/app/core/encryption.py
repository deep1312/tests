"""
AES-256-GCM credential encryptor.

Key is loaded from the ``CREDENTIAL_ENCRYPTION_KEY`` environment variable,
which must be a base64-encoded 32-byte (256-bit) key.

Ciphertext storage format
-------------------------
The on-disk / in-database representation is::

    base64( iv (12 bytes) + tag (16 bytes) + ciphertext )

``AESGCM.encrypt()`` returns ``ciphertext + tag`` concatenated, so the
split on decryption is:

    raw = base64_decode(stored)
    iv            = raw[:12]
    ciphertext_with_tag = raw[12:]          # AESGCM.decrypt() expects this
    # tag is the last 16 bytes of ciphertext_with_tag, but we store it as
    # iv + tag + ciphertext for clarity; see _pack / _unpack helpers.

Req 11.1, 11.3, 11.4
"""

from __future__ import annotations

import base64
import logging
import os
import secrets
from typing import TYPE_CHECKING

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)

_IV_LEN = 12   # bytes — 96-bit nonce recommended for AES-GCM
_TAG_LEN = 16  # bytes — 128-bit authentication tag


class CredentialEncryptor:
    """
    Encrypt and decrypt server passwords using AES-256-GCM.

    Parameters
    ----------
    key_b64:
        Optional base64-encoded 32-byte key.  When *None* (default) the key
        is read from the ``CREDENTIAL_ENCRYPTION_KEY`` environment variable.

    Raises
    ------
    ValueError
        If the key is absent, cannot be base64-decoded, or is not exactly
        32 bytes after decoding.
    """

    def __init__(self, key_b64: str | None = None) -> None:
        raw_key = key_b64 or os.environ.get("CREDENTIAL_ENCRYPTION_KEY", "")
        if not raw_key or not raw_key.strip():
            raise ValueError(
                "CREDENTIAL_ENCRYPTION_KEY is not set. "
                "Provide a base64-encoded 32-byte key."
            )
        try:
            key_bytes = base64.b64decode(raw_key)
        except Exception as exc:
            raise ValueError(
                "CREDENTIAL_ENCRYPTION_KEY is not valid base64."
            ) from exc

        if len(key_bytes) != 32:
            raise ValueError(
                f"CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes "
                f"(got {len(key_bytes)})."
            )

        self._aesgcm = AESGCM(key_bytes)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt *plaintext* and return a base64-encoded ciphertext string.

        The returned string encodes ``iv (12 B) + tag (16 B) + ciphertext``
        so that the storage format is self-contained.

        Req 11.1
        """
        iv = secrets.token_bytes(_IV_LEN)
        # AESGCM.encrypt() returns ciphertext_bytes + tag (tag appended)
        ct_with_tag: bytes = self._aesgcm.encrypt(iv, plaintext.encode(), None)
        # ct_with_tag layout: ciphertext || tag (last 16 bytes)
        ciphertext = ct_with_tag[:-_TAG_LEN]
        tag = ct_with_tag[-_TAG_LEN:]
        packed = iv + tag + ciphertext
        return base64.b64encode(packed).decode()

    def decrypt(self, ciphertext_b64: str) -> str:
        """
        Decrypt a base64-encoded ciphertext string produced by :meth:`encrypt`.

        Req 11.1
        """
        try:
            raw = base64.b64decode(ciphertext_b64)
        except Exception as exc:
            raise ValueError("Ciphertext is not valid base64.") from exc

        if len(raw) < _IV_LEN + _TAG_LEN:
            raise ValueError(
                f"Ciphertext too short: expected at least "
                f"{_IV_LEN + _TAG_LEN} bytes, got {len(raw)}."
            )

        iv = raw[:_IV_LEN]
        tag = raw[_IV_LEN : _IV_LEN + _TAG_LEN]
        ciphertext = raw[_IV_LEN + _TAG_LEN :]
        # AESGCM.decrypt() expects ciphertext || tag
        ct_with_tag = ciphertext + tag
        plaintext_bytes = self._aesgcm.decrypt(iv, ct_with_tag, None)
        return plaintext_bytes.decode()

    async def rotate_all(self, conn: "asyncpg.Connection") -> int:
        """
        Re-encrypt every server password with the current key.

        Fetches all rows from ``config.servers`` where
        ``password_encrypted IS NOT NULL``, decrypts each with the current
        key, re-encrypts, and writes the new ciphertext back — all inside a
        single transaction.

        Returns the number of rows re-encrypted.

        Req 11.3, 11.7
        """
        async with conn.transaction():
            rows = await conn.fetch(
                "SELECT server_id, password_encrypted "
                "FROM config.servers "
                "WHERE password_encrypted IS NOT NULL"
            )
            count = 0
            for row in rows:
                plaintext = self.decrypt(row["password_encrypted"])
                new_ciphertext = self.encrypt(plaintext)
                await conn.execute(
                    "UPDATE config.servers "
                    "SET password_encrypted = $1 "
                    "WHERE server_id = $2",
                    new_ciphertext,
                    row["server_id"],
                )
                count += 1

        logger.info("Credential rotation complete: %d records re-encrypted.", count)
        return count
