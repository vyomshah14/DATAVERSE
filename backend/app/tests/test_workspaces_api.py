"""
End-to-End Test Suite for Workspace CRUD REST APIs.
Validates authentication, tenant ownership, error handling, conflict detection,
anti-enumeration 404 responses, and soft-delete lifecycle.
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


def ec_pub_to_jwk(pub, kid="test-key-ws", alg="ES256"):
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


def make_token(priv, sub_uuid, kid="test-key-ws"):
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
    jwk_dict = ec_pub_to_jwk(pub, kid="test-key-ws")
    jwks_client._keys = {"test-key-ws": jwt.PyJWK.from_dict(jwk_dict)}
    jwks_client._last_fetch = time.time()

    db_mgr = DatabaseManager()
    await db_mgr.initialize(LOCAL_TEST_DB_URL)

    app.dependency_overrides[get_jwks_client] = lambda: jwks_client
    app.dependency_overrides[get_db_manager] = lambda: db_mgr

    # Create two distinct test operators in auth.users
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()

    async with db_mgr.connection() as conn:
        await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2);", user_a_id, f"op_a_{user_a_id}@dataverse.io")
        await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2);", user_b_id, f"op_b_{user_b_id}@dataverse.io")

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
async def test_workspaces_unauthenticated_requests():
    """Verify 401 Unauthorized across all endpoints when token is missing or malformed."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # POST
        r1 = await ac.post("/api/v1/workspaces", json={"name": "No Auth"})
        assert r1.status_code == 401

        # GET list
        r2 = await ac.get("/api/v1/workspaces")
        assert r2.status_code == 401

        # GET by ID
        r3 = await ac.get(f"/api/v1/workspaces/{uuid.uuid4()}")
        assert r3.status_code == 401

        # PATCH
        r4 = await ac.patch(f"/api/v1/workspaces/{uuid.uuid4()}", json={"name": "Hacked"})
        assert r4.status_code == 401

        # DELETE
        r5 = await ac.delete(f"/api/v1/workspaces/{uuid.uuid4()}")
        assert r5.status_code == 401


# ==============================================================================
# 2. Workspace Creation & Validation Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_creation_success(test_env):
    """Verify 201 Created and response schema when creating a valid workspace."""
    headers = {"Authorization": f"Bearer {test_env['token_a']}"}
    payload = {
        "name": "US-East Simulation Lab",
        "description": "Primary digital twin testbed",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/workspaces", json=payload, headers=headers)

    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] is not None
    assert data["owner_id"] == str(test_env["user_a_id"])
    assert data["name"] == "US-East Simulation Lab"
    assert data["description"] == "Primary digital twin testbed"
    assert data["deleted_at"] is None


@pytest.mark.asyncio
async def test_workspace_creation_validation_errors(test_env):
    """Verify 422 Unprocessable Entity on empty, whitespace, or overlong names."""
    headers = {"Authorization": f"Bearer {test_env['token_a']}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Empty string
        r1 = await ac.post("/api/v1/workspaces", json={"name": ""}, headers=headers)
        assert r1.status_code == 422

        # Whitespace-only string
        r2 = await ac.post("/api/v1/workspaces", json={"name": "   "}, headers=headers)
        assert r2.status_code == 422

        # Overlong name (>100 characters)
        long_name = "X" * 101
        r3 = await ac.post("/api/v1/workspaces", json={"name": long_name}, headers=headers)
        assert r3.status_code == 422


@pytest.mark.asyncio
async def test_workspace_creation_duplicate_name_conflict(test_env):
    """Verify 409 Conflict when creating a workspace with duplicate active name for same owner."""
    headers = {"Authorization": f"Bearer {test_env['token_a']}"}
    unique_name = f"Grid-{uuid.uuid4().hex[:8]}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r1 = await ac.post("/api/v1/workspaces", json={"name": unique_name}, headers=headers)
        assert r1.status_code == 201

        # Attempt to create duplicate (case-insensitive)
        r2 = await ac.post("/api/v1/workspaces", json={"name": unique_name.lower()}, headers=headers)
        assert r2.status_code == 409
        assert "already exists" in r2.json()["detail"]


# ==============================================================================
# 3. Workspace Listing & Ownership Filtering Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_list_ownership_filtering(test_env):
    """Verify GET /workspaces returns only caller-owned active workspaces."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    headers_b = {"Authorization": f"Bearer {test_env['token_b']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User A creates 2 workspaces
        await ac.post("/api/v1/workspaces", json={"name": f"A-1-{uuid.uuid4()}"}, headers=headers_a)
        await ac.post("/api/v1/workspaces", json={"name": f"A-2-{uuid.uuid4()}"}, headers=headers_a)

        # User B creates 1 workspace
        await ac.post("/api/v1/workspaces", json={"name": f"B-1-{uuid.uuid4()}"}, headers=headers_b)

        # User A lists
        resp_a = await ac.get("/api/v1/workspaces", headers=headers_a)
        assert resp_a.status_code == 200
        list_a = resp_a.json()
        assert len(list_a) >= 2
        for ws in list_a:
            assert ws["owner_id"] == str(test_env["user_a_id"])

        # User B lists
        resp_b = await ac.get("/api/v1/workspaces", headers=headers_b)
        assert resp_b.status_code == 200
        list_b = resp_b.json()
        assert len(list_b) == 1
        assert list_b[0]["owner_id"] == str(test_env["user_b_id"])


# ==============================================================================
# 4. Retrieval & Cross-User Isolation Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_get_and_cross_user_isolation(test_env):
    """Verify owner can get workspace, but other users receive 404 Not Found."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    headers_b = {"Authorization": f"Bearer {test_env['token_b']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        created = (await ac.post("/api/v1/workspaces", json={"name": f"Secret-{uuid.uuid4()}"}, headers=headers_a)).json()
        ws_id = created["id"]

        # Owner A gets workspace
        r_a = await ac.get(f"/api/v1/workspaces/{ws_id}", headers=headers_a)
        assert r_a.status_code == 200
        assert r_a.json()["id"] == ws_id

        # Non-owner B attempts to get workspace
        r_b = await ac.get(f"/api/v1/workspaces/{ws_id}", headers=headers_b)
        # Must return 404, NOT 403 (prevents tenant enumeration)
        assert r_b.status_code == 404
        assert r_b.json()["detail"] == "Workspace not found."


# ==============================================================================
# 5. Partial Update Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_patch_update(test_env):
    """Verify owner can update name and description; cross-user update returns 404."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    headers_b = {"Authorization": f"Bearer {test_env['token_b']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        created = (await ac.post("/api/v1/workspaces", json={"name": f"Original-{uuid.uuid4()}"}, headers=headers_a)).json()
        ws_id = created["id"]

        # User B tries to update User A's workspace
        r_b = await ac.patch(f"/api/v1/workspaces/{ws_id}", json={"name": "Hacked Name"}, headers=headers_b)
        assert r_b.status_code == 404

        # Owner A updates description only
        r_a1 = await ac.patch(f"/api/v1/workspaces/{ws_id}", json={"description": "Updated desc"}, headers=headers_a)
        assert r_a1.status_code == 200
        assert r_a1.json()["description"] == "Updated desc"
        assert r_a1.json()["name"] == created["name"]

        # Owner A updates name
        r_a2 = await ac.patch(f"/api/v1/workspaces/{ws_id}", json={"name": "Renamed Grid"}, headers=headers_a)
        assert r_a2.status_code == 200
        assert r_a2.json()["name"] == "Renamed Grid"


# ==============================================================================
# 6. Soft Deletion & Excluded Listing Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_workspace_soft_delete_lifecycle(test_env):
    """Verify soft deletion, 204 response, repeated deletion 404, and listing exclusion."""
    headers_a = {"Authorization": f"Bearer {test_env['token_a']}"}
    ws_name = f"DeleteMe-{uuid.uuid4()}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        created = (await ac.post("/api/v1/workspaces", json={"name": ws_name}, headers=headers_a)).json()
        ws_id = created["id"]

        # Delete workspace
        r_del = await ac.delete(f"/api/v1/workspaces/{ws_id}", headers=headers_a)
        assert r_del.status_code == 204

        # Repeated delete returns 404
        r_del_again = await ac.delete(f"/api/v1/workspaces/{ws_id}", headers=headers_a)
        assert r_del_again.status_code == 404

        # Get by ID returns 404
        r_get = await ac.get(f"/api/v1/workspaces/{ws_id}", headers=headers_a)
        assert r_get.status_code == 404

        # Default listing excludes soft-deleted workspace
        r_list = await ac.get("/api/v1/workspaces", headers=headers_a)
        ids = [w["id"] for w in r_list.json()]
        assert ws_id not in ids

        # Query with include_deleted=true includes it
        r_list_inc = await ac.get("/api/v1/workspaces?include_deleted=true", headers=headers_a)
        deleted_item = next((w for w in r_list_inc.json() if w["id"] == ws_id), None)
        assert deleted_item is not None
        assert deleted_item["deleted_at"] is not None

