"""
Test Suite for Workspace & Data Center Repositories.
Validates multi-tenant ownership enforcement, cross-user isolation,
atomic updates, soft-delete semantics, and cascade operations.
"""

from pathlib import Path
import uuid
import pytest
import asyncpg

from backend.app.core.database import DatabaseManager
from backend.app.schemas.auth import AuthenticatedUser
from backend.app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate
from backend.app.schemas.datacenter import DataCenterCreate, DataCenterUpdate
from backend.app.repositories.workspace import WorkspaceRepository
from backend.app.repositories.datacenter import DataCenterRepository

LOCAL_TEST_DB_URL = "postgresql://localhost/sandbox"
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MIGRATION_FILE = PROJECT_ROOT / "migrations" / "0001_initial_schema.sql"


@pytest.fixture(autouse=True)
async def ensure_test_schema():
    """Applies the initial migration to the local test database once for repository tests."""
    try:
        conn = await asyncpg.connect(LOCAL_TEST_DB_URL, timeout=1.0)
    except Exception:
        pytest.skip("Local PostgreSQL sandbox is not accessible")
        return

    try:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS auth;")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE,
                created_at TIMESTAMPTZ DEFAULT now()
            );
            """
        )
        migration_sql = MIGRATION_FILE.read_text(encoding="utf-8")
        await conn.execute(migration_sql)
    finally:
        await conn.close()


@pytest.fixture
async def db_mgr():
    """Provides an initialized DatabaseManager connected to the local test database."""
    manager = DatabaseManager()
    await manager.initialize(LOCAL_TEST_DB_URL)
    yield manager
    await manager.close()


@pytest.fixture
async def user_a(db_mgr):
    """Provisions a mock User A in auth.users."""
    uid = uuid.uuid4()
    async with db_mgr.connection() as conn:
        await conn.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
            uid,
            f"user_a_{uid}@dataverse.io",
        )
    return AuthenticatedUser(id=uid, email=f"user_a_{uid}@dataverse.io", role="authenticated")


@pytest.fixture
async def user_b(db_mgr):
    """Provisions a distinct mock User B in auth.users."""
    uid = uuid.uuid4()
    async with db_mgr.connection() as conn:
        await conn.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
            uid,
            f"user_b_{uid}@dataverse.io",
        )
    return AuthenticatedUser(id=uid, email=f"user_b_{uid}@dataverse.io", role="authenticated")


# ==============================================================================
# Workspace Repository Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_create_and_ownership_isolation(db_mgr, user_a, user_b):
    """
    Verify that User A can create and fetch their workspace,
    while User B is strictly prevented from reading it.
    """
    async with db_mgr.transaction(user=user_a) as conn:
        repo_a = WorkspaceRepository(conn)
        ws_in = WorkspaceCreate(name="US-East Primary", description="Production cluster")
        workspace = await repo_a.create(ws_in, owner_id=user_a.id)

        assert workspace.id is not None
        assert workspace.owner_id == user_a.id
        assert workspace.name == "US-East Primary"
        assert workspace.description == "Production cluster"

        # User A can fetch their workspace
        fetched_a = await repo_a.get_by_id(workspace.id, owner_id=user_a.id)
        assert fetched_a is not None
        assert fetched_a.id == workspace.id

    # User B attempting to read User A's workspace in a distinct transaction
    async with db_mgr.transaction(user=user_b) as conn:
        repo_b = WorkspaceRepository(conn)
        fetched_b = await repo_b.get_by_id(workspace.id, owner_id=user_b.id)
        # Must return None! Cross-user reading blocked
        assert fetched_b is None


@pytest.mark.asyncio
async def test_workspace_list_by_owner_filtering(db_mgr, user_a, user_b):
    """Verify list_by_owner returns exclusively workspaces owned by caller."""
    async with db_mgr.transaction(user=user_a) as conn:
        repo_a = WorkspaceRepository(conn)
        await repo_a.create(WorkspaceCreate(name="Alpha WS"), owner_id=user_a.id)
        await repo_a.create(WorkspaceCreate(name="Beta WS"), owner_id=user_a.id)

        workspaces_a = await repo_a.list_by_owner(owner_id=user_a.id)
        names_a = [w.name for w in workspaces_a]
        assert "Alpha WS" in names_a
        assert "Beta WS" in names_a

    # User B listing their workspaces
    async with db_mgr.transaction(user=user_b) as conn:
        repo_b = WorkspaceRepository(conn)
        workspaces_b = await repo_b.list_by_owner(owner_id=user_b.id)
        names_b = [w.name for w in workspaces_b]
        # Must not contain User A's workspaces
        assert "Alpha WS" not in names_b
        assert "Beta WS" not in names_b


@pytest.mark.asyncio
async def test_workspace_update_and_cross_user_prevention(db_mgr, user_a, user_b):
    """Verify owner can update workspace, but an unauthorized user cannot."""
    async with db_mgr.transaction(user=user_a) as conn:
        repo_a = WorkspaceRepository(conn)
        ws = await repo_a.create(WorkspaceCreate(name="Original Name"), owner_id=user_a.id)

    # User B attempts to tamper with User A's workspace
    async with db_mgr.transaction(user=user_b) as conn:
        repo_b = WorkspaceRepository(conn)
        tamper_res = await repo_b.update(
            ws.id, owner_id=user_b.id, workspace_update=WorkspaceUpdate(name="Hacked Name")
        )
        assert tamper_res is None

    # Verify original name is unchanged
    async with db_mgr.transaction(user=user_a) as conn:
        repo_a = WorkspaceRepository(conn)
        current = await repo_a.get_by_id(ws.id, owner_id=user_a.id)
        assert current.name == "Original Name"

        # User A performs legitimate update
        updated = await repo_a.update(
            ws.id, owner_id=user_a.id, workspace_update=WorkspaceUpdate(name="Legit Name")
        )
        assert updated is not None
        assert updated.name == "Legit Name"


@pytest.mark.asyncio
async def test_workspace_soft_delete(db_mgr, user_a):
    """Verify soft_delete sets deleted_at and hides record from default active queries."""
    async with db_mgr.transaction(user=user_a) as conn:
        repo = WorkspaceRepository(conn)
        ws = await repo.create(WorkspaceCreate(name="To Delete"), owner_id=user_a.id)

        # Soft delete
        deleted = await repo.soft_delete(ws.id, owner_id=user_a.id)
        assert deleted is True

        # Should no longer be retrievable by get_by_id
        assert await repo.get_by_id(ws.id, owner_id=user_a.id) is None

        # Excluded from active listing
        active_list = await repo.list_by_owner(owner_id=user_a.id, include_deleted=False)
        assert ws.id not in [w.id for w in active_list]

        # Included when include_deleted=True
        full_list = await repo.list_by_owner(owner_id=user_a.id, include_deleted=True)
        deleted_ws = next((w for w in full_list if w.id == ws.id), None)
        assert deleted_ws is not None
        assert deleted_ws.deleted_at is not None


# ==============================================================================
# Data Center Repository Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_datacenter_create_and_cross_workspace_isolation(db_mgr, user_a, user_b):
    """
    Verify DataCenter creation is scoped through parent workspace ownership.
    User B cannot create or access a data center in User A's workspace.
    """
    async with db_mgr.transaction(user=user_a) as conn:
        repo_ws = WorkspaceRepository(conn)
        repo_dc = DataCenterRepository(conn)

        ws = await repo_ws.create(WorkspaceCreate(name="Facility Workspace"), owner_id=user_a.id)
        dc_in = DataCenterCreate(
            name="Facility Alpha",
            description="DC 1",
            topology_config={"racks": 8, "region": "us-east"},
        )
        dc = await repo_dc.create(ws.id, dc_in, owner_id=user_a.id)
        assert dc is not None
        assert dc.workspace_id == ws.id
        assert dc.name == "Facility Alpha"
        assert dc.topology_config["racks"] == 8

    # User B attempts to create a facility inside User A's workspace
    async with db_mgr.transaction(user=user_b) as conn:
        repo_dc_b = DataCenterRepository(conn)
        rogue_dc = await repo_dc_b.create(
            ws.id, DataCenterCreate(name="Rogue DC"), owner_id=user_b.id
        )
        assert rogue_dc is None

        # User B attempts to get User A's facility
        assert await repo_dc_b.get_by_id(dc.id, ws.id, owner_id=user_b.id) is None

        # User B attempts to list facilities in User A's workspace
        assert await repo_dc_b.list_by_workspace(ws.id, owner_id=user_b.id) == []

        # User B attempts to delete User A's facility
        assert await repo_dc_b.delete(dc.id, ws.id, owner_id=user_b.id) is False

    # User A can legitimately fetch, update, and delete their facility
    async with db_mgr.transaction(user=user_a) as conn:
        repo_dc_a = DataCenterRepository(conn)
        fetched = await repo_dc_a.get_by_id(dc.id, ws.id, owner_id=user_a.id)
        assert fetched is not None
        assert fetched.name == "Facility Alpha"

        updated = await repo_dc_a.update(
            dc.id,
            ws.id,
            DataCenterUpdate(name="Facility Alpha Renamed"),
            owner_id=user_a.id,
        )
        assert updated is not None
        assert updated.name == "Facility Alpha Renamed"

        deleted = await repo_dc_a.delete(dc.id, ws.id, owner_id=user_a.id)
        assert deleted is True

        # Now deleted
        assert await repo_dc_a.get_by_id(dc.id, ws.id, owner_id=user_a.id) is None
