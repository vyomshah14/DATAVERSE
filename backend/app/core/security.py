"""
JWT Authentication & JWKS Validation Engine for DATAVERSE.
Implements asymmetric cryptographic token verification for Supabase Auth JWTs.
"""

import time
from uuid import UUID
from typing import Dict, Optional, List
import jwt
from jwt import PyJWK
import httpx
from fastapi import HTTPException, status

from backend.app.core.config import settings
from backend.app.schemas.auth import AuthenticatedUser


class AuthenticationException(HTTPException):
    """Base exception for authentication failures returning HTTP 401."""

    def __init__(self, detail: str = "Invalid authentication credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class InvalidTokenException(AuthenticationException):
    """Exception for malformed, expired, or invalid signature tokens."""

    pass


class AuthenticationUnavailableException(HTTPException):
    """Exception when identity provider JWKS cannot be reached returning HTTP 503."""

    def __init__(
        self,
        detail: str = "Authentication service temporarily unavailable. Please retry shortly.",
    ):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


class JWKSClient:
    """
    Manages caching, fetching, and refreshing of public keys from Supabase JWKS endpoint.
    Guarantees thread-safe and async-safe asymmetric signature verification.
    """

    def __init__(
        self,
        jwks_url: Optional[str] = None,
        issuer: Optional[str] = None,
        audience: Optional[str] = None,
        allowed_algorithms: Optional[List[str]] = None,
        ttl_seconds: float = 300.0,
    ):
        self.jwks_url = jwks_url or settings.SUPABASE_JWKS_URL
        self.issuer = issuer or settings.SUPABASE_JWT_ISSUER
        self.audience = audience or settings.SUPABASE_JWT_AUDIENCE
        self.allowed_algorithms = allowed_algorithms or settings.JWT_ALGORITHMS
        self.ttl_seconds = ttl_seconds

        self._keys: Dict[str, PyJWK] = {}
        self._last_fetch: float = 0.0

    async def fetch_keys(self, client: Optional[httpx.AsyncClient] = None) -> Dict[str, PyJWK]:
        """Fetch and cache public signing keys from the configured JWKS endpoint."""
        close_client = False
        if client is None:
            client = httpx.AsyncClient(timeout=10.0)
            close_client = True

        try:
            response = await client.get(self.jwks_url)
            if response.status_code != 200:
                raise AuthenticationUnavailableException(
                    "Identity provider returned an unexpected status during key retrieval."
                )
            jwks_data = response.json()
        except (httpx.RequestError, httpx.HTTPError) as exc:
            raise AuthenticationUnavailableException(
                "Unable to reach identity provider JWKS service."
            ) from exc
        finally:
            if close_client:
                await client.aclose()

        keys_list = jwks_data.get("keys", [])
        new_keys: Dict[str, PyJWK] = {}

        for jwk_dict in keys_list:
            kid = jwk_dict.get("kid")
            if not kid:
                continue
            try:
                pyjwk = PyJWK.from_dict(jwk_dict)
                new_keys[kid] = pyjwk
            except Exception:
                # Skip invalid individual keys; keep valid ones
                continue

        self._keys = new_keys
        self._last_fetch = time.time()
        return self._keys

    async def get_signing_key(
        self, kid: str, client: Optional[httpx.AsyncClient] = None
    ) -> PyJWK:
        """
        Retrieve the PyJWK object for the given kid.
        If kid is missing or cache expired, refreshes from JWKS endpoint.
        """
        now = time.time()
        cache_expired = (now - self._last_fetch) > self.ttl_seconds

        if kid in self._keys and not cache_expired:
            return self._keys[kid]

        # Refresh cache from provider
        await self.fetch_keys(client=client)

        if kid in self._keys:
            return self._keys[kid]

        # Key still not found after cache refresh
        raise InvalidTokenException("Unknown or unsupported key identifier (kid).")

    async def verify_jwt(
        self,
        token: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> AuthenticatedUser:
        """
        Fully validates and decodes a Supabase JWT token.
        Returns the typed AuthenticatedUser identity model upon success.
        """
        if not token or not isinstance(token, str):
            raise InvalidTokenException("Authentication token was not provided or empty.")

        # 1. Parse unverified header without trusting payload
        try:
            unverified_header = jwt.get_unverified_header(token)
        except Exception:
            raise InvalidTokenException("Malformed or unparseable JWT header.")

        alg = unverified_header.get("alg")
        if not alg or alg not in self.allowed_algorithms:
            raise InvalidTokenException(
                f"Unsupported signing algorithm: {alg or 'none'}. Allowed: {self.allowed_algorithms}."
            )

        kid = unverified_header.get("kid")
        if not kid:
            raise InvalidTokenException("JWT header missing required key identifier (kid).")

        # 2. Retrieve public key from JWKS cache or endpoint
        pyjwk = await self.get_signing_key(kid, client=client)

        # 3. Cryptographically verify signature and claims
        try:
            payload = jwt.decode(
                token,
                pyjwk.key,
                algorithms=[alg],
                issuer=self.issuer,
                audience=self.audience,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": True,
                    "verify_aud": True,
                    "require": ["exp", "iss", "aud", "sub"],
                },
            )
        except jwt.ExpiredSignatureError:
            raise InvalidTokenException("Authentication token has expired.")
        except jwt.InvalidIssuerError:
            raise InvalidTokenException("Token issuer does not match configured authority.")
        except jwt.InvalidAudienceError:
            raise InvalidTokenException("Token audience does not match expected recipient.")
        except jwt.InvalidSignatureError:
            raise InvalidTokenException("Token cryptographic signature verification failed.")
        except jwt.MissingRequiredClaimError as exc:
            raise InvalidTokenException(f"Token is missing required claim: {exc.claim}.")
        except jwt.PyJWTError:
            raise InvalidTokenException("Token validation failed.")

        # 4. Extract and validate subject identity
        sub_raw = payload.get("sub")
        try:
            user_id = UUID(str(sub_raw))
        except (ValueError, TypeError):
            raise InvalidTokenException("Token contains invalid subject UUID.")

        return AuthenticatedUser(
            id=user_id,
            email=payload.get("email"),
            role=payload.get("role"),
            app_metadata=payload.get("app_metadata") or {},
            user_metadata=payload.get("user_metadata") or {},
        )


# Central default JWKS verifier instance
default_jwks_client = JWKSClient()

