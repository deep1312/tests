"""
Pytest configuration for property-based tests.

Sets up environment variables and fixtures for property tests.
"""

import base64
import os
from unittest.mock import AsyncMock, MagicMock, patch

# Set required env vars before any imports
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
# Generate a proper 32-byte key (base64 encoded)
test_key = base64.b64encode(b"0" * 32).decode()
os.environ.setdefault("CREDENTIAL_ENCRYPTION_KEY", test_key)
os.environ.setdefault("JWT_SECRET", "unit-test-secret")
os.environ.setdefault("JWT_EXPIRY_SECONDS", "3600")
os.environ.setdefault("CONNECTION_VALIDATION_MODE", "warn")
os.environ.setdefault("STALENESS_THRESHOLD_SECS", "300")
os.environ.setdefault("RATE_LIMIT_RPM", "1000")
os.environ.setdefault("DB_STATEMENT_TIMEOUT_MS", "30000")
os.environ.setdefault("HIGH_COST_DAYS_THRESHOLD", "7")

# Mock asyncpg.create_pool to prevent database connection attempts during tests
import asyncpg

original_create_pool = asyncpg.create_pool

async def mock_create_pool(*args, **kwargs):
    """Mock asyncpg.create_pool to return a mock pool."""
    mock_pool = AsyncMock()
    mock_pool.acquire = AsyncMock()
    mock_pool.release = AsyncMock()
    mock_pool.close = AsyncMock()
    mock_pool.execute = AsyncMock()
    mock_pool.fetch = AsyncMock()
    mock_pool.fetchrow = AsyncMock()
    return mock_pool

# Patch asyncpg.create_pool before any app imports
asyncpg.create_pool = mock_create_pool
