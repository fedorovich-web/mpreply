from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, conflict, not_found, payment_required
from app.models.organization import Organization
from app.models.reply_credit import ReplyCreditEvent, ReplyCreditGrant, ReplyCreditOperation, ReplyTrialClaim
from app.models.subscription import Subscription
from app.models.user import User

CreditKind = Literal["trial", "monthly", "addon"]


def utc(value: datetime) -> datetime:
    # SQLite test storage omits timezone metadata; PostgreSQL stores timestamptz.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@dataclass(frozen=True)
class ReplyCreditBalance:
    trial_available: int = 0
    paid_available: int = 0
    reserved: int = 0
    consumed: int = 0
    expired: int = 0
    granted: int = 0
    trial_ends_at: datetime | None = None

    @property
    def available(self) -> int:
        return self.trial_available + self.paid_available


class ReplyCreditService:
    """All mutations lock the tenant's organization row. The caller owns commit/rollback.

    Reserve must be committed before external work. Persisting a draft and consuming
    its reservation must share one transaction. Expired operations are fenced:
    a late provider response cannot complete an operation recovered by another call.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def activate_trial(self, *, organization_id: UUID, owner_user_id: UUID, now: datetime | None = None) -> ReplyTrialClaim | None:
        now = now or datetime.now(UTC)
        owner = await self.session.scalar(select(User.id).where(User.id == owner_user_id, User.status == "active").with_for_update(key_share=True))
        if owner is None:
            raise bad_request("Trial requires an active owner account")
        claim = await self.session.get(ReplyTrialClaim, owner_user_id)
        if claim is not None:
            return claim if claim.organization_id == organization_id else None
        organization = await self.session.scalar(
            select(Organization)
            .where(
                Organization.id == organization_id,
                Organization.owner_user_id == owner_user_id,
                Organization.status == "active",
            )
            .with_for_update(key_share=True)
        )
        if organization is None:
            raise not_found("Trial workspace not found")
        ends_at = now + timedelta(days=14)
        grant = await self.grant(
            organization_id=organization_id,
            source_key=f"trial:owner:{owner_user_id}",
            kind="trial",
            quantity=350,
            expires_at=ends_at,
            now=now,
        )
        claim = ReplyTrialClaim(owner_user_id=owner_user_id, organization_id=organization_id, grant_id=grant.id, starts_at=now, ends_at=ends_at)
        self.session.add(claim)
        await self.session.flush()
        return claim

    async def _lock(self, organization_id: UUID) -> None:
        row = await self.session.scalar(select(Organization.id).where(Organization.id == organization_id).with_for_update(key_share=True))
        if row is None:
            raise not_found("Organization not found")

    async def _grants(self, organization_id: UUID) -> list[ReplyCreditGrant]:
        rows = await self.session.scalars(
            select(ReplyCreditGrant)
            .where(ReplyCreditGrant.organization_id == organization_id)
            .order_by(ReplyCreditGrant.created_at, ReplyCreditGrant.id)
            .execution_options(populate_existing=True)
        )
        return list(rows.all())

    def _event(self, grant: ReplyCreditGrant, kind: str, quantity: int, now: datetime, operation: ReplyCreditOperation | None = None) -> None:
        self.session.add(
            ReplyCreditEvent(
                organization_id=grant.organization_id,
                grant_id=grant.id,
                kind=kind,
                quantity=quantity,
                operation_id=operation.id if operation is not None else None,
                created_at=now,
            )
        )

    async def grant(
        self,
        *,
        organization_id: UUID,
        source_key: str,
        kind: CreditKind,
        quantity: int,
        expires_at: datetime | None = None,
        now: datetime | None = None,
    ) -> ReplyCreditGrant:
        now = now or datetime.now(UTC)
        if type(quantity) is not int or not 0 < quantity <= 2_147_483_647 or not source_key or len(source_key) > 255:
            raise bad_request("Invalid reply credit grant")
        if (kind == "trial") != (expires_at is not None):
            raise bad_request("Invalid reply credit expiry")
        await self._lock(organization_id)
        previous = await self.session.scalar(
            select(ReplyCreditGrant).where(
                ReplyCreditGrant.organization_id == organization_id,
                ReplyCreditGrant.source_key == source_key,
            )
        )
        if previous is not None:
            previous_expiry = utc(previous.expires_at) if previous.expires_at is not None else None
            requested_expiry = utc(expires_at) if expires_at is not None else None
            if previous.quantity != quantity or previous.kind != kind or previous_expiry != requested_expiry:
                raise conflict("Credit grant source was reused with different terms")
            return previous
        if expires_at is not None and utc(expires_at) <= utc(now):
            raise bad_request("Invalid reply credit expiry")
        grant = ReplyCreditGrant(
            organization_id=organization_id,
            source_key=source_key,
            kind=kind,
            quantity=quantity,
            available=quantity,
            reserved=0,
            consumed=0,
            expired=0,
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )
        self.session.add(grant)
        await self.session.flush()
        self._event(grant, "grant", quantity, now)
        await self.session.flush()
        return grant

    async def balance(self, *, organization_id: UUID, now: datetime | None = None) -> ReplyCreditBalance:
        now = now or datetime.now(UTC)
        trial = paid = reserved = consumed = expired = granted = 0
        trial_ends_at: datetime | None = None
        for grant in await self._grants(organization_id):
            ended = grant.expires_at is not None and utc(grant.expires_at) <= utc(now)
            if grant.kind == "trial":
                trial += 0 if ended else grant.available
                trial_ends_at = utc(grant.expires_at) if grant.expires_at is not None else None
            else:
                paid += grant.available
            reserved += grant.reserved
            consumed += grant.consumed
            expired += grant.expired + (grant.available if ended else 0)
            granted += grant.quantity
        return ReplyCreditBalance(trial, paid, reserved, consumed, expired, granted, trial_ends_at)

    async def paid_entitled(self, *, organization_id: UUID, now: datetime | None = None) -> bool:
        now = now or datetime.now(UTC)
        subscription = await self.session.scalar(select(Subscription).where(Subscription.organization_id == organization_id))
        # A locally created 'active' subscription with no provider is not payment proof.
        return bool(
            subscription is not None
            and subscription.status == "active"
            and subscription.provider
            and subscription.provider_subscription_id
            and subscription.current_period_start is not None
            and utc(subscription.current_period_start) <= utc(now)
            and subscription.current_period_end is not None
            and utc(now) < utc(subscription.current_period_end)
        )

    async def _expire(self, organization_id: UUID, now: datetime) -> None:
        for grant in await self._grants(organization_id):
            if grant.expires_at is not None and utc(grant.expires_at) <= utc(now) and grant.available:
                amount = grant.available
                grant.available = 0
                grant.expired += amount
                self._event(grant, "expire", amount, now)
        await self.session.flush()

    async def reserve(
        self,
        *,
        organization_id: UUID,
        operation_key: UUID,
        request_hash: str,
        paid_entitled: bool | None = None,
        now: datetime | None = None,
        lease_seconds: int = 300,
        operation_id: UUID | None = None,
    ) -> ReplyCreditOperation:
        now = now or datetime.now(UTC)
        if len(request_hash) != 64 or lease_seconds < 1:
            raise bad_request("Invalid credit reservation")
        await self._lock(organization_id)
        if paid_entitled is None:
            paid_entitled = await self.paid_entitled(organization_id=organization_id, now=now)
        await self._recover(organization_id, now)
        await self._expire(organization_id, now)
        previous = await self.session.scalar(
            select(ReplyCreditOperation)
            .where(
                ReplyCreditOperation.organization_id == organization_id,
                ReplyCreditOperation.operation_key == operation_key,
            )
            .execution_options(populate_existing=True)
        )
        if previous is not None:
            if previous.request_hash != request_hash:
                raise conflict("Generation key was reused with different input")
            return previous
        grants = await self._grants(organization_id)
        eligible = [grant for grant in grants if grant.available > 0 and (grant.kind == "trial" or paid_entitled)]
        # Expiring trial replies are spent before non-expiring paid replies.
        eligible.sort(key=lambda grant: (grant.kind != "trial", utc(grant.created_at), str(grant.id)))
        if not eligible:
            raise payment_required("No available replies: an active trial or paid subscription is required")
        grant = eligible[0]
        grant.available -= 1
        grant.reserved += 1
        operation = ReplyCreditOperation(
            id=operation_id or uuid4(),
            organization_id=organization_id,
            operation_key=operation_key,
            request_hash=request_hash,
            grant_id=grant.id,
            state="reserved",
            lease_expires_at=now + timedelta(seconds=lease_seconds),
        )
        self.session.add(operation)
        await self.session.flush()
        self._event(grant, "reserve", 1, now, operation)
        await self.session.flush()
        return operation

    async def _operation(self, organization_id: UUID, operation_id: UUID) -> ReplyCreditOperation:
        operation = await self.session.scalar(
            select(ReplyCreditOperation)
            .where(
                ReplyCreditOperation.organization_id == organization_id,
                ReplyCreditOperation.id == operation_id,
            )
            .execution_options(populate_existing=True)
        )
        if operation is None:
            raise not_found("Reply credit operation not found")
        return operation

    async def consume(self, *, organization_id: UUID, operation_id: UUID, draft_id: UUID, now: datetime | None = None) -> None:
        now = now or datetime.now(UTC)
        await self._lock(organization_id)
        operation = await self._operation(organization_id, operation_id)
        if operation.state == "completed" and operation.draft_id == draft_id:
            return
        if operation.state != "reserved" or utc(operation.lease_expires_at) <= utc(now):
            raise conflict("Reply generation reservation is no longer active")
        grant = next(grant for grant in await self._grants(organization_id) if grant.id == operation.grant_id)
        grant.reserved -= 1
        grant.consumed += 1
        operation.state, operation.draft_id = "completed", draft_id
        self._event(grant, "consume", 1, now, operation)
        await self.session.flush()

    async def release(self, *, organization_id: UUID, operation_id: UUID, reason: str, now: datetime | None = None) -> None:
        now = now or datetime.now(UTC)
        await self._lock(organization_id)
        operation = await self._operation(organization_id, operation_id)
        if operation.state != "reserved":
            return
        await self._release(operation, reason, now)
        await self._expire(organization_id, now)

    async def _release(self, operation: ReplyCreditOperation, reason: str, now: datetime) -> None:
        grant = next(grant for grant in await self._grants(operation.organization_id) if grant.id == operation.grant_id)
        grant.reserved -= 1
        grant.available += 1
        operation.state, operation.release_reason = "released", reason
        self._event(grant, "release", 1, now, operation)
        await self.session.flush()

    async def _recover(self, organization_id: UUID, now: datetime) -> int:
        operations = (
            await self.session.scalars(
                select(ReplyCreditOperation)
                .where(
                    ReplyCreditOperation.organization_id == organization_id,
                    ReplyCreditOperation.state == "reserved",
                    ReplyCreditOperation.lease_expires_at <= now,
                )
                .execution_options(populate_existing=True)
            )
        ).all()
        for operation in operations:
            await self._release(operation, "reservation_expired", now)
        return len(operations)

    async def recover_expired(self, *, organization_id: UUID, now: datetime | None = None) -> int:
        now = now or datetime.now(UTC)
        await self._lock(organization_id)
        count = await self._recover(organization_id, now)
        await self._expire(organization_id, now)
        return count


async def recover_due_credit_accounts(session: AsyncSession, *, now: datetime, limit: int = 25) -> int:
    """Owns a bounded maintenance transaction, including expiration without new requests."""
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("Credit recovery batch size must be between 1 and 100")
    due = select(ReplyCreditOperation.organization_id).where(
        ReplyCreditOperation.state == "reserved", ReplyCreditOperation.lease_expires_at <= now,
    ).union(select(ReplyCreditGrant.organization_id).where(
        ReplyCreditGrant.expires_at <= now, ReplyCreditGrant.available > 0,
    ))
    organizations = (await session.scalars(
        select(Organization.id).where(Organization.id.in_(due)).order_by(Organization.id)
        .with_for_update(skip_locked=True, key_share=True).limit(limit)
    )).all()
    service = ReplyCreditService(session)
    for organization_id in organizations:
        await service.recover_expired(organization_id=organization_id, now=now)
    await session.commit()
    return len(organizations)
