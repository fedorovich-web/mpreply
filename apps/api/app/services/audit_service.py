from __future__ import annotations

import base64
import binascii
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, forbidden, not_found
from app.models.audit_log import AuditLog
from app.models.organization import OrganizationUser
from app.models.user import User

_AUDIT_READ_ROLES = {"owner", "admin"}


@dataclass(frozen=True)
class AuditLogPage:
    items: list[AuditLog]
    next_cursor: str | None
    has_more: bool


@dataclass(frozen=True)
class AuditCursor:
    created_at: datetime
    audit_id: UUID


def encode_audit_cursor(*, created_at: datetime, audit_id: UUID) -> str:
    if created_at.tzinfo is None:
        raise bad_request("Audit cursor timestamp must include a timezone")
    payload = json.dumps(
        {"created_at": created_at.astimezone(UTC).isoformat(), "id": str(audit_id)},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_audit_cursor(value: str) -> AuditCursor:
    try:
        padded = value + "=" * (-len(value) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
        created_at = datetime.fromisoformat(str(payload["created_at"]))
        audit_id = UUID(str(payload["id"]))
    except (binascii.Error, KeyError, TypeError, ValueError) as exc:
        raise bad_request("Invalid audit cursor") from exc
    if created_at.tzinfo is None:
        raise bad_request("Invalid audit cursor")
    return AuditCursor(created_at=created_at.astimezone(UTC), audit_id=audit_id)


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def write(
        self,
        *,
        action: str,
        entity_type: str,
        organization_id: UUID | None = None,
        actor_user_id: UUID | None = None,
        entity_id: str | None = None,
        metadata: dict[str, object] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        event = AuditLog(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=metadata or {},
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_for_organization(
        self,
        *,
        actor: User,
        organization_id: UUID,
        action: str | None = None,
        entity_type: str | None = None,
        actor_user_id: UUID | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        cursor: str | None = None,
        limit: int = 50,
    ) -> AuditLogPage:
        await self._require_audit_read_role(organization_id=organization_id, user_id=actor.id)
        if limit < 1 or limit > 100:
            raise bad_request("Audit page limit must be between 1 and 100")
        action = self._normalize_filter(action, field_name="action")
        entity_type = self._normalize_filter(entity_type, field_name="entity_type")
        created_from = self._normalize_datetime(created_from, field_name="created_from")
        created_to = self._normalize_datetime(created_to, field_name="created_to")
        if created_from is not None and created_to is not None and created_from > created_to:
            raise bad_request("created_from cannot be later than created_to")

        conditions = [AuditLog.organization_id == organization_id]
        if action is not None:
            conditions.append(AuditLog.action == action)
        if entity_type is not None:
            conditions.append(AuditLog.entity_type == entity_type)
        if actor_user_id is not None:
            conditions.append(AuditLog.actor_user_id == actor_user_id)
        if created_from is not None:
            conditions.append(AuditLog.created_at >= created_from)
        if created_to is not None:
            conditions.append(AuditLog.created_at <= created_to)
        if cursor is not None:
            decoded = decode_audit_cursor(cursor)
            conditions.append(
                or_(
                    AuditLog.created_at < decoded.created_at,
                    and_(AuditLog.created_at == decoded.created_at, AuditLog.id < decoded.audit_id),
                )
            )

        result = await self.session.execute(
            select(AuditLog)
            .where(*conditions)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit + 1)
        )
        rows = list(result.scalars().all())
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = None
        if has_more and items:
            last = items[-1]
            next_cursor = encode_audit_cursor(created_at=last.created_at, audit_id=last.id)
        return AuditLogPage(items=items, next_cursor=next_cursor, has_more=has_more)

    @staticmethod
    def _normalize_filter(value: str | None, *, field_name: str) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise bad_request(f"{field_name} cannot be blank")
        return normalized

    @staticmethod
    def _normalize_datetime(value: datetime | None, *, field_name: str) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise bad_request(f"{field_name} must include a timezone")
        return value.astimezone(UTC)

    async def _require_audit_read_role(self, *, organization_id: UUID, user_id: UUID) -> OrganizationUser:
        result = await self.session.execute(
            select(OrganizationUser).where(
                OrganizationUser.organization_id == organization_id,
                OrganizationUser.user_id == user_id,
                OrganizationUser.status == "active",
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise not_found("Organization membership not found")
        if membership.role not in _AUDIT_READ_ROLES:
            raise forbidden("Only organization owners and admins can read audit logs")
        return membership
