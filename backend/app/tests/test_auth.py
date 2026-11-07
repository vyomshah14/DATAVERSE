"""
Test Suite for FastAPI JWT Authentication & JWKS Verification.
Validates security dependencies, token decoding, algorithm enforcement,
caching, error handling, and safe identity resolution.
"""

import time
import base64
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec

from backend.app.main import app
from backend.app.core.security import JWKSClient
from backend.app.api.deps import get_jwks_client


# ==============================================================================
# Cryptographic Test Fixtures & Key Utilities
# ==============================================================================

def generate_ec_key_pair():
    """Generates an ephemeral EC P-256 key pair for test signing."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


def ec_public_key_to_jwk(public_key, kid: str = "test-key-1", alg: str = "ES256") -> dict:
    """Converts an ECPublicKey to RFC 7517 JWK format."""
    numbers = public_key.public_numbers()

    def to_b64(val: int) -> str:
        return base64.urlsafe_b64encode(val.to_bytes(32, "big")).rstrip(b"=").decode("ascii")

    return {
        "kty": "EC",
        "crv": "P-256",
        "x": to_b64(numbers.x),
        "y": to_b64(numbers.y),
        "kid": kid,
        "alg": alg,
        "use": "sig",
    }


def create_test_jwt(
    private_key,
    kid: str = "test-key-1",
    sub: str = "11111111-1111-1111-1111-111111111111",
    iss: str = "https://test.supabase.co/auth/v1",
    aud: str = "authenticated",
    exp_delta: int = 3600,
    email: str = "operator@dataverse.io",
    role: str = "authenticated",
    alg: str = "ES256",
    user_metadata: dict = None,
) -> str:
    """Encodes a signed JWT with standard claims."""
    now = int(time.time())
    payload = {
        "sub": sub,
        "iss": iss,
        "aud": aud,
        "exp": now + exp_delta,
        "iat": now,
        "email": email,
        "role": role,
        "user_metadata": user_metadata or {"display_name": "Test Operator"},
    }
    return jwt.encode(
        payload,
        private_key,
        algorithm=alg,
        headers={"kid": kid, "typ": "JWT"},
    )


# ==============================================================================
# Test Cases
# ==============================================================================

@pytest.fixture
def key_pair():
    return generate_ec_key_pair()


@pytest.fixture
def mock_jwks_client(key_pair):
    """Provides a JWKSClient pre-configured with test public keys."""
    _, public_key = key_pair
    client = JWKSClient(
        jwks_url="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        issuer="https://test.supabase.co/auth/v1",
        audience="authenticated",
        allowed_algorithms=["ES256", "RS256"],
    )
    jwk_dict = ec_public_key_to_jwk(public_key, kid="test-key-1")
    pyjwk = jwt.PyJWK.from_dict(jwk_dict)
    client._keys = {"test-key-1": pyjwk}
    client._last_fetch = time.time()
    return client


@pytest.mark.asyncio
async def test_missing_authorization_header():
    """Verify 401 when Authorization header is absent."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "WWW-Authenticate" in response.headers
    assert response.json()["detail"] == "Authentication credentials were not provided."


@pytest.mark.asyncio
async def test_malformed_bearer_token(mock_jwks_client):
    """Verify 401 on non-Bearer or unparseable token strings."""
    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 1. Non-bearer scheme
            res1 = await ac.get("/api/v1/auth/me", headers={"Authorization": "Basic 12345"})
            assert res1.status_code == 401
            assert "Bearer token required" in res1.json()["detail"]

            # 2. Corrupted string
            res2 = await ac.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
            assert res2.status_code == 401
            assert "Malformed" in res2.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_valid_signed_jwt_and_identity_extraction(key_pair, mock_jwks_client):
    """Verify 200 and accurate identity payload with valid signed JWT."""
    private_key, _ = key_pair
    user_id = str(uuid.uuid4())
    token = create_test_jwt(
        private_key,
        sub=user_id,
        email="lead.architect@dataverse.io",
        role="lead_operator",
        user_metadata={"facility": "US-East-1"},
    )

    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user_id
        assert data["email"] == "lead.architect@dataverse.io"
        assert data["role"] == "lead_operator"
        assert data["user_metadata"]["facility"] == "US-East-1"
        assert data["authenticated"] is True
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_invalid_signature_rejected(mock_jwks_client):
    """Verify 401 when token is signed by an unauthorized private key."""
    other_private_key, _ = generate_ec_key_pair()
    token = create_test_jwt(other_private_key, kid="test-key-1")

    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 401
        assert "signature verification failed" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_expired_token_rejected(key_pair, mock_jwks_client):
    """Verify 401 when token has an expired expiration timestamp."""
    private_key, _ = key_pair
    token = create_test_jwt(private_key, exp_delta=-3600)

    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_invalid_issuer_rejected(key_pair, mock_jwks_client):
    """Verify 401 when token issuer claim is untrusted."""
    private_key, _ = key_pair
    token = create_test_jwt(private_key, iss="https://rogue-issuer.attacker.com")

    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 401
        assert "issuer" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_invalid_audience_rejected(key_pair, mock_jwks_client):
    """Verify 401 when audience claim does not match expected recipient."""
    private_key, _ = key_pair
    token = create_test_jwt(private_key, aud="unauthorized-service")

    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 401
        assert "audience" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_unsupported_algorithm_rejected(key_pair, mock_jwks_client):
    """Verify 401 when token declares an algorithm not in allowed list (e.g. HS256)."""
    # Create HMAC symmetric token with 32-byte key
    token = jwt.encode(
        {"sub": str(uuid.uuid4()), "iss": "https://test.supabase.co/auth/v1", "aud": "authenticated", "exp": 9999999999},
        "a_very_secure_test_symmetric_secret_key_32_bytes",
        algorithm="HS256",
        headers={"kid": "test-key-1"},
    )

    app.dependency_overrides[get_jwks_client] = lambda: mock_jwks_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 401
        assert "Unsupported signing algorithm" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_jwks_client, None)


@pytest.mark.asyncio
async def test_unknown_kid_triggers_jwks_refresh():
    """Verify that encountering an unknown kid triggers a live fetch from the JWKS endpoint."""
    key_v2_priv, key_v2_pub = generate_ec_key_pair()
    token_v2 = create_test_jwt(key_v2_priv, kid="key-v2")

    # Mock an HTTP client that serves key-v2 upon refresh
    jwk_v2_dict = ec_public_key_to_jwk(key_v2_pub, kid="key-v2")

    async def mock_handler(request):
        if "jwks.json" in str(request.url):
            return httpx.Response(200, json={"keys": [jwk_v2_dict]})
        return httpx.Response(404)

    mock_http_client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))

    client = JWKSClient(
        jwks_url="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        issuer="https://test.supabase.co/auth/v1",
        audience="authenticated",
    )
    # Initially client has no keys
    assert "key-v2" not in client._keys

    # Verifying token should trigger fetch and resolve key-v2
    user = await client.verify_jwt(token_v2, client=mock_http_client)
    assert str(user.id) == "11111111-1111-1111-1111-111111111111"
    assert "key-v2" in client._keys


@pytest.mark.asyncio
async def test_unknown_kid_unresolved_after_refresh():
    """Verify 401 when kid is still absent after fetching latest JWKS."""
    key_priv, _ = generate_ec_key_pair()
    token = create_test_jwt(key_priv, kid="non-existent-kid")

    async def mock_handler(request):
        return httpx.Response(200, json={"keys": []})

    mock_http_client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))

    client = JWKSClient(
        jwks_url="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        issuer="https://test.supabase.co/auth/v1",
        audience="authenticated",
    )

    with pytest.raises(httpx.HTTPStatusError if False else Exception) as exc_info:
        await client.verify_jwt(token, client=mock_http_client)
    assert exc_info.value.status_code == 401
    assert "Unknown or unsupported key identifier" in exc_info.value.detail


@pytest.mark.asyncio
async def test_jwks_network_failure_returns_503():
    """Verify 503 Service Unavailable when identity provider JWKS cannot be contacted."""
    key_priv, _ = generate_ec_key_pair()
    token = create_test_jwt(key_priv, kid="unseen-kid")

    async def mock_handler(request):
        raise httpx.ConnectError("Connection refused by identity provider")

    mock_http_client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))

    client = JWKSClient(
        jwks_url="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        issuer="https://test.supabase.co/auth/v1",
        audience="authenticated",
    )

    with pytest.raises(Exception) as exc_info:
        await client.verify_jwt(token, client=mock_http_client)
    assert exc_info.value.status_code == 503
    assert "Unable to reach identity provider" in exc_info.value.detail
