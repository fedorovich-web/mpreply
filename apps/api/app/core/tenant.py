from uuid import UUID

from app.core.errors import forbidden


class TenantContext:
    def __init__(self, organization_id: UUID, user_id: UUID, role: str) -> None:
        self.organization_id = organization_id
        self.user_id = user_id
        self.role = role

    def require_role(self, allowed_roles: set[str]) -> None:
        if self.role not in allowed_roles:
            raise forbidden("You do not have permission to perform this action")
