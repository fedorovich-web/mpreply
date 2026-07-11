import pytest
from fastapi import HTTPException

from app.dependencies.admin import require_superadmin
from app.models.user import User


def _user(*, is_superadmin: bool) -> User:
    return User(
        email="admin@example.com",
        name="Admin",
        password_hash="hashed",
        status="active",
        is_superadmin=is_superadmin,
    )


@pytest.mark.asyncio
async def test_superadmin_dependency_allows_internal_admin() -> None:
    user = _user(is_superadmin=True)
    assert await require_superadmin(user) is user


@pytest.mark.asyncio
async def test_superadmin_dependency_rejects_regular_user() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await require_superadmin(_user(is_superadmin=False))
    assert exc_info.value.status_code == 403
