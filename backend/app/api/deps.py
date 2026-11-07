"""
FastAPI Authentication Dependencies for DATAVERSE.
Extracts Bearer tokens and resolves verified operator identities.
"""

from typing import Optional, AsyncIterator
import asyncpg
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.app.core.security import (
    default_jwks_client,
    JWKSClient,
    AuthenticationException,
)
from backend.app.core.database import (
    db_manager,
    DatabaseManager,
    DatabaseConfigurationError,
    DatabaseConnectionError,
    DatabaseUnavailableException,
)
from backend.app.schemas.auth import AuthenticatedUser
from backend.app.repositories.workspace import WorkspaceRepository
from backend.app.repositories.datacenter import DataCenterRepository

# Security scheme configured to not raise automatic errors, allowing custom 401 handling
bearer_scheme = HTTPBearer(auto_error=False)


def get_jwks_client() -> JWKSClient:
    """Dependency provider for the JWKS verification client; enables test overrides."""
    return default_jwks_client


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    jwks_client: JWKSClient = Depends(get_jwks_client),
) -> AuthenticatedUser:
    """
    Validates Bearer token from the HTTP Authorization header and returns
    the verified AuthenticatedUser identity model.
    Raises HTTP 401 on missing or invalid tokens, or HTTP 503 on JWKS outage.
    """
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise AuthenticationException("Authentication credentials were not provided.")

    if (
        credentials is None
        or not credentials.credentials
        or credentials.scheme.lower() != "bearer"
    ):
        raise AuthenticationException("Invalid authentication scheme; Bearer token required.")

    return await jwks_client.verify_jwt(credentials.credentials)


# Alias dependency for explicit route requirements
require_authenticated_user = get_current_user


def get_db_manager() -> DatabaseManager:
    """Dependency provider for DatabaseManager singleton; enables test overrides."""
    return db_manager


async def get_db_connection(
    manager: DatabaseManager = Depends(get_db_manager),
) -> AsyncIterator[asyncpg.Connection]:
    """
    Provides a raw pooled database connection.
    Closes and returns connection to pool upon generator exit.
    """
    try:
        async with manager.connection() as conn:
            yield conn
    except (DatabaseConfigurationError, DatabaseConnectionError) as exc:
        raise DatabaseUnavailableException(str(exc)) from exc


async def get_db_transaction(
    user: AuthenticatedUser = Depends(get_current_user),
    manager: DatabaseManager = Depends(get_db_manager),
) -> AsyncIterator[asyncpg.Connection]:
    """
    Provides an active transaction-scoped connection with authenticated user claims
    injected via transaction-local PostgreSQL settings (is_local = true).
    Commits on successful completion, rolls back on exception, and cleans up context.
    """
    try:
        async with manager.transaction(user=user) as conn:
            yield conn
    except (DatabaseConfigurationError, DatabaseConnectionError) as exc:
        raise DatabaseUnavailableException(str(exc)) from exc


async def get_workspace_repository(
    conn: asyncpg.Connection = Depends(get_db_transaction),
) -> WorkspaceRepository:
    """Provides a WorkspaceRepository bound to the current authenticated transaction."""
    return WorkspaceRepository(conn)


async def get_datacenter_repository(
    conn: asyncpg.Connection = Depends(get_db_transaction),
) -> DataCenterRepository:
    """Provides a DataCenterRepository bound to the current authenticated transaction."""
    return DataCenterRepository(conn)
