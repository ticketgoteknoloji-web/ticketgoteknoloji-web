"""API authentication, upload rules, and rate limiting."""

from __future__ import annotations

import hmac
import secrets
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from app.config import get_settings

ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
}

ALLOWED_FORMATS = {"JPEG", "PNG"}


def require_bearer_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Require Authorization: Bearer <MRZ_API_KEY>."""
    settings = get_settings()
    expected = settings.mrz_api_key
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "success": False,
                "error": "API_KEY_NOT_CONFIGURED",
                "message": "MRZ_API_KEY environment variable is not set.",
            },
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Missing or invalid Authorization Bearer token.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Missing or invalid Authorization Bearer token.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )


# Backwards-compatible alias used by older imports
require_api_key = require_bearer_token


def new_request_id() -> str:
    return secrets.token_hex(8)


class RateLimiter:
    """In-memory sliding-window rate limiter (per client IP)."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, limit: int, window_seconds: int = 60) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            cutoff = now - window_seconds
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "success": False,
                        "error": "RATE_LIMITED",
                        "message": "Too many requests. Try again later.",
                    },
                    headers={"Retry-After": str(window_seconds)},
                )
            q.append(now)


rate_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # Prefer Cloudflare connecting IP when present; do not log it with PII payloads
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
