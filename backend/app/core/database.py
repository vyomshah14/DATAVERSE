"""
Centralized PostgreSQL Database & Connection Pool Manager for DATAVERSE.
Manages connection lifecycle, asyncpg pooling, and transaction-scoped RLS security context.
"""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional, Dict, Any
import asyncpg
from fastapi import HTTPException, status

from backend.app.core.config import settings
from backend.app.schemas.auth import AuthenticatedUser


class DatabaseConfigurationError(Exception):
    """Raised when the database connection string is missing or invalid."""

    pass


class DatabaseConnectionError(Exception):
    """Raised when database connection or query execution fails."""

    pass


class DatabaseUnavailableException(HTTPException):
    """HTTP 503 exception returned when database infrastructure is inaccessible."""

    def __init__(
        self,
        detail: str = "Database service is temporarily unavailable. Please retry shortly.",
    ):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


def validate_database_url(url: Optional[str] = None) -> str:
    """
    Validates and normalizes DATABASE_URL from configuration.
    Fails safely without leaking credentials if the URL is missing or contains placeholders.
    """
    raw_url = settings.DATABASE_URL if url is None else url
    if not raw_url or not isinstance(raw_url, str) or not raw_url.strip():
        raise DatabaseConfigurationError(
            "DATABASE_URL is not configured. Real PostgreSQL connection string required."
        )

    clean_url = raw_url.strip()

    # Reject placeholders
    placeholders = ["your-project-id", "your-db-password", "placeholder"]
    if any(p in clean_url for p in placeholders):
        raise DatabaseConfigurationError(
            "DATABASE_URL contains template placeholder values. Real credentials required."
        )

    # Normalize SQLAlchemy or alternate scheme to standard postgresql://
    if clean_url.startswith("postgresql+asyncpg://"):
        clean_url = "postgresql://" + clean_url[len("postgresql+asyncpg://") :]
    elif clean_url.startswith("postgres://"):
        clean_url = "postgresql://" + clean_url[len("postgres://") :]

    return clean_url


async def _init_connection_codecs(conn: asyncpg.Connection) -> None:
    """Configures JSONB automatic serialization and deserialization on asyncpg connections."""
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


class DatabaseManager:
    """
    Thread-safe connection pool manager for PostgreSQL.
    Provides async connection pooling and transaction-local identity scoping for RLS.
    """

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._lock = asyncio.Lock()

    @property
    def is_initialized(self) -> bool:
        """Returns True if the connection pool is active."""
        return self._pool is not None and not self._pool._closed

    async def initialize(self, database_url: Optional[str] = None) -> asyncpg.Pool:
        """
        Initializes the asyncpg connection pool using validated DATABASE_URL.
        Idempotent if the pool is already initialized.
        """
        async with self._lock:
            if self._pool is not None and not self._pool._closed:
                return self._pool

            validated_url = validate_database_url(database_url)

            try:
                self._pool = await asyncpg.create_pool(
                    dsn=validated_url,
                    min_size=settings.DB_POOL_MIN_SIZE,
                    max_size=settings.DB_POOL_MAX_SIZE,
                    max_inactive_connection_lifetime=settings.DB_POOL_MAX_LIFETIME,
                    command_timeout=settings.DB_COMMAND_TIMEOUT,
                    init=_init_connection_codecs,
                )
            except Exception as exc:
                raise DatabaseConnectionError(
                    "Failed to establish connection pool to PostgreSQL server."
                ) from exc

            return self._pool

    async def close(self) -> None:
        """Gracefully terminates all pooled connections upon application shutdown."""
        async with self._lock:
            if self._pool is not None:
                await self._pool.close()
                self._pool = None

    async def get_pool(self) -> asyncpg.Pool:
        """Retrieves the active pool or lazily initializes it."""
        if self._pool is None or self._pool._closed:
            return await self.initialize()
        return self._pool

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[asyncpg.Connection]:
        """Acquires a single connection from the pool."""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            yield conn

    @asynccontextmanager
    async def transaction(
        self,
        user: Optional[AuthenticatedUser] = None,
        switch_role: bool = True,
    ) -> AsyncIterator[asyncpg.Connection]:
        """
        Acquires a pooled connection and opens a transaction.
        If an AuthenticatedUser is provided, injects transaction-local settings
        (request.jwt.claim.sub, request.jwt.claim.role, request.jwt.claims)
        using 'is_local = true' to enforce PostgreSQL RLS policies without connection leaks.
        Transitions the transaction role via 'SET LOCAL ROLE authenticated' to prevent
        relying on the connection's default role or BYPASSRLS privileges.
        Automatically rolls back on exceptions and commits on successful exit.
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                if user is not None:
                    user_sub = str(user.id)
                    user_role = user.role or "authenticated"
                    claims_json = json.dumps(
                        {
                            "sub": user_sub,
                            "role": user_role,
                            "email": user.email or "",
                            "app_metadata": user.app_metadata,
                            "user_metadata": user.user_metadata,
                        }
                    )

                    # Transaction-local parameter setting (is_local = true)
                    # Guaranteed by PostgreSQL to reset automatically upon COMMIT or ROLLBACK.
                    await conn.execute(
                        "SELECT set_config('request.jwt.claim.sub', $1, true)", user_sub
                    )
                    await conn.execute(
                        "SELECT set_config('request.jwt.claim.role', $1, true)", user_role
                    )
                    await conn.execute(
                        "SELECT set_config('request.jwt.claims', $1, true)", claims_json
                    )

                    if switch_role:
                        safe_role = (
                            user_role
                            if user_role in {"authenticated", "anon"}
                            else "authenticated"
                        )
                        try:
                            await conn.execute(f"SET LOCAL ROLE {safe_role}")
                        except Exception:
                            # Gracefully continue if role is not installed in local environment
                            pass

                yield conn


# Central database manager singleton instance
db_manager = DatabaseManager()
