from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.capabilities import MarketplaceStream, streams_for_scopes
from app.adapters.registry import MarketplaceAdapterRegistry, UnsupportedCapabilityError
from app.core.errors import bad_request, forbidden, not_found
from app.models.enums import Marketplace
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus
from app.models.sync_job import SyncJob
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService
from app.services.scheduled_sync_service import ScheduledSyncService, StreamRunResult

_ALLOWED_SYNC_ROLES = {"owner", "admin", "manager"}


@dataclass
class SyncStats:
    imported_reviews: int = 0
    imported_questions: int = 0
    updated_reviews: int = 0
    updated_questions: int = 0
    skipped: int = 0

    def as_dict(self) -> dict[str, object]:
        return {
            "imported_reviews": self.imported_reviews,
            "imported_questions": self.imported_questions,
            "updated_reviews": self.updated_reviews,
            "updated_questions": self.updated_questions,
            "skipped": self.skipped,
        }


class MarketplaceSyncService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        registry: MarketplaceAdapterRegistry,
        runner: ScheduledSyncService | None = None,
    ) -> None:
        self.session = session
        self.organization_service = OrganizationService(session)
        self.audit = AuditService(session)
        self.registry = registry
        self.runner = runner

    async def request_sync(
        self,
        *,
        actor: User,
        account_id: UUID,
    ) -> tuple[MarketplaceAccount, SyncStats, str | None, str | None]:
        account = await self._get_account(account_id)
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_SYNC_ROLES,
        )
        if account.status != "active" or account.credentials_status != "valid":
            raise bad_request("Marketplace account is not available for sync")
        try:
            marketplace = Marketplace(account.marketplace)
        except ValueError:
            raise forbidden("Marketplace adapter is not enabled yet") from None
        registry = self.registry
        try:
            capability = registry.capability(marketplace)
            if capability.streams & {MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}:
                registry.review_questions(marketplace)
            else:
                raise UnsupportedCapabilityError(marketplace, capability.streams)
        except UnsupportedCapabilityError:
            raise forbidden("Marketplace adapter is not enabled yet") from None

        now = datetime.now(UTC)
        job = SyncJob(
            id=uuid4(),
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            job_type="manual_sync",
            status="running",
            started_at=now,
            stats_json={},
        )
        self.session.add(job)
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.credentials.used_for_sync",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={"marketplace": account.marketplace, "sync_job_id": str(job.id)},
        )
        supported_streams = streams_for_scopes(
            capability.streams,
            account.scopes_json or {},
        )
        if not supported_streams:
            raise forbidden("Marketplace account has no validated synchronization scope")
        states = await self._ensure_states(account, supported_streams, now)
        await self.session.commit()

        runner = self.runner or ScheduledSyncService(self.session, registry=registry)
        owner = f"manual-sync:{job.id}"
        results = [await runner.run_stream(state.id, owner, now) for state in states]
        stats = _sync_stats(results)
        first_failure = next((result for result in results if result.error_code is not None), None)
        error_code = first_failure.error_code if first_failure is not None else None
        error_message_safe = "Marketplace synchronization failed" if first_failure is not None else None

        for result in results:
            stream_name = result.stream.value if result.stream is not None else "unknown"
            await self._write_integration_event(
                account=account,
                event_type=f"sync.{stream_name}",
                status="success" if result.completed else "failed",
                error_code=result.error_code,
                error_message_safe=(
                    None if result.error_code is None else "Marketplace synchronization failed"
                ),
                metadata={
                    "created_messages": result.created_messages,
                    "updated_messages": result.updated_messages,
                },
            )

        finished_at = datetime.now(UTC)
        if error_code is not None:
            job.status = "failed"
            job.error_message = error_message_safe
            account.last_error_sync_at = finished_at
            account.error_count = int(account.error_count or 0) + 1
        else:
            job.status = "success"
            account.last_success_sync_at = finished_at
            account.status = "active"
            account.credentials_status = "valid"
        job.finished_at = finished_at
        job.stats_json = stats.as_dict()
        imported_total = stats.imported_reviews + stats.imported_questions
        if imported_total > 0:
            self.session.add(
                UsageEvent(
                    organization_id=account.organization_id,
                    user_id=actor.id,
                    event_type="marketplace.messages_imported",
                    quantity=imported_total,
                    metadata_json={
                        "marketplace": account.marketplace,
                        "marketplace_account_id": str(account.id),
                        "sync_job_id": str(job.id),
                        "imported_reviews": stats.imported_reviews,
                        "imported_questions": stats.imported_questions,
                    },
                )
            )
        await self.audit.write(
            action="marketplace_account.sync.finished",
            entity_type="sync_job",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(job.id),
            metadata={
                "marketplace_account_id": str(account.id),
                "status": job.status,
                **stats.as_dict(),
            },
        )
        await self.session.flush()
        return account, stats, error_code, error_message_safe

    async def _ensure_states(
        self,
        account: MarketplaceAccount,
        supported_streams: frozenset[MarketplaceStream],
        now: datetime,
    ) -> list[MarketplaceSyncState]:
        ordered_streams = sorted(supported_streams, key=lambda stream: stream.value)
        result = await self.session.execute(
            select(MarketplaceSyncState).where(
                MarketplaceSyncState.marketplace_account_id == account.id,
                MarketplaceSyncState.organization_id == account.organization_id,
                MarketplaceSyncState.stream.in_([stream.value for stream in ordered_streams]),
            )
        )
        existing = {state.stream: state for state in result.scalars().all()}
        missing = [stream for stream in ordered_streams if stream.value not in existing]
        for stream in missing:
            await self.session.execute(
                pg_insert(MarketplaceSyncState)
                .values(
                    id=uuid4(),
                    organization_id=account.organization_id,
                    marketplace_account_id=account.id,
                    stream=stream.value,
                    status=SyncStateStatus.IDLE.value,
                    cursor=None,
                    metadata_json={},
                    next_run_at=now,
                    consecutive_failures=0,
                    created_at=now,
                    updated_at=now,
                )
                .on_conflict_do_nothing(
                    constraint="uq_marketplace_sync_states_account_stream"
                )
            )
        if missing:
            result = await self.session.execute(
                select(MarketplaceSyncState).where(
                    MarketplaceSyncState.marketplace_account_id == account.id,
                    MarketplaceSyncState.organization_id == account.organization_id,
                    MarketplaceSyncState.stream.in_([stream.value for stream in ordered_streams]),
                )
            )
            existing = {state.stream: state for state in result.scalars().all()}
        if len(existing) != len(ordered_streams):
            raise RuntimeError("marketplace sync states could not be initialized")
        return [existing[stream.value] for stream in ordered_streams]

    async def _get_account(self, account_id: UUID) -> MarketplaceAccount:
        result = await self.session.execute(
            select(MarketplaceAccount).where(MarketplaceAccount.id == account_id)
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        return account

    async def _write_integration_event(
        self,
        *,
        account: MarketplaceAccount,
        event_type: str,
        status: str,
        error_code: str | None = None,
        error_message_safe: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> IntegrationEvent:
        event = IntegrationEvent(
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            marketplace=account.marketplace,
            event_type=event_type,
            status=status,
            error_code=error_code,
            error_message_safe=error_message_safe,
            metadata_json=metadata or {},
        )
        self.session.add(event)
        await self.session.flush()
        return event


def _sync_stats(results: list[StreamRunResult]) -> SyncStats:
    stats = SyncStats()
    for result in results:
        if not result.acquired:
            stats.skipped += 1
        elif result.stream is MarketplaceStream.REVIEWS:
            stats.imported_reviews += result.created_messages
            stats.updated_reviews += result.updated_messages
        elif result.stream is MarketplaceStream.QUESTIONS:
            stats.imported_questions += result.created_messages
            stats.updated_questions += result.updated_messages
    return stats
