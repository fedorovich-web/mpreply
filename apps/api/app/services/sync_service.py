from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.capabilities import get_marketplace_capability
from app.adapters.registry import get_marketplace_adapter
from app.core.config import get_settings
from app.core.errors import bad_request, not_found
from app.core.security import CredentialService
from app.models.enums import MarketplaceSyncStream
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.sync_job import SyncJob
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.marketplace_scheduler_service import account_sync_streams
from app.services.organization_service import OrganizationService

_ALLOWED_SYNC_ROLES = {"owner", "admin", "manager"}
_MAX_MANUAL_SYNC_PAGES_PER_STREAM = 100


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


@dataclass(frozen=True)
class StreamSyncOutcome:
    error_code: str | None = None
    error_message_safe: str | None = None


class MarketplaceSyncService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organization_service = OrganizationService(session)
        self.audit = AuditService(session)
        self.ingest = MarketplaceMessageIngestService(session)
        settings = get_settings()
        self.credentials = CredentialService(settings.credentials_encryption_key.get_secret_value())

    async def sync_account(self, *, actor: User, account_id: UUID) -> tuple[MarketplaceAccount, SyncStats, str | None, str | None]:
        account = await self._get_account(account_id)
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_SYNC_ROLES,
        )
        if account.status not in {"active", "pending_validation", "error"}:
            raise bad_request("Marketplace account is not available for sync")
        capability = get_marketplace_capability(account.marketplace)
        if not capability.sync_streams:
            raise bad_request("Marketplace does not support message sync")
        streams = tuple(
            stream for stream in account_sync_streams(account, capability) if stream in capability.sync_streams
        )
        if not streams:
            raise bad_request("Marketplace account does not have a validated message sync stream")
        adapter = self._adapter_for(account.marketplace)
        credential = self.credentials.decrypt(account.credentials_encrypted)
        now = datetime.now(UTC)
        job = SyncJob(
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

        stats = SyncStats()
        error_code: str | None = None
        error_message_safe: str | None = None
        try:
            for stream in streams:
                outcome = await self._sync_stream_pages(
                    account=account,
                    adapter=adapter,
                    credential=credential,
                    stream=stream,
                    stats=stats,
                )
                if outcome.error_code is not None and error_code is None:
                    error_code = outcome.error_code
                    error_message_safe = outcome.error_message_safe

            if error_code:
                job.status = "failed"
                job.error_message = error_message_safe
                account.last_error_sync_at = datetime.now(UTC)
                account.error_count = int(account.error_count or 0) + 1
            else:
                job.status = "success"
                account.last_success_sync_at = datetime.now(UTC)
                account.status = "active"
                account.credentials_status = "valid"
            job.finished_at = datetime.now(UTC)
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
                metadata={"marketplace_account_id": str(account.id), "status": job.status, **stats.as_dict()},
            )
            await self.session.flush()
            return account, stats, error_code, error_message_safe
        except Exception as exc:
            job.status = "failed"
            job.finished_at = datetime.now(UTC)
            job.error_message = "Sync failed unexpectedly"
            account.last_error_sync_at = datetime.now(UTC)
            account.error_count = int(account.error_count or 0) + 1
            await self._write_integration_event(
                account=account,
                event_type="sync.unhandled_error",
                status="failed",
                error_code="sync_unhandled_error",
                error_message_safe="Sync failed unexpectedly",
                metadata={"error_type": type(exc).__name__},
            )
            await self.session.flush()
            return account, stats, "sync_unhandled_error", "Sync failed unexpectedly"

    async def _sync_stream_pages(
        self,
        *,
        account: MarketplaceAccount,
        adapter: MarketplaceAdapter,
        credential: str,
        stream: MarketplaceSyncStream,
        stats: SyncStats,
    ) -> StreamSyncOutcome:
        cursor: str | None = None
        seen_cursors: set[str] = set()
        processed_pages = 0
        event_type = "sync.feedbacks" if stream is MarketplaceSyncStream.REVIEWS else "sync.questions"

        while processed_pages < _MAX_MANUAL_SYNC_PAGES_PER_STREAM:
            result = await self._fetch_stream(
                adapter=adapter,
                stream=stream,
                credential=credential,
                cursor=cursor,
                seller_id=account.seller_id,
            )
            processed_pages += 1
            if not result.ok:
                await self._write_integration_event(
                    account=account,
                    event_type=event_type,
                    status="failed",
                    error_code=result.error_code,
                    error_message_safe=result.error_message_safe,
                    metadata={"pages_processed": processed_pages, "cursor": cursor},
                )
                return StreamSyncOutcome(result.error_code, result.error_message_safe)

            await self._ingest_page(account=account, adapter=adapter, stream=stream, result=result, stats=stats)
            next_cursor = result.next_cursor
            if next_cursor is None:
                await self._write_integration_event(
                    account=account,
                    event_type=event_type,
                    status="success",
                    metadata={"count": self._stream_total(stats, stream), "pages_processed": processed_pages},
                )
                return StreamSyncOutcome()
            if next_cursor == cursor or next_cursor in seen_cursors:
                return await self._record_pagination_failure(
                    account=account,
                    event_type=event_type,
                    error_code="sync_cursor_cycle",
                    error_message_safe="Marketplace pagination cursor repeated",
                    pages_processed=processed_pages,
                    cursor=next_cursor,
                )
            seen_cursors.add(next_cursor)
            cursor = next_cursor

        return await self._record_pagination_failure(
            account=account,
            event_type=event_type,
            error_code="sync_page_limit_exceeded",
            error_message_safe="Marketplace pagination exceeded the safe page limit",
            pages_processed=processed_pages,
            cursor=cursor,
        )

    async def _ingest_page(
        self,
        *,
        account: MarketplaceAccount,
        adapter: MarketplaceAdapter,
        stream: MarketplaceSyncStream,
        result: AdapterResult,
        stats: SyncStats,
    ) -> None:
        raw_items = (
            adapter.extract_reviews(result.data)
            if stream is MarketplaceSyncStream.REVIEWS
            else adapter.extract_questions(result.data)
        )
        for raw in raw_items:
            normalized = (
                adapter.normalize_review(raw)
                if stream is MarketplaceSyncStream.REVIEWS
                else adapter.normalize_question(raw)
            )
            outcome = await self.ingest.upsert_normalized_message(account, normalized)
            if outcome == "created":
                if stream is MarketplaceSyncStream.REVIEWS:
                    stats.imported_reviews += 1
                else:
                    stats.imported_questions += 1
            elif outcome == "updated":
                if stream is MarketplaceSyncStream.REVIEWS:
                    stats.updated_reviews += 1
                else:
                    stats.updated_questions += 1
            else:
                stats.skipped += 1

    async def _record_pagination_failure(
        self,
        *,
        account: MarketplaceAccount,
        event_type: str,
        error_code: str,
        error_message_safe: str,
        pages_processed: int,
        cursor: str | None,
    ) -> StreamSyncOutcome:
        await self._write_integration_event(
            account=account,
            event_type=event_type,
            status="failed",
            error_code=error_code,
            error_message_safe=error_message_safe,
            metadata={"pages_processed": pages_processed, "cursor": cursor},
        )
        return StreamSyncOutcome(error_code, error_message_safe)

    @staticmethod
    async def _fetch_stream(
        *,
        adapter: MarketplaceAdapter,
        stream: MarketplaceSyncStream,
        credential: str,
        cursor: str | None,
        seller_id: str | None,
    ) -> AdapterResult:
        if stream is MarketplaceSyncStream.REVIEWS:
            return await adapter.fetch_reviews(credential=credential, cursor=cursor, seller_id=seller_id)
        return await adapter.fetch_questions(credential=credential, cursor=cursor, seller_id=seller_id)

    @staticmethod
    def _stream_total(stats: SyncStats, stream: MarketplaceSyncStream) -> int:
        if stream is MarketplaceSyncStream.REVIEWS:
            return stats.imported_reviews + stats.updated_reviews
        return stats.imported_questions + stats.updated_questions

    async def _get_account(self, account_id: UUID) -> MarketplaceAccount:
        result = await self.session.execute(select(MarketplaceAccount).where(MarketplaceAccount.id == account_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        return account

    def _adapter_for(self, marketplace: str) -> MarketplaceAdapter:
        return get_marketplace_adapter(marketplace)

    async def _write_integration_event(
        self,
        *,
        account: MarketplaceAccount,
        event_type: str,
        status: str,
        error_code: str | None = None,
        error_message_safe: str | None = None,
        metadata: dict[str, Any] | None = None,
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
