"""
Automated Test Suite for PostgreSQL Row-Level Security (RLS) Policies.
Validates multi-tenant isolation under SET LOCAL ROLE authenticated:
- Cross-user workspace and data center isolation.
- Hierarchical inheritance of facility tenancy from parent workspace.
- Rejection of unauthorized INSERT, UPDATE, and DELETE.
- Blockade of data centers in soft-deleted parent workspaces.
- Connection-pool identity hygiene (preventing cross-request credential leakage).
"""

from pathlib import Path
import uuid
import pytest
import asyncpg

from backend.app.core.database import DatabaseManager
from backend.app.schemas.auth import AuthenticatedUser
from backend.app.schemas.workspace import WorkspaceCreate
from backend.app.schemas.datacenter import DataCenterCreate
from backend.app.repositories.workspace import WorkspaceRepository
from backend.app.repositories.datacenter import DataCenterRepository

LOCAL_TEST_DB_URL = "postgresql://localhost/sandbox"
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MIGRATION_0001 = PROJECT_ROOT / "migrations" / "0001_initial_schema.sql"
MIGRATION_0002 = PROJECT_ROOT / "migrations" / "0002_row_level_security.sql"


@pytest.fixture(autouse=True)
async def setup_rls_schema():
    """Applies schema foundation and granular RLS migrations to the local test sandbox."""
    try:
        conn = await asyncpg.connect(LOCAL_TEST_DB_URL, timeout=1.0)
    except Exception:
        pytest.skip("Local PostgreSQL sandbox is not accessible")
        return

    try:
        # 1. Setup auth mock schema and auth.uid() function
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
        await conn.execute(
            """
            CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
                SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
            $$ LANGUAGE sql STABLE;

            CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
                SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text;
            $$ LANGUAGE sql STABLE;

            GRANT USAGE ON SCHEMA auth TO authenticated, anon;
            GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
            GRANT EXECUTE ON FUNCTION auth.role() TO authenticated, anon;
            """
        )

        # 2. Apply migrations 0001 and 0002
        sql_0001 = MIGRATION_0001.read_text(encoding="utf-8")
        await conn.execute(sql_0001)

        sql_0002 = MIGRATION_0002.read_text(encoding="utf-8")
        await conn.execute(sql_0002)
    finally:
        await conn.close()


@pytest.fixture
async def db_mgr():
    """Initializes a connection pool to the test database."""
    manager = DatabaseManager()
    await manager.initialize(LOCAL_TEST_DB_URL)
    yield manager
    await manager.close()


@pytest.fixture
async def user_a(db_mgr):
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
    uid = uuid.uuid4()
    async with db_mgr.connection() as conn:
        await conn.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
            uid,
            f"user_b_{uid}@dataverse.io",
        )
    return AuthenticatedUser(id=uid, email=f"user_b_{uid}@dataverse.io", role="authenticated")


# ==============================================================================
# 1. Workspace RLS Policy Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_rls_isolation(db_mgr, user_a, user_b):
    """
    Verify that under SET LOCAL ROLE authenticated:
    - User A can create and read their workspace.
    - User B cannot read, update, or delete User A's workspace.
    - User B cannot insert a workspace with owner_id = User A (WITH CHECK).
    """
    ws_id = None
    # User A creates workspace
    async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
        repo_a = WorkspaceRepository(conn)
        ws = await repo_a.create(WorkspaceCreate(name="User A Confidential"), owner_id=user_a.id)
        ws_id = ws.id
        assert ws.owner_id == user_a.id

        # Direct SQL select under authenticated role returns 1 row
        rows = await conn.fetch("SELECT * FROM public.workspaces WHERE id = $1;", ws_id)
        assert len(rows) == 1

    # User B attempts to access User A's workspace
    async with db_mgr.transaction(user=user_b, switch_role=True) as conn:
        # SELECT is blocked by RLS USING clause -> returns 0 rows
        rows = await conn.fetch("SELECT * FROM public.workspaces WHERE id = $1;", ws_id)
        assert len(rows) == 0

        # UPDATE is blocked by RLS -> affects 0 rows
        res_upd = await conn.execute(
            "UPDATE public.workspaces SET name = 'Hacked' WHERE id = $1;", ws_id
        )
        assert res_upd == "UPDATE 0"

        # DELETE is blocked by RLS -> affects 0 rows
        res_del = await conn.execute("DELETE FROM public.workspaces WHERE id = $1;", ws_id)
        assert res_del == "DELETE 0"

    # User B attempts to insert with spoofed owner_id -> violates WITH CHECK
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        async with db_mgr.transaction(user=user_b, switch_role=True) as conn:
            await conn.execute(
                "INSERT INTO public.workspaces (owner_id, name) VALUES ($1, 'Spoofed WS');",
                user_a.id,
            )


# ==============================================================================
# 2. Data Center RLS Policy Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_datacenter_rls_parent_workspace_inheritance(db_mgr, user_a, user_b):
    """
    Verify that facility access is inherited strictly from the parent workspace:
    - User A can create and read a data center in their active workspace.
    - User B cannot read, update, or delete User A's facility.
    - User B cannot provision a facility into User A's workspace (WITH CHECK).
    """
    ws_id = None
    dc_id = None

    # User A creates workspace and facility
    async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
        repo_ws = WorkspaceRepository(conn)
        repo_dc = DataCenterRepository(conn)

        ws = await repo_ws.create(WorkspaceCreate(name="DC Host WS"), owner_id=user_a.id)
        ws_id = ws.id

        dc = await repo_dc.create(
            ws_id,
            DataCenterCreate(name="Facility Primary", topology_config={"racks": 12}),
            owner_id=user_a.id,
        )
        dc_id = dc.id

        # Direct SQL select returns the facility
        rows = await conn.fetch("SELECT * FROM public.data_centers WHERE id = $1;", dc_id)
        assert len(rows) == 1

    # User B attempts to access User A's facility
    async with db_mgr.transaction(user=user_b, switch_role=True) as conn:
        # SELECT blocked by RLS -> returns 0 rows
        assert len(await conn.fetch("SELECT * FROM public.data_centers WHERE id = $1;", dc_id)) == 0

        # UPDATE blocked by RLS -> affects 0 rows
        assert (
            await conn.execute("UPDATE public.data_centers SET name = 'Rogue' WHERE id = $1;", dc_id)
            == "UPDATE 0"
        )

        # DELETE blocked by RLS -> affects 0 rows
        assert (
            await conn.execute("DELETE FROM public.data_centers WHERE id = $1;", dc_id)
            == "DELETE 0"
        )

    # User B attempts to provision into User A's workspace -> violates WITH CHECK
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        async with db_mgr.transaction(user=user_b, switch_role=True) as conn:
            await conn.execute(
                "INSERT INTO public.data_centers (workspace_id, name) VALUES ($1, 'Rogue DC');",
                ws_id,
            )


# ==============================================================================
# 3. Soft-Deleted Workspace Shield Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_soft_deleted_workspace_shields_data_centers(db_mgr, user_a):
    """
    Verify that when a workspace is soft-deleted:
    - Data center records in that workspace immediately become invisible to SELECT.
    - INSERT of new facilities into the soft-deleted workspace is blocked by WITH CHECK.
    - UPDATE and DELETE are blocked by RLS USING clause.
    """
    ws_id = None
    dc_id = None

    async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
        repo_ws = WorkspaceRepository(conn)
        repo_dc = DataCenterRepository(conn)

        ws = await repo_ws.create(WorkspaceCreate(name="Temp WS"), owner_id=user_a.id)
        ws_id = ws.id

        dc = await repo_dc.create(ws_id, DataCenterCreate(name="DC To Hide"), owner_id=user_a.id)
        dc_id = dc.id

        # Soft-delete the workspace
        await repo_ws.soft_delete(ws_id, owner_id=user_a.id)

        # Querying data center through RLS under authenticated role returns 0 rows!
        rows = await conn.fetch("SELECT * FROM public.data_centers WHERE id = $1;", dc_id)
        assert len(rows) == 0

        # UPDATE is blocked
        assert (
            await conn.execute(
                "UPDATE public.data_centers SET name = 'Ghost' WHERE id = $1;", dc_id
            )
            == "UPDATE 0"
        )

        # DELETE is blocked
        assert (
            await conn.execute("DELETE FROM public.data_centers WHERE id = $1;", dc_id)
            == "DELETE 0"
        )

    # INSERT into soft-deleted workspace is blocked by WITH CHECK
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
            await conn.execute(
                "INSERT INTO public.data_centers (workspace_id, name) VALUES ($1, 'DC In Deleted');",
                ws_id,
            )


# ==============================================================================
# 4. Connection Pool Hygiene & No Identity Leakage Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_connection_pool_hygiene_and_leak_prevention(db_mgr, user_a, user_b):
    """
    Verify that pooled connections cleanly revert their transaction-local claims
    and role upon transaction completion, preventing cross-request identity leaks.
    """
    # 1. User A runs a transaction
    async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
        sub_a = await conn.fetchval("SELECT auth.uid();")
        role_a = await conn.fetchval("SELECT auth.role();")
        cur_role_a = await conn.fetchval("SELECT current_user;")
        assert str(sub_a) == str(user_a.id)
        assert role_a == "authenticated"
        assert cur_role_a == "authenticated"

    # 2. Acquire a raw connection from the pool (no user injected)
    async with db_mgr.connection() as raw_conn:
        sub_raw = await raw_conn.fetchval("SELECT auth.uid();")
        role_raw = await raw_conn.fetchval("SELECT auth.role();")
        claim_sub = await raw_conn.fetchval("SELECT current_setting('request.jwt.claim.sub', true);")
        cur_user_raw = await raw_conn.fetchval("SELECT current_user;")

        # Claims MUST be empty / reverted
        assert sub_raw is None
        assert role_raw is None
        assert claim_sub == "" or claim_sub is None
        assert cur_user_raw != "authenticated"

    # 3. User B runs a transaction on a potentially recycled connection
    async with db_mgr.transaction(user=user_b, switch_role=True) as conn:
        sub_b = await conn.fetchval("SELECT auth.uid();")
        cur_role_b = await conn.fetchval("SELECT current_user;")
        assert str(sub_b) == str(user_b.id)
        assert str(sub_b) != str(user_a.id)
        assert cur_role_b == "authenticated"


# ==============================================================================
# 5. WITH CHECK Anti-Tampering & Ownership Reassignment Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_rls_with_check_prevents_ownership_and_workspace_tampering(db_mgr, user_a, user_b):
    """
    Verify that WITH CHECK clauses in UPDATE policies strictly prevent:
    - An owner from transferring their workspace to another user.
    - An owner from moving a facility into another user's workspace.
    """
    ws_a_id = None
    ws_b_id = None
    dc_a_id = None

    # User A creates Workspace A and Data Center A
    async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
        repo_ws = WorkspaceRepository(conn)
        repo_dc = DataCenterRepository(conn)

        ws_a = await repo_ws.create(WorkspaceCreate(name="Workspace A"), owner_id=user_a.id)
        ws_a_id = ws_a.id

        dc_a = await repo_dc.create(ws_a_id, DataCenterCreate(name="DC Alpha"), owner_id=user_a.id)
        dc_a_id = dc_a.id

    # User B creates Workspace B
    async with db_mgr.transaction(user=user_b, switch_role=True) as conn:
        repo_ws = WorkspaceRepository(conn)
        ws_b = await repo_ws.create(WorkspaceCreate(name="Workspace B"), owner_id=user_b.id)
        ws_b_id = ws_b.id

    # 1. User A attempts to reassign Workspace A's owner_id to User B -> Rejected by WITH CHECK
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
            await conn.execute(
                "UPDATE public.workspaces SET owner_id = $1 WHERE id = $2;",
                user_b.id,
                ws_a_id,
            )

    # 2. User A attempts to move DC Alpha into User B's Workspace B -> Rejected by WITH CHECK
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        async with db_mgr.transaction(user=user_a, switch_role=True) as conn:
            await conn.execute(
                "UPDATE public.data_centers SET workspace_id = $1 WHERE id = $2;",
                ws_b_id,
                dc_a_id,
            )

