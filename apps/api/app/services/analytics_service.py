from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_draft import AIDraft
from app.models.customer_message import CustomerMessage
from app.models.enums import MessageStatus, ReplyStatus
from app.models.integration_event import IntegrationEvent
from app.models.product import Product
from app.models.reply import Reply
from app.models.user import User
from app.schemas.analytics import (
    AIModelUsageItem,
    AIUsageAnalyticsResponse,
    AnalyticsOverviewResponse,
    AnalyticsPeriod,
    DailyMessagePoint,
    MarketplaceAnalyticsItem,
    MarketplaceAnalyticsResponse,
    MessageAnalyticsResponse,
    ProductAnalyticsItem,
    ProductAnalyticsResponse,
    TeamAnalyticsItem,
    TeamAnalyticsResponse,
)
from app.services.organization_service import OrganizationService

_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_OWN_REPLY_SEND = Reply.metadata_json["externally_already_answered"].as_boolean().is_not(True)
_ANSWERED_STATUSES = {MessageStatus.ANSWERED.value, MessageStatus.AUTO_REPLY_SENT.value}
_UNANSWERED_STATUSES = {
    MessageStatus.NEW.value,
    MessageStatus.IMPORTED.value,
    MessageStatus.NEEDS_REPLY.value,
    MessageStatus.AI_DRAFT_READY.value,
    MessageStatus.NEEDS_MANUAL_CHECK.value,
    MessageStatus.WAITING_REVIEW.value,
    MessageStatus.APPROVED.value,
    MessageStatus.FAILED.value,
}


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organization_service = OrganizationService(session)

    async def overview(self, *, actor: User, organization_id: UUID, days: int = 30) -> AnalyticsOverviewResponse:
        period = await self._authorize_and_period(actor=actor, organization_id=organization_id, days=days)

        total_messages = await self._count_messages(organization_id=organization_id, period=period)
        new_messages = await self._count_messages(
            organization_id=organization_id,
            period=period,
            statuses={MessageStatus.NEW.value, MessageStatus.IMPORTED.value, MessageStatus.NEEDS_REPLY.value},
        )
        unanswered_messages = await self._count_messages(
            organization_id=organization_id,
            period=period,
            statuses=_UNANSWERED_STATUSES,
        )
        answered_messages = await self._count_messages(
            organization_id=organization_id,
            period=period,
            statuses=_ANSWERED_STATUSES,
        )
        negative_reviews = await self._count_negative_reviews(organization_id=organization_id, period=period)

        reply_result = await self.session.execute(
            select(
                func.count(Reply.id),
                func.count(case((Reply.mode == "auto", 1))),
                func.count(case((Reply.mode == "semi_auto", 1))),
            ).where(
                Reply.organization_id == organization_id,
                Reply.status == ReplyStatus.SENT.value,
                _OWN_REPLY_SEND,
                Reply.sent_at.is_not(None),
                Reply.sent_at >= period.start,
                Reply.sent_at < period.end,
            )
        )
        reply_row = reply_result.one()
        replies_sent = int(reply_row[0] or 0)
        auto_replies_sent = int(reply_row[1] or 0)
        manual_replies_sent = int(reply_row[2] or 0)

        ai_drafts_generated = await self._count_ai_drafts(organization_id=organization_id, period=period)
        ai_reply_result = await self.session.execute(
            select(func.count(Reply.id)).where(
                Reply.organization_id == organization_id,
                Reply.ai_draft_id.is_not(None),
                Reply.status == ReplyStatus.SENT.value,
                _OWN_REPLY_SEND,
                Reply.sent_at.is_not(None),
                Reply.sent_at >= period.start,
                Reply.sent_at < period.end,
            )
        )
        ai_replies_sent = int(ai_reply_result.scalar_one())
        ai_acceptance_rate = min(ai_replies_sent / ai_drafts_generated, 1.0) if ai_drafts_generated else None

        average_response_result = await self.session.execute(
            select(func.avg(func.extract("epoch", Reply.sent_at - CustomerMessage.marketplace_created_at)))
            .join(
                CustomerMessage,
                (CustomerMessage.id == Reply.message_id) & (CustomerMessage.organization_id == Reply.organization_id),
            )
            .where(
                Reply.organization_id == organization_id,
                Reply.status == ReplyStatus.SENT.value,
                _OWN_REPLY_SEND,
                Reply.sent_at.is_not(None),
                Reply.sent_at >= period.start,
                Reply.sent_at < period.end,
            )
        )
        average_response_raw = average_response_result.scalar_one_or_none()
        average_response_seconds = max(float(average_response_raw), 0.0) if average_response_raw is not None else None

        return AnalyticsOverviewResponse(
            period=period,
            total_messages=total_messages,
            new_messages=new_messages,
            unanswered_messages=unanswered_messages,
            answered_messages=answered_messages,
            negative_reviews=negative_reviews,
            replies_sent=replies_sent,
            auto_replies_sent=auto_replies_sent,
            manual_replies_sent=manual_replies_sent,
            ai_drafts_generated=ai_drafts_generated,
            average_response_seconds=average_response_seconds,
            ai_acceptance_rate=ai_acceptance_rate,
        )

    async def messages(self, *, actor: User, organization_id: UUID, days: int = 30) -> MessageAnalyticsResponse:
        period = await self._authorize_and_period(actor=actor, organization_id=organization_id, days=days)
        imported_result = await self.session.execute(
            select(CustomerMessage.imported_at).where(
                CustomerMessage.organization_id == organization_id,
                CustomerMessage.imported_at >= period.start,
                CustomerMessage.imported_at < period.end,
            )
        )
        answered_result = await self.session.execute(
            select(Reply.sent_at).where(
                Reply.organization_id == organization_id,
                Reply.status == ReplyStatus.SENT.value,
                _OWN_REPLY_SEND,
                Reply.sent_at.is_not(None),
                Reply.sent_at >= period.start,
                Reply.sent_at < period.end,
            )
        )
        imported_by_day: dict[date, int] = defaultdict(int)
        answered_by_day: dict[date, int] = defaultdict(int)
        for timestamp in imported_result.scalars().all():
            imported_by_day[timestamp.astimezone(UTC).date()] += 1
        for timestamp in answered_result.scalars().all():
            if timestamp is not None:
                answered_by_day[timestamp.astimezone(UTC).date()] += 1

        points: list[DailyMessagePoint] = []
        current = period.start.date()
        last = (period.end - timedelta(microseconds=1)).date()
        while current <= last:
            points.append(
                DailyMessagePoint(
                    date=current,
                    imported=imported_by_day[current],
                    answered=answered_by_day[current],
                )
            )
            current += timedelta(days=1)
        return MessageAnalyticsResponse(period=period, points=points)

    async def marketplaces(self, *, actor: User, organization_id: UUID, days: int = 30) -> MarketplaceAnalyticsResponse:
        period = await self._authorize_and_period(actor=actor, organization_id=organization_id, days=days)
        message_result = await self.session.execute(
            select(
                CustomerMessage.marketplace,
                func.count(CustomerMessage.id),
                func.count(case((CustomerMessage.status.in_(_ANSWERED_STATUSES), 1))),
            )
            .where(
                CustomerMessage.organization_id == organization_id,
                CustomerMessage.imported_at >= period.start,
                CustomerMessage.imported_at < period.end,
            )
            .group_by(CustomerMessage.marketplace)
        )
        failure_result = await self.session.execute(
            select(IntegrationEvent.marketplace, func.count(IntegrationEvent.id))
            .where(
                IntegrationEvent.organization_id == organization_id,
                IntegrationEvent.status == "failed",
                IntegrationEvent.created_at >= period.start,
                IntegrationEvent.created_at < period.end,
            )
            .group_by(IntegrationEvent.marketplace)
        )
        failures = {marketplace: int(count) for marketplace, count in failure_result.all()}
        items = [
            MarketplaceAnalyticsItem(
                marketplace=marketplace,
                messages=int(messages),
                answered=int(answered),
                failed_integration_events=failures.get(marketplace, 0),
            )
            for marketplace, messages, answered in message_result.all()
        ]
        return MarketplaceAnalyticsResponse(period=period, items=items)

    async def products(self, *, actor: User, organization_id: UUID, days: int = 30) -> ProductAnalyticsResponse:
        period = await self._authorize_and_period(actor=actor, organization_id=organization_id, days=days)
        result = await self.session.execute(
            select(
                Product.id,
                Product.name,
                Product.sku,
                func.count(CustomerMessage.id).label("messages"),
                func.count(case(((CustomerMessage.type == "review") & (CustomerMessage.rating <= 2), 1))).label("negative_reviews"),
            )
            .join(
                CustomerMessage,
                (CustomerMessage.product_id == Product.id)
                & (CustomerMessage.organization_id == Product.organization_id)
                & (CustomerMessage.marketplace_account_id == Product.marketplace_account_id),
            )
            .where(
                Product.organization_id == organization_id,
                CustomerMessage.imported_at >= period.start,
                CustomerMessage.imported_at < period.end,
            )
            .group_by(Product.id, Product.name, Product.sku)
            .order_by(func.count(CustomerMessage.id).desc())
            .limit(20)
        )
        items = [
            ProductAnalyticsItem(
                product_id=product_id,
                name=name,
                sku=sku,
                messages=int(messages),
                negative_reviews=int(negative_reviews),
            )
            for product_id, name, sku, messages, negative_reviews in result.all()
        ]
        return ProductAnalyticsResponse(period=period, items=items)

    async def team(self, *, actor: User, organization_id: UUID, days: int = 30) -> TeamAnalyticsResponse:
        period = await self._authorize_and_period(actor=actor, organization_id=organization_id, days=days)
        result = await self.session.execute(
            select(User.id, User.email, User.name, func.count(Reply.id))
            .join(Reply, Reply.sent_by == User.id)
            .where(
                Reply.organization_id == organization_id,
                Reply.status == ReplyStatus.SENT.value,
                _OWN_REPLY_SEND,
                Reply.sent_at.is_not(None),
                Reply.sent_at >= period.start,
                Reply.sent_at < period.end,
            )
            .group_by(User.id, User.email, User.name)
            .order_by(func.count(Reply.id).desc())
        )
        items = [
            TeamAnalyticsItem(user_id=user_id, email=email, name=name, replies_sent=int(replies_sent)) for user_id, email, name, replies_sent in result.all()
        ]
        return TeamAnalyticsResponse(period=period, items=items)

    async def ai_usage(self, *, actor: User, organization_id: UUID, days: int = 30) -> AIUsageAnalyticsResponse:
        period = await self._authorize_and_period(actor=actor, organization_id=organization_id, days=days)
        aggregate_result = await self.session.execute(
            select(
                func.count(AIDraft.id),
                func.coalesce(func.sum(AIDraft.tokens_input), 0),
                func.coalesce(func.sum(AIDraft.tokens_output), 0),
                func.coalesce(func.sum(AIDraft.cost_estimate), 0),
                func.avg(AIDraft.latency_ms),
                func.count(case((func.jsonb_array_length(AIDraft.safety_flags_json) > 0, 1))),
            ).where(
                AIDraft.organization_id == organization_id,
                AIDraft.created_at >= period.start,
                AIDraft.created_at < period.end,
            )
        )
        aggregate = aggregate_result.one()
        model_result = await self.session.execute(
            select(
                AIDraft.model,
                func.count(AIDraft.id),
                func.coalesce(func.sum(AIDraft.tokens_input), 0),
                func.coalesce(func.sum(AIDraft.tokens_output), 0),
                func.coalesce(func.sum(AIDraft.cost_estimate), 0),
                func.avg(AIDraft.latency_ms),
            )
            .where(
                AIDraft.organization_id == organization_id,
                AIDraft.created_at >= period.start,
                AIDraft.created_at < period.end,
            )
            .group_by(AIDraft.model)
            .order_by(func.count(AIDraft.id).desc())
        )
        models = [
            AIModelUsageItem(
                model=model,
                drafts=int(drafts),
                tokens_input=int(tokens_input),
                tokens_output=int(tokens_output),
                cost_estimate=self._decimal_to_float(cost_estimate),
                average_latency_ms=float(average_latency_ms) if average_latency_ms is not None else None,
            )
            for model, drafts, tokens_input, tokens_output, cost_estimate, average_latency_ms in model_result.all()
        ]
        return AIUsageAnalyticsResponse(
            period=period,
            drafts_generated=int(aggregate[0] or 0),
            tokens_input=int(aggregate[1] or 0),
            tokens_output=int(aggregate[2] or 0),
            cost_estimate=self._decimal_to_float(aggregate[3]),
            average_latency_ms=float(aggregate[4]) if aggregate[4] is not None else None,
            safety_flagged_drafts=int(aggregate[5] or 0),
            models=models,
        )

    async def _authorize_and_period(self, *, actor: User, organization_id: UUID, days: int) -> AnalyticsPeriod:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        normalized_days = min(max(days, 1), 366)
        end = datetime.now(UTC)
        start = end - timedelta(days=normalized_days)
        return AnalyticsPeriod(start=start, end=end, days=normalized_days)

    async def _count_messages(
        self,
        *,
        organization_id: UUID,
        period: AnalyticsPeriod,
        statuses: set[str] | None = None,
    ) -> int:
        stmt = select(func.count(CustomerMessage.id)).where(
            CustomerMessage.organization_id == organization_id,
            CustomerMessage.imported_at >= period.start,
            CustomerMessage.imported_at < period.end,
        )
        if statuses is not None:
            stmt = stmt.where(CustomerMessage.status.in_(statuses))
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def _count_negative_reviews(self, *, organization_id: UUID, period: AnalyticsPeriod) -> int:
        result = await self.session.execute(
            select(func.count(CustomerMessage.id)).where(
                CustomerMessage.organization_id == organization_id,
                CustomerMessage.type == "review",
                CustomerMessage.rating <= 2,
                CustomerMessage.imported_at >= period.start,
                CustomerMessage.imported_at < period.end,
            )
        )
        return int(result.scalar_one())

    async def _count_ai_drafts(self, *, organization_id: UUID, period: AnalyticsPeriod) -> int:
        result = await self.session.execute(
            select(func.count(AIDraft.id)).where(
                AIDraft.organization_id == organization_id,
                AIDraft.created_at >= period.start,
                AIDraft.created_at < period.end,
            )
        )
        return int(result.scalar_one())

    @staticmethod
    def _decimal_to_float(value: Decimal | float | int | None) -> float:
        if value is None:
            return 0.0
        return float(value)
