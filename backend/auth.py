"""
Authentication middleware for the FastAPI backend.

Verifies that incoming requests carry a valid WorkOS session.
The frontend (Next.js + AuthKit) stores the session in an HTTP-only cookie.
When the frontend calls our API it forwards the WorkOS session cookie or
an Authorization Bearer token.

For local development the flow is:
  1. Next.js API route (server action) reads the WorkOS session via `withAuth()`
  2. Passes a short-lived access token to client components
  3. Client components send `Authorization: Bearer <access_token>` to this backend

We verify the access token using the WorkOS JWKS endpoint.
"""

from __future__ import annotations

import time
from functools import lru_cache
from typing import Optional

import httpx
import jwt
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from config import WORKOS_CLIENT_ID

# WorkOS JWKS endpoint (public keys for verifying access tokens)
_WORKOS_JWKS_URL = "https://api.workos.com/sso/jwks"

# Cache JWKS for 1 hour
_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}
_JWKS_TTL = 3600  # seconds


async def _get_jwks() -> list[dict]:
    """Fetch and cache the WorkOS JWKS key set."""
    now = time.time()
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(_WORKOS_JWKS_URL, timeout=10)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        _jwks_cache["keys"] = keys
        _jwks_cache["fetched_at"] = now
        return keys


async def verify_access_token(token: str) -> dict:
    """
    Verify a WorkOS access token and return its claims.
    Raises HTTPException(401) on failure.
    """
    try:
        jwks = await _get_jwks()
        # Build a PyJWKSet from the fetched keys
        jwk_set = jwt.PyJWKClient.__new__(jwt.PyJWKClient)
        # We need to decode the header to find the right key
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        # Find the matching key
        signing_key = None
        for key_data in jwks:
            if key_data.get("kid") == kid:
                signing_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                break

        if signing_key is None:
            raise HTTPException(status_code=401, detail="Invalid token signing key")

        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=WORKOS_CLIENT_ID,
            options={"verify_exp": True},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Authentication failed")


def get_user_id_from_request(request: Request) -> Optional[str]:
    """Extract user ID previously stored by auth middleware."""
    return getattr(request.state, "user_id", None)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that protects all routes except /health and /docs.
    Extracts Bearer token from Authorization header and verifies it.
    """

    # Routes that do NOT require authentication
    PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Allow preflight CORS
        if request.method == "OPTIONS":
            return await call_next(request)

        # Allow public paths
        if request.url.path in self.PUBLIC_PATHS:
            request.state.user_id = None
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid Authorization header",
            )

        token = auth_header[len("Bearer "):]
        claims = await verify_access_token(token)

        # Store user info on request state for audit logging
        request.state.user_id = claims.get("sub", "unknown")
        request.state.user_email = claims.get("email")

        return await call_next(request)
