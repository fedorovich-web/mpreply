from __future__ import annotations

from typing import cast

from fastapi import Request

from app.services.auth_rate_limit_service import AuthRateLimiter


def get_auth_rate_limiter(request: Request) -> AuthRateLimiter:
    return cast(AuthRateLimiter, request.app.state.auth_rate_limiter)
