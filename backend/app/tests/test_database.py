"""
Test Suite for Database Connection & Transaction Management.
Validates URL checking, connection pooling, graceful lifecycle,
transaction commit/rollback, and user context isolation without connection leakage.
"""

import uuid
import pytest
import asyncpg
from unittest.mock import patch

from backend.app.core.database import (
    validate_database_url,
    DatabaseConfigurationError,
    DatabaseConnectionError,
    DatabaseManager,
)
from backend.app.schemas.auth import AuthenticatedUser

LOCAL_TEST_DB_URL = "postgresql://localhost/sandbox"


# ==============================================================================
# 1. Configuration & Validation Tests
# ==============================================================================

def test_validate_database_url_missing():
    """Verify DatabaseConfigurationError when DATABASE_URL is None or empty."""
    with pytest.raises(DatabaseConfigurationError, match="is not configured"):
        validate_database_url("")

    from backend.app.core.config import settings

    with patch.object(settings, "DATABASE_URL", ""):
        with pytest.raises(DatabaseConfigurationError, match="is not configured"):
            validate_database_url(None)


def test_validate_database_url_placeholder():
    """Verify DatabaseConfigurationError when DATABASE_URL contains template placeholders."""
    placeholders = [
        "postgresql://postgres:your-db-password@db.your-project-id.supabase.co:5432/postgres",
        "postgresql://postgres:placeholder@db.test.supabase.co:5432/postgres",
        "postgresql://user:pass@host/placeholder_db",
    ]
    for url in placeholders:
        with pytest.raises(DatabaseConfigurationError, match="contains template placeholder"):
            validate_database_url(url)


def test_validate_database_url_normalizes_schemes():
    """Verify scheme normalization to standard postgresql://."""
    url1 = "postgresql+asyncpg://user:pass@host:5432/db"
    assert validate_database_url(url1) == "postgresql://user:pass@host:5432/db"

    url2 = "postgres://user:pass@host:5432/db"
    assert validate_database_url(url2) == "postgresql://user:pass@host:5432/db"


@pytest.mark.asyncio
async def test_database_connection_failure():
    """Verify DatabaseConnectionError when host is unreachable."""
    manager = DatabaseManager()
    bad_url = "postgresql://user:pass@127.0.0.1:59999/nonexistent"
    with pytest.raises(DatabaseConnectionError):
        await manager.initialize(bad_url)
    assert not manager.is_initialized


# ==============================================================================
# 2. Local PostgreSQL Runtime & Transaction Tests
# ==============================================================================

async def check_local_postgres():
    """Helper to detect whether local PostgreSQL sandbox is reachable."""
    try:
        conn = await asyncpg.connect(LOCAL_TEST_DB_URL, timeout=1.0)
        await conn.close()
        return True
    except Exception:
        return False


@pytest.mark.asyncio
async def test_database_pool_lifecycle():
    """Verify successful pool initialization and graceful termination."""
    if not await check_local_postgres():
        pytest.skip("Local PostgreSQL sandbox is not accessible")

    manager = DatabaseManager()
    pool = await manager.initialize(LOCAL_TEST_DB_URL)
    assert manager.is_initialized
    assert pool is not None

    # Execute basic query
    async with manager.connection() as conn:
        val = await conn.fetchval("SELECT 100")
        assert val == 100

    await manager.close()
    assert not manager.is_initialized


@pytest.mark.asyncio
async def test_transaction_commit_and_rollback():
    """Verify atomic commit on success and automatic rollback upon exception."""
    if not await check_local_postgres():
        pytest.skip("Local PostgreSQL sandbox is not accessible")

    manager = DatabaseManager()
    await manager.initialize(LOCAL_TEST_DB_URL)

    try:
        # Create temporary table for test
        async with manager.connection() as conn:
            await conn.execute("CREATE TEMP TABLE test_txn (id int, val text);")

        # 1. Test Commit
        async with manager.transaction() as conn:
            await conn.execute("INSERT INTO test_txn VALUES (1, 'persisted');")

        async with manager.connection() as conn:
            count = await conn.fetchval("SELECT count(*) FROM test_txn WHERE id = 1;")
            assert count == 1

        # 2. Test Rollback on Exception
        with pytest.raises(RuntimeError):
            async with manager.transaction() as conn:
                await conn.execute("INSERT INTO test_txn VALUES (2, 'should_rollback');")
                raise RuntimeError("Forced simulation error")

        async with manager.connection() as conn:
            count = await conn.fetchval("SELECT count(*) FROM test_txn WHERE id = 2;")
            assert count == 0
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_authenticated_user_context_injection():
    """Verify transaction sets request.jwt.claim.sub and request.jwt.claim.role."""
    if not await check_local_postgres():
        pytest.skip("Local PostgreSQL sandbox is not accessible")

    manager = DatabaseManager()
    await manager.initialize(LOCAL_TEST_DB_URL)

    user_id = uuid.uuid4()
    test_user = AuthenticatedUser(
        id=user_id,
        email="operator.alpha@dataverse.io",
        role="authenticated",
        app_metadata={"provider": "email"},
        user_metadata={"name": "Operator Alpha"},
    )

    try:
        async with manager.transaction(user=test_user) as conn:
            sub = await conn.fetchval("SELECT current_setting('request.jwt.claim.sub', true);")
            role = await conn.fetchval("SELECT current_setting('request.jwt.claim.role', true);")
            assert sub == str(user_id)
            assert role == "authenticated"
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_user_context_isolation_between_requests():
    """
    CRITICAL SECURITY TEST:
    Verify that transaction-local user claims are completely wiped after COMMIT/ROLLBACK,
    preventing multi-tenant user identity leakage across pooled connections.
    """
    if not await check_local_postgres():
        pytest.skip("Local PostgreSQL sandbox is not accessible")

    manager = DatabaseManager()
    await manager.initialize(LOCAL_TEST_DB_URL)

    user_a_id = uuid.uuid4()
    user_a = AuthenticatedUser(id=user_a_id, role="authenticated")

    try:
        # Request A: Sets User A context
        async with manager.transaction(user=user_a) as conn:
            sub_a = await conn.fetchval("SELECT current_setting('request.jwt.claim.sub', true);")
            assert sub_a == str(user_a_id)

        # Request B: Next transaction on the pool with NO user (or unauthenticated request)
        async with manager.connection() as conn:
            sub_after = await conn.fetchval(
                "SELECT nullif(current_setting('request.jwt.claim.sub', true), '');"
            )
            # Must be strictly None! User A must not leak to subsequent requests
            assert sub_after is None
    finally:
        await manager.close()
