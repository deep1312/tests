import logging
import re
import os
import base64
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

_IV_LEN = 12
_TAG_LEN = 16


def _decrypt_password(ciphertext_b64: str, key_b64: str) -> str:
    """Decrypt a base64-encoded AES-256-GCM encrypted password."""
    key_bytes = base64.b64decode(key_b64)
    aesgcm = AESGCM(key_bytes)
    raw = base64.b64decode(ciphertext_b64)
    iv = raw[:_IV_LEN]
    tag = raw[_IV_LEN : _IV_LEN + _TAG_LEN]
    ciphertext = raw[_IV_LEN + _TAG_LEN :]
    ct_with_tag = ciphertext + tag
    return aesgcm.decrypt(iv, ct_with_tag, None).decode()


def execute_check_query(check: Dict[str, Any], encryption_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Execute check query_text on target postgres server and return rows.
    """
    timeout_ms = check.get("timeout_ms") or 5000
    if encryption_key is None:
        encryption_key = os.environ.get("CREDENTIAL_ENCRYPTION_KEY", "")
    if not encryption_key:
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY is not configured")

    password = _decrypt_password(check["password_encrypted"], encryption_key)

    conn = None
    try:
        conn = psycopg2.connect(
            host=check["server_ip"],
            port=check["port"],
            dbname=check["db_name"],
            user=check["username"],
            password=password,
            connect_timeout=5,
            sslmode=check.get("ssl_mode") or "prefer",
        )
        conn.autocommit = True
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SET statement_timeout = {int(timeout_ms)};")
            cur.execute(check["query_text"])
            if cur.description:
                return [dict(row) for row in cur.fetchall()]
            return []
    except Exception as exc:
        logger.exception(
            "Check execution failed for server_id=%s check_id=%s",
            check.get("server_id"),
            check.get("check_id"),
        )
        raise RuntimeError(str(exc)) from exc
    finally:
        if conn:
            conn.close()


def evaluate_threshold(observed_value: Any, operator: str, expected_value: Any) -> bool:
    if observed_value is None or expected_value is None:
        return False
    if operator == ">":
        return float(observed_value) > float(expected_value)
    if operator == "<":
        return float(observed_value) < float(expected_value)
    if operator == "=":
        return str(observed_value) == str(expected_value)
    if operator == "!=":
        return str(observed_value) != str(expected_value)
    if operator == "~":
        return re.search(str(expected_value), str(observed_value)) is not None
    return False
