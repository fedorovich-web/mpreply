from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.capabilities import get_marketplace_capability
from app.adapters.registry import get_marketplace_adapter
from app.core.config import get_settings
from app.core.security import CredentialService
from app.models.enums import MarketplaceSyncStateStatus, MarketplaceSyncStream
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.models.sync_job import SyncJob
from app.models.usage_event import UsageEvent
from app.services.audit_service import AuditService
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.marketplace_scheduler_service import retry_delay_seconds

_RETRYABLE_ERRORS = {"network_timeout", "network_error", "rate_limited", "marketplace_unavailable"}


@dataclass(frozen=True)
class ScheduledSyncResult:
    status: Literal["success", "failed", "paused", "stale"]
    retryable: bool = False
    error_code: str | None = None


class ScheduledMarketplaceSyncService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.ingest = MarketplaceMessageIngestService(session)
        self.settings = get_settings()
        self.credentials = CredentialService(self.settings.credentials_encryption_key.get_secret_value())

    async def execute(self, *, state_id: UUID, lease_token: UUID) -> ScheduledSyncResult:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(MarketplaceSyncState, MarketplaceAccount)
            .join(MarketplaceAccount, MarketplaceAccount.id == MarketplaceSyncState.marketplace_account_id)
            .where(MarketplaceSyncState.id == state_id)
        )
        row = result.first()
        if row is None:
            return ScheduledSyncResult(status="stale")
        state, account = row
        if (
            state.lease_token != lease_token
            or state.lease_expires_at is None
            or state.lease_expires_at <= now
        ):
            return ScheduledSyncResult(status="stale")
        capability = get_marketplace_capability(account.marketplace)
        supported_streams = {stream.value for stream in capability.sync_streams}
        if (
            account.status != "active"
            or account.credentials_status != "valid"
            or state.stream not in supported_streams
        ):
            self._pause_state(state)
            await self.session.flush()
            return ScheduledSyncResult(status="paused")

        adapter = get_marketplace_adapter(account.marketplace)
        credential = self.credentials.decrypt(account.credentials_encrypted)
        cursor_before = state.cursor
        if state.cycle_started_at is None:
            state.cycle_started_at = now
        job = SyncJob(
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            job_type=f"scheduled_{state.stream}",
            status="running",
            started_at=now,
            stats_json={"stream": state.stream, "cursor_before": cursor_before},
        )
        self.session.add(job)
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.credentials.used_for_scheduled_sync",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=None,
            entity_id=str(account.id),
            metadata={"stream": state.stream, "sync_job_id": str(job.id)},
        )

        fetch_result = await self._fetch(
            adapter=adapter,
            stream=state.stream,
            credential=credential,
            cursor=cursor_before,
            seller_id=account.seller_id,
        )
        if not fetch_result.ok:
            return await self._record_failure(
                account=account,
                state=state,
                job=job,
                result=fetch_result,
                now=now,
            )

        created = 0
        updated = 0
        skipped = 0
        for raw in self._extract(adapter=adapter, stream=state.stream, payload=fetch_result.data):
            normalized = self._normalize(adapter=adapter, stream=state.stream, raw=raw)
            outcome = await self.ingest.upsert_normalized_message(account, normalized)
            if outcome == "created":
                created += 1
            elif outcome == "updated":
                updated += 1
            else:
                skipped += 1

        next_cursor = fetch_result.next_cursor
        state.cursor = next_cursor
        state.status = MarketplaceSyncStateStatus.IDLE.value
        state.last_success_at = now
        state.last_error_at = None
        state.consecutive_failures = 0
        state.lease_token = None
        state.lease_expires_at = None
        if next_cursor is None:
            state.last_cycle_completed_at = now
            state.cycle_started_at = None
            state.next_run_at = now + timedelta(seconds=self.settings.marketplace_sync_interval_seconds)
        else:
            state.next_run_at = now + timedelta(seconds=1)

        account.last_success_sync_at = now
        account.status = "active"
        account.credentials_status = "valid"
        job.status = "success"
        job.finished_at = now
        job.stats_json = {
            "stream": state.stream,
            "cursor_before": cursor_before,
            "cursor_after": next_cursor,
            "created": created,
            "updated": updated,
            "skipped": skipped,
        }
        if created > 0:
            self.session.add(
                UsageEvent(
                    organization_id=account.organization_id,
                    user_id=None,
                    event_type="marketplace.messages_imported",
                    quantity=created,
                    metadata_json={
                        "marketplace": account.marketplace,
                        "marketplace_account_id": str(account.id),
                        "sync_job_id": str(job.id),
                        "stream": state.stream,
                    },
                )
            )
        await self._write_integration_event(
            account=account,
            event_type=f"sync.{state.stream}.page",
            status="success",
            metadata={
                "sync_job_id": str(job.id),
                "cursor_before": cursor_before,
                "cursor_after": next_cursor,
                "created": created,
                "updated": updated,
                "skipped": skipped,
            },
        )
        await self.audit.write(
            action="marketplace_account.scheduled_sync.finished",
            entity_type="sync_job",
            organization_id=account.organization_id,
            actor_user_id=None,
            entity_id=str(job.id),
            metadata={
                "marketplace_account_id": str(account.id),
                "stream": state.stream,
                "status": "success",
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "has_more": next_cursor is not None,
            },
        )
        await self.session.flush()
        return ScheduledSyncResult(status="success")

    async def _record_failure(
        self,
        *,
        account: MarketplaceAccount,
        state: MarketplaceSyncState,
        job: SyncJob,
        result: AdapterResult,
        now: datetime,
    ) -> ScheduledSyncResult:
        state.consecutive_failures = int(state.consecutive_failures or 0) + 1
        state.status = MarketplaceSyncStateStatus.ERROR.value
        state.last_error_at = now
        retry_delay = result.retry_after_seconds or retry_delay_seconds(state.consecutive_failures)
        state.next_run_at = now + timedelta(seconds=min(max(retry_delay, 1), 3600))
        state.lease_token = None
        state.lease_expires_at = None
        account.last_error_sync_at = now
        account.error_count = int(account.error_count or 0) + 1
        if result.error_code in {"invalid_credentials", "insufficient_scope"}:
            account.status = "error"
            account.credentials_status = result.error_code
        job.status = "failed"
        job.finished_at = now
        job.error_message = result.error_message_safe
        job.stats_json = {
            "stream": state.stream,
            "cursor_before": state.cursor,
            "error_code": result.error_code,
        }
        await self._write_integration_event(
            account=account,
            event_type=f"sync.{state.stream}.page",
            status="failed",
            error_code=result.error_code,
            error_message_safe=result.error_message_safe,
            metadata={"sync_job_id": str(job.id), "cursor": state.cursor},
        )
        await self.audit.write(
            action="marketplace_account.scheduled_sync.failed",
            entity_type="sync_job",
            organization_id=account.organization_id,
            actor_user_id=None,
            entity_id=str(job.id),
            metadata={
                "marketplace_account_id": str(account.id),
                "stream": state.stream,
                "error_code": result.error_code,
                "consecutive_failures": state.consecutive_failures,
            },
        )
        await self.session.flush()
        return ScheduledSyncResult(
            status="failed",
            retryable=result.error_code in _RETRYABLE_ERRORS,
            error_code=result.error_code,
        )

    @staticmethod
    async def _fetch(
        *,
        adapter: MarketplaceAdapter,
        stream: str,
        credential: str,
        cursor: str | None,
        seller_id: str | None,
    ) -> AdapterResult:
        if stream == MarketplaceSyncStream.REVIEWS.value:
            return await adapter.fetch_reviews(credential=credential, cursor=cursor, seller_id=seller_id)
        if stream == MarketplaceSyncStream.QUESTIONS.value:
            return await adapter.fetch_questions(credential=credential, cursor=cursor, seller_id=seller_id)
        return AdapterResult(False, error_code="unsupported_sync_stream", error_message_safe="Unsupported sync stream")

    @staticmethod
    def _extract(
        *,
        adapter: MarketplaceAdapter,
        stream: str,
        payload: object | None,
    ) -> list[dict[str, object]]:
        if stream == MarketplaceSyncStream.REVIEWS.value:
            return adapter.extract_reviews(payload)
        if stream == MarketplaceSyncStream.QUESTIONS.value:
            return adapter.extract_questions(payload)
        return []

    @staticmethod
    def _normalize(
        *,
        adapter: MarketplaceAdapter,
        stream: str,
        raw: dict[str, object],
    ) -> dict[str, object]:
        if stream == MarketplaceSyncStream.REVIEWS.value:
            return adapter.normalize_review(raw)
        return adapter.normalize_question(raw)

    @staticmethod
    def _pause_state(state: MarketplaceSyncState) -> None:
        state.status = MarketplaceSyncStateStatus.PAUSED.value
        state.next_run_at = None
        state.lease_token = None
        state.lease_expires_at = None

    async def _write_integration_event(
        self,
        *,
        account: MarketplaceAccount,
        event_type: str,
        status: str,
        error_code: str | None = None,
        error_message_safe: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> None:
        self.session.add(
            IntegrationEvent(
                organization_id=account.organization_id,
                marketplace_account_id=account.id,
                marketplace=account.marketplace,
                event_type=event_type,
                status=status,
                error_code=error_code,
                error_message_safe=error_message_safe,
                metadata_json=metadata or {},
            )
        )
        await self.session.flush()
