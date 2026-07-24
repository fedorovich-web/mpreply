from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.capabilities import get_marketplace_capability, scheduler_marketplaces
from app.core.config import get_settings
from app.core.errors import not_found
from app.models.enums import MarketplaceSyncStateStatus
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.models.user import User
from app.services.organization_service import OrganizationService

_READ_ROLES = {"owner", "admin", "manager", "viewer"}


@dataclass(frozen=True)
class MarketplaceSyncLease:
    state_id: UUID
    account_id: UUID
    stream: str
    lease_token: UUID


def retry_delay_seconds(consecutive_failures: int, *, base_seconds: int = 60, maximum_seconds: int = 3600) -> int:
    normalized_failures = max(1, consecutive_failures)
    return min(maximum_seconds, base_seconds * (2 ** (normalized_failures - 1)))


class MarketplaceSchedulerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organization_service = OrganizationService(session)
        self.settings = get_settings()

    async def ensure_account_states(
        self,
        *,
        account: MarketplaceAccount,
        activate: bool,
        now: datetime | None = None,
    ) -> list[MarketplaceSyncState]:
        capability = get_marketplace_capability(account.marketplace)
        if not capability.scheduler_enabled:
            return []
        current_time = now or datetime.now(UTC)
        result = await self.session.execute(
            select(MarketplaceSyncState).where(MarketplaceSyncState.marketplace_account_id == account.id)
        )
        existing = {state.stream: state for state in result.scalars().all()}
        states: list[MarketplaceSyncState] = []
        for stream in capability.sync_streams:
            state = existing.get(stream.value)
            if state is None:
                state = MarketplaceSyncState(
                    organization_id=account.organization_id,
                    marketplace_account_id=account.id,
                    stream=stream.value,
                    status=(
                        MarketplaceSyncStateStatus.IDLE.value
                        if activate
                        else MarketplaceSyncStateStatus.PAUSED.value
                    ),
                    next_run_at=current_time if activate else None,
                    metadata_json={},
                )
                self.session.add(state)
            elif activate:
                state.status = MarketplaceSyncStateStatus.IDLE.value
                state.next_run_at = state.next_run_at or current_time
                state.lease_token = None
                state.lease_expires_at = None
            states.append(state)
        await self.session.flush()
        return states

    async def pause_account_states(self, *, account_id: UUID) -> None:
        result = await self.session.execute(
            select(MarketplaceSyncState).where(MarketplaceSyncState.marketplace_account_id == account_id)
        )
        for state in result.scalars().all():
            state.status = MarketplaceSyncStateStatus.PAUSED.value
            state.next_run_at = None
            state.lease_token = None
            state.lease_expires_at = None
        await self.session.flush()

    async def list_account_states(self, *, actor: User, account_id: UUID) -> list[MarketplaceSyncState]:
        account_result = await self.session.execute(
            select(MarketplaceAccount).where(MarketplaceAccount.id == account_id)
        )
        account = account_result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        result = await self.session.execute(
            select(MarketplaceSyncState)
            .where(MarketplaceSyncState.marketplace_account_id == account.id)
            .order_by(MarketplaceSyncState.stream.asc())
        )
        return list(result.scalars().all())

    async def claim_due_states(
        self,
        *,
        now: datetime | None = None,
        limit: int | None = None,
    ) -> list[MarketplaceSyncLease]:
        current_time = now or datetime.now(UTC)
        claim_limit = limit or self.settings.scheduler_claim_limit
        lease_expires_at = current_time + timedelta(seconds=self.settings.scheduler_lease_seconds)
        result = await self.session.execute(
            select(MarketplaceSyncState)
            .join(MarketplaceAccount, MarketplaceAccount.id == MarketplaceSyncState.marketplace_account_id)
            .where(
                MarketplaceAccount.status == "active",
                MarketplaceAccount.credentials_status == "valid",
                MarketplaceAccount.marketplace.in_(scheduler_marketplaces()),
                MarketplaceSyncState.next_run_at.is_not(None),
                MarketplaceSyncState.next_run_at <= current_time,
                MarketplaceSyncState.status != MarketplaceSyncStateStatus.PAUSED.value,
                or_(
                    MarketplaceSyncState.lease_expires_at.is_(None),
                    MarketplaceSyncState.lease_expires_at <= current_time,
                ),
            )
            .order_by(MarketplaceSyncState.next_run_at.asc(), MarketplaceSyncState.id.asc())
            .with_for_update(skip_locked=True)
            .limit(claim_limit)
        )
        leases: list[MarketplaceSyncLease] = []
        for state in result.scalars().all():
            token = uuid4()
            state.status = MarketplaceSyncStateStatus.LEASED.value
            state.lease_token = token
            state.lease_expires_at = lease_expires_at
            state.last_attempt_at = current_time
            leases.append(
                MarketplaceSyncLease(
                    state_id=state.id,
                    account_id=state.marketplace_account_id,
                    stream=state.stream,
                    lease_token=token,
                )
            )
        await self.session.flush()
        return leases

    async def record_enqueued(self, *, lease: MarketplaceSyncLease, worker_message_id: str) -> None:
        result = await self.session.execute(
            select(MarketplaceSyncState).where(
                MarketplaceSyncState.id == lease.state_id,
                MarketplaceSyncState.lease_token == lease.lease_token,
            )
        )
        state = result.scalar_one_or_none()
        if state is None:
            return
        state.last_worker_message_id = worker_message_id
        await self.session.flush()

    async def record_enqueue_failure(
        self,
        *,
        lease: MarketplaceSyncLease,
        error_type: str,
        now: datetime | None = None,
    ) -> None:
        current_time = now or datetime.now(UTC)
        result = await self.session.execute(
            select(MarketplaceSyncState).where(
                MarketplaceSyncState.id == lease.state_id,
                MarketplaceSyncState.lease_token == lease.lease_token,
            )
        )
        state = result.scalar_one_or_none()
        if state is None:
            return
        state.consecutive_failures = int(state.consecutive_failures or 0) + 1
        state.status = MarketplaceSyncStateStatus.ERROR.value
        state.last_error_at = current_time
        state.next_run_at = current_time + timedelta(
            seconds=retry_delay_seconds(state.consecutive_failures)
        )
        state.lease_token = None
        state.lease_expires_at = None
        state.metadata_json = {**(state.metadata_json or {}), "enqueue_error_type": error_type}
        await self.session.flush()
