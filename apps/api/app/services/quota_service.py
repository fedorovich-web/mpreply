from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.enums import ReplyStatus
from app.models.reply import Reply


@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    hourly_count: int
    daily_count: int
    hourly_limit: int | None
    daily_limit: int | None
    organization_daily_limit: int
    reason: str | None = None


class QuotaService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def check_auto_reply_quota(
        self,
        *,
        organization_id: UUID,
        automation_rule_id: UUID | None,
        hourly_limit: int | None,
        daily_limit: int | None,
        now: datetime | None = None,
    ) -> QuotaDecision:
        current = now or datetime.now(UTC)
        hour_start = current - timedelta(hours=1)
        day_start = current - timedelta(days=1)
        organization_daily_limit = get_settings().auto_reply_daily_limit_default

        hourly_count = await self._count_quota_usage(
            organization_id=organization_id,
            since=hour_start,
            automation_rule_id=automation_rule_id,
        )
        daily_count = await self._count_quota_usage(
            organization_id=organization_id,
            since=day_start,
            automation_rule_id=automation_rule_id,
        )
        organization_daily_count = await self._count_quota_usage(
            organization_id=organization_id,
            since=day_start,
            automation_rule_id=None,
            force_all_rules=True,
        )

        reason: str | None = None
        if organization_daily_count >= organization_daily_limit:
            reason = "organization_daily_limit_exceeded"
        elif hourly_limit is not None and hourly_count >= hourly_limit:
            reason = "rule_hourly_limit_exceeded"
        elif daily_limit is not None and daily_count >= daily_limit:
            reason = "rule_daily_limit_exceeded"

        return QuotaDecision(
            allowed=reason is None,
            hourly_count=hourly_count,
            daily_count=daily_count,
            hourly_limit=hourly_limit,
            daily_limit=daily_limit,
            organization_daily_limit=organization_daily_limit,
            reason=reason,
        )

    async def _count_quota_usage(
        self,
        *,
        organization_id: UUID,
        since: datetime,
        automation_rule_id: UUID | None,
        force_all_rules: bool = False,
    ) -> int:
        """Count confirmed sends and unresolved provider writes that may have succeeded."""
        sent_in_window = and_(
            Reply.status == ReplyStatus.SENT.value,
            Reply.sent_at.is_not(None),
            Reply.sent_at >= since,
        )
        active_reservation = and_(
            Reply.status == ReplyStatus.SENDING.value,
            Reply.last_attempt_at.is_not(None),
            Reply.last_attempt_at >= since,
        )
        ambiguous_reservation = and_(
            Reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
            Reply.metadata_json["provider_write_ambiguity"]["active"].as_boolean().is_(True),
            Reply.last_attempt_at.is_not(None),
            Reply.last_attempt_at >= since,
        )
        stmt = select(func.count(Reply.id)).where(
            Reply.organization_id == organization_id,
            or_(sent_in_window, active_reservation, ambiguous_reservation),
            Reply.mode == "auto",
        )
        if not force_all_rules:
            stmt = stmt.where(Reply.automation_rule_id.is_(None)) if automation_rule_id is None else stmt.where(Reply.automation_rule_id == automation_rule_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
