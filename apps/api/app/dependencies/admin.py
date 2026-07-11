from __future__ import annotations

from fastapi import Depends

from app.core.errors import forbidden
from app.dependencies.auth import get_current_user
from app.models.user import User


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise forbidden("Internal superadmin access is required")
    return current_user
