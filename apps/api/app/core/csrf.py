from fastapi import HTTPException, Request, status

CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_HEADER_VALUE = "1"
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


async def require_csrf_header(request: Request) -> None:
    if request.headers.get(CSRF_HEADER_NAME) != CSRF_HEADER_VALUE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed",
        )


async def require_cookie_auth_csrf(request: Request) -> None:
    if request.method.upper() not in _SAFE_METHODS:
        await require_csrf_header(request)
