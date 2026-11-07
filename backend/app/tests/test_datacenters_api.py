"""
End-to-End Test Suite for Data Center Facility CRUD REST APIs.
Validates JWT authentication, multi-tenant workspace scoping, name trimming and length validation,
topology_config JSON object validation, duplicate name 409 conflicts, and physical deletion lifecycle.
"""

from pathlib import Path
import time
import base64
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
import asyncpg
import jwt
from cryptography.hazmat.primitives.asymmetric import ec

from backend.app.main import app
from backend.app.core.security import JWKSClient
from backend.app.core.database import DatabaseManager
from backend.app.api.deps import get_jwks_client, get_db_manager

LOCAL_TEST_DB_URL = "postgresql://localhost/sandbox"
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MIGRATION_FILE = PROJECT_ROOT / "migrations" / "0001_initial_schema.sql"


# ==============================================================================
# Fixtures & Test Setup
# ==============================================================================

def generate_ec_keys():
    priv = ec.generate_private_key(ec.SECP256R1())
    pub = priv.public_key()
    return priv, pub


def ec_pub_to_jwk(pub, kid="test-key-dc", alg="ES256"):
    nums = pub.public_numbers()
    def b64(v):
        return base64.urlsafe_b64encode(v.to_bytes(32, "big")).rstrip(b"=").decode("ascii")
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64(nums.x),
        "y": b64(nums.y),
        "kid": kid,
        "alg": alg,
        "use": "sig",
    }


def make_token(priv, sub_uuid, kid="test-key-dc"):
    now = int(time.time())
    payload = {
        "sub": str(sub_uuid),
        "iss": "https://test.supabase.co/auth/v1",
        "aud": "authenticated",
        "exp": now + 3600,
        "iat": now,
        "email": f"operator_{sub_uuid}@dataverse.io",
        "role": "authenticated",
    }
    return jwt.encode(payload, priv, algorithm="ES256", headers={"kid": kid})


@pytest.fixture(autouse=True)
async def ensure_db_schema():
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
async def test_env():
    """Configures JWKS client and DatabaseManager test fixtures for FastAPI."""
    priv, pub = generate_ec_keys()
    jwks_client = JWKSClient(
        jwks_url="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        issuer="https://test.supabase.co/auth/v1",
        audience="authenticated",
    )
    jwk_dict = ec_pub_to_jwk(pub, kid="test-key-dc")
    jwks_client._keys = {"test-key-dc": jwt.PyJWK.from_dict(jwk_dict)}
    jwks_client._last_fetch = time.time()

    db_mgr = DatabaseManager()
    await db_mgr.initialize(LOCAL_TEST_DB_URL)

    app.dependency_overrides[get_jwks_client] = lambda: jwks_client
    app.dependency_overrides[get_db_manager] = lambda: db_mgr

    # Create two distinct test operators in auth.users
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()

    async with db_mgr.connection() as conn:
        await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2);", user_a_id, f"dc_a_{user_a_id}@dataverse.io")
        await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2);", user_b_id, f"dc_b_{user_b_id}@dataverse.io")

    token_a = make_token(priv, user_a_id)
    token_b = make_token(priv, user_b_id)

    yield {
        "user_a_id": user_a_id,
        "token_a": token_a,
        "user_b_id": user_b_id,
        "token_b": token_b,
        "db_mgr": db_mgr,
    }

    app.dependency_overrides.pop(get_jwks_client, None)
    app.dependency_overrides.pop(get_db_manager, None)
    await db_mgr.close()


# ==============================================================================
# 1. Authentication & Authorization Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_datacenters_unauthenticated_requests():
    """Verify 401 Unauthorized across all endpoints when token is missing or invalid."""
    dummy_ws_id = uuid.uuid4()
    dummy_dc_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # POST
        r1 = await ac.post(f"/api/v1/workspaces/{dummy_ws_id}/datacenters", json={"name": "No Auth"})
        assert r1.status_code == 401

        # GET list
        r2 = await ac.get(f"/api/v1/workspaces/{dummy_ws_id}/datacenters")
        assert r2.status_code == 401

        # GET by ID
        r3 = await ac.get(f"/api/v1/workspaces/{dummy_ws_id}/datacenters/{dummy_dc_id}")
        assert r3.status_code == 401

        # PATCH
        r4 = await ac.patch(f"/api/v1/workspaces/{dummy_ws_id}/datacenters/{dummy_dc_id}", json={"name": "Hacked"})
        assert r4.status_code == 401

        # DELETE
        r5 = await ac.delete(f"/api/v1/workspaces/{dummy_ws_id}/datacenters/{dummy_dc_id}")
        assert r5.status_code == 401


# ==============================================================================
# 2. Facility Creation & Validation Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_datacenter_creation_success(test_env):
    """Verify 201 Created and response schema when creating a valid data center."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create parent workspace first
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Lab DC Test"}, headers=headers_a)
        assert ws_res.status_code == 201
        ws_id = ws_res.json()["id"]

        # Create data center
        payload = {
            "name": "US-East Simulation Facility",
            "description": "Primary GPU cluster",
            "topology_config": {"rows": 10, "racks_per_row": 8, "cooling_type": "liquid"},
        }
        dc_res = await ac.post(f"/api/v1/workspaces/{ws_id}/datacenters", json=payload, headers=headers_a)
        assert dc_res.status_code == 201
        data = dc_res.json()
        assert data["id"] is not None
        assert data["workspace_id"] == ws_id
        assert data["name"] == "US-East Simulation Facility"
        assert data["description"] == "Primary GPU cluster"
        assert data["topology_config"]["cooling_type"] == "liquid"
        assert "created_at" in data
        assert "updated_at" in data


@pytest.mark.asyncio
async def test_datacenter_creation_default_topology(test_env):
    """Verify facility creation with default empty topology_config."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Default Topology WS"}, headers=headers_a)
        ws_id = ws_res.json()["id"]

        dc_res = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={"name": "Minimal DC"},
            headers=headers_a,
        )
        assert dc_res.status_code == 201
        assert dc_res.json()["topology_config"] == {}


@pytest.mark.asyncio
async def test_datacenter_name_and_topology_validation(test_env):
    """Verify 422 Unprocessable Entity on invalid name or non-object topology_config."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Validation WS"}, headers=headers_a)
        ws_id = ws_res.json()["id"]

        # Empty name
        r1 = await ac.post(f"/api/v1/workspaces/{ws_id}/datacenters", json={"name": ""}, headers=headers_a)
        assert r1.status_code == 422

        # Whitespace-only name
        r2 = await ac.post(f"/api/v1/workspaces/{ws_id}/datacenters", json={"name": "    "}, headers=headers_a)
        assert r2.status_code == 422

        # Name exceeding 100 chars
        r3 = await ac.post(f"/api/v1/workspaces/{ws_id}/datacenters", json={"name": "X" * 101}, headers=headers_a)
        assert r3.status_code == 422

        # Topology config as array (not JSON object)
        r4 = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={"name": "Invalid Topology", "topology_config": [1, 2, 3]},
            headers=headers_a,
        )
        assert r4.status_code == 422

        # Topology config as string
        r5 = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={"name": "Invalid Topology", "topology_config": "not-an-object"},
            headers=headers_a,
        )
        assert r5.status_code == 422

        # Whitespace trimmed successfully
        r6 = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={"name": "   Trimmed Name   "},
            headers=headers_a,
        )
        assert r6.status_code == 201
        assert r6.json()["name"] == "Trimmed Name"


# ==============================================================================
# 3. Multi-Tenant Isolation & Anti-Enumeration 404s
# ==============================================================================

@pytest.mark.asyncio
async def test_cross_tenant_workspace_isolation(test_env):
    """
    Verify 404 Not Found when creating, reading, updating, or deleting facilities
    in a workspace belonging to another user.
    """
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    headers_b = {"Authorization": f"Bearer {test_env['token_b']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User A creates workspace and facility
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "User A Workspace"}, headers=headers_a)
        ws_a_id = ws_res.json()["id"]

        dc_res = await ac.post(
            f"/api/v1/workspaces/{ws_a_id}/datacenters",
            json={"name": "User A Facility"},
            headers=headers_a,
        )
        dc_a_id = dc_res.json()["id"]

        # User B attempts to CREATE facility in User A's workspace -> 404
        r_create = await ac.post(
            f"/api/v1/workspaces/{ws_a_id}/datacenters",
            json={"name": "Rogue Facility"},
            headers=headers_b,
        )
        assert r_create.status_code == 404

        # User B attempts to LIST facilities in User A's workspace -> 404
        r_list = await ac.get(f"/api/v1/workspaces/{ws_a_id}/datacenters", headers=headers_b)
        assert r_list.status_code == 404

        # User B attempts to GET User A's facility -> 404
        r_get = await ac.get(f"/api/v1/workspaces/{ws_a_id}/datacenters/{dc_a_id}", headers=headers_b)
        assert r_get.status_code == 404

        # User B attempts to UPDATE User A's facility -> 404
        r_update = await ac.patch(
            f"/api/v1/workspaces/{ws_a_id}/datacenters/{dc_a_id}",
            json={"name": "Hijacked Name"},
            headers=headers_b,
        )
        assert r_update.status_code == 404

        # User B attempts to DELETE User A's facility -> 404
        r_delete = await ac.delete(f"/api/v1/workspaces/{ws_a_id}/datacenters/{dc_a_id}", headers=headers_b)
        assert r_delete.status_code == 404

        # Facility remains intact for User A
        r_verify = await ac.get(f"/api/v1/workspaces/{ws_a_id}/datacenters/{dc_a_id}", headers=headers_a)
        assert r_verify.status_code == 200
        assert r_verify.json()["name"] == "User A Facility"


@pytest.mark.asyncio
async def test_soft_deleted_parent_workspace_blocks_datacenter(test_env):
    """Verify operations fail with 404 when parent workspace is soft-deleted."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Doomed WS"}, headers=headers_a)
        ws_id = ws_res.json()["id"]

        dc_res = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={"name": "Doomed Facility"},
            headers=headers_a,
        )
        dc_id = dc_res.json()["id"]

        # Soft-delete the parent workspace
        del_ws = await ac.delete(f"/api/v1/workspaces/{ws_id}", headers=headers_a)
        assert del_ws.status_code == 204

        # Creating in deleted workspace -> 404
        r_create = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={"name": "New DC in Deleted WS"},
            headers=headers_a,
        )
        assert r_create.status_code == 404

        # Listing in deleted workspace -> 404
        r_list = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters", headers=headers_a)
        assert r_list.status_code == 404

        # Getting facility in deleted workspace -> 404
        r_get = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters/{dc_id}", headers=headers_a)
        assert r_get.status_code == 404


# ==============================================================================
# 4. Conflict Handling (409 Conflict)
# ==============================================================================

@pytest.mark.asyncio
async def test_duplicate_datacenter_name_conflict(test_env):
    """
    Verify 409 Conflict when creating or renaming a facility to a duplicate name
    within the same workspace, but allow duplicate names across distinct workspaces.
    """
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ws1_res = await ac.post("/api/v1/workspaces", json={"name": "Workspace 1"}, headers=headers_a)
        ws1_id = ws1_res.json()["id"]

        ws2_res = await ac.post("/api/v1/workspaces", json={"name": "Workspace 2"}, headers=headers_a)
        ws2_id = ws2_res.json()["id"]

        # Create DC 1 in Workspace 1
        dc1 = await ac.post(
            f"/api/v1/workspaces/{ws1_id}/datacenters",
            json={"name": "Facility Prime"},
            headers=headers_a,
        )
        assert dc1.status_code == 201

        # Duplicate name in same workspace (case-insensitive) -> 409 Conflict
        dc_dup = await ac.post(
            f"/api/v1/workspaces/{ws1_id}/datacenters",
            json={"name": "  facility prime  "},
            headers=headers_a,
        )
        assert dc_dup.status_code == 409

        # Same name in DIFFERENT workspace -> 201 Created (Allowed!)
        dc_other_ws = await ac.post(
            f"/api/v1/workspaces/{ws2_id}/datacenters",
            json={"name": "Facility Prime"},
            headers=headers_a,
        )
        assert dc_other_ws.status_code == 201

        # Create second facility in Workspace 1
        dc2 = await ac.post(
            f"/api/v1/workspaces/{ws1_id}/datacenters",
            json={"name": "Facility Secondary"},
            headers=headers_a,
        )
        assert dc2.status_code == 201
        dc2_id = dc2.json()["id"]

        # Rename dc2 to conflict with dc1 -> 409 Conflict
        patch_conflict = await ac.patch(
            f"/api/v1/workspaces/{ws1_id}/datacenters/{dc2_id}",
            json={"name": "Facility Prime"},
            headers=headers_a,
        )
        assert patch_conflict.status_code == 409


# ==============================================================================
# 5. List, Retrieve, Update, and Delete Lifecycle
# ==============================================================================

@pytest.mark.asyncio
async def test_datacenter_crud_lifecycle(test_env):
    """Verify full CRUD lifecycle: list, get, partial patch, and delete."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Full Lifecycle WS"}, headers=headers_a)
        ws_id = ws_res.json()["id"]

        # 1. List on empty workspace returns []
        empty_list = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters", headers=headers_a)
        assert empty_list.status_code == 200
        assert empty_list.json() == []

        # 2. Create facility
        create_res = await ac.post(
            f"/api/v1/workspaces/{ws_id}/datacenters",
            json={
                "name": "Beta Lab",
                "description": "Initial lab",
                "topology_config": {"racks": 4},
            },
            headers=headers_a,
        )
        assert create_res.status_code == 201
        dc_id = create_res.json()["id"]

        # 3. List contains newly created facility
        list_res = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters", headers=headers_a)
        assert list_res.status_code == 200
        items = list_res.json()
        assert len(items) == 1
        assert items[0]["id"] == dc_id

        # 4. Get by ID
        get_res = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters/{dc_id}", headers=headers_a)
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Beta Lab"

        # 5. Partial update (PATCH)
        patch_res = await ac.patch(
            f"/api/v1/workspaces/{ws_id}/datacenters/{dc_id}",
            json={
                "description": "Updated lab description",
                "topology_config": {"racks": 16, "chilled_water": True},
            },
            headers=headers_a,
        )
        assert patch_res.status_code == 200
        updated_data = patch_res.json()
        assert updated_data["name"] == "Beta Lab"  # Unchanged
        assert updated_data["description"] == "Updated lab description"
        assert updated_data["topology_config"]["racks"] == 16

        # 6. Delete facility
        del_res = await ac.delete(f"/api/v1/workspaces/{ws_id}/datacenters/{dc_id}", headers=headers_a)
        assert del_res.status_code == 204

        # 7. Repeat delete returns 404
        del_again = await ac.delete(f"/api/v1/workspaces/{ws_id}/datacenters/{dc_id}", headers=headers_a)
        assert del_again.status_code == 404

        # 8. Get deleted facility returns 404
        get_again = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters/{dc_id}", headers=headers_a)
        assert get_again.status_code == 404

        # 9. List is empty again
        final_list = await ac.get(f"/api/v1/workspaces/{ws_id}/datacenters", headers=headers_a)
        assert final_list.status_code == 200
        assert final_list.json() == []

