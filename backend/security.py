"""
Security middleware: secure headers, ephemeral data enforcement.
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds HIPAA / OWASP recommended security headers to every response.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS protection (legacy, but harmless)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy — don't leak URLs
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy — restrict to self only
        response.headers["Content-Security-Policy"] = "default-src 'self'"

        # Strict Transport Security (browsers remember HTTPS for 1 year)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        # Prevent caching of any response that might contain PHI
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # Permissions Policy — disable unnecessary browser features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        return response
