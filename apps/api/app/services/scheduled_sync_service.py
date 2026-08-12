from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.capabilities import get_marketplace_capability
from app.adapters.registry import get_marketplace_adapter
from app.adapters.yandex_market import YandexMarketAdapter
from app.automation.state_machine import ensure_message_transition
from app.core.config import get_settings
from app.core.security import CredentialService
from app.models.customer_message import CustomerMessage
from app.models.enums import (
    Marketplace,
    MarketplaceSyncStateStatus,
    MarketplaceSyncStream,
    MessageStatus,
    MessageType,
)
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.models.sync_job import SyncJob
from app.models.usage_event import UsageEvent
from app.services.audit_service import AuditService
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.marketplace_scheduler_service import retry_delay_seconds
from app.services.yandex_question_sync_policy import (
    YandexQuestionBackfillCheckpoint,
    advance_yandex_question_window,
    initialize_yandex_question_backfill,
    load_yandex_question_backfill,
    record_yandex_question_page,
    store_yandex_question_backfill,
)

_RETRYABLE_ERRORS = {"network_timeout", "network_error", "rate_limited", "marketplace_unavailable"}
_PAUSING_ERRORS = {
    "sync_cursor_cycle",
    "sync_page_limit_exceeded",
    "yandex_backfill_checkpoint_invalid",
}


@dataclass(frozen=True)
class ScheduledSyncResult:
    status: Literal["success", "failed", "paused", "stale"]
    retryable: bool = False
    error_code: str | None = None


@dataclass(frozen=True)
class ScheduledPageFetch:
    result: AdapterResult
    phase: Literal["backfill", "incremental"]
    checkpoint: YandexQuestionBackfillCheckpoint | None = None


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

        page_fetch = await self._fetch_scheduled_page(
            adapter=adapter,
            account=account,
            state=state,
            credential=credential,
            now=now,
        )
        fetch_result = page_fetch.result
        if not fetch_result.ok:
            return await self._record_failure(
                account=account,
                state=state,
                job=job,
                result=fetch_result,
                now=now,
            )

        historical_next_checkpoint: YandexQuestionBackfillCheckpoint | None = None
        if page_fetch.phase == "backfill":
            if page_fetch.checkpoint is None:
                return await self._record_failure(
                    account=account,
                    state=state,
                    job=job,
                    result=AdapterResult(
                        False,
                        error_code="yandex_backfill_checkpoint_invalid",
                        error_message_safe="Yandex question backfill checkpoint is invalid",
                    ),
                    now=now,
                )
            historical_next_checkpoint, pagination_failure = self._prepare_yandex_backfill_progress(
                checkpoint=page_fetch.checkpoint,
                next_cursor=fetch_result.next_cursor,
            )
            if pagination_failure is not None:
                return await self._record_failure(
                    account=account,
                    state=state,
                    job=job,
                    result=pagination_failure,
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
        state.status = MarketplaceSyncStateStatus.IDLE.value
        state.last_success_at = now
        state.last_error_at = None
        state.consecutive_failures = 0
        state.lease_token = None
        state.lease_expires_at = None
        if historical_next_checkpoint is not None:
            state.cursor = None
            state.metadata_json = store_yandex_question_backfill(
                state.metadata_json or {}, historical_next_checkpoint
            )
            if historical_next_checkpoint.completed:
                state.last_cycle_completed_at = now
                state.cycle_started_at = None
                state.next_run_at = now + timedelta(
                    seconds=self.settings.marketplace_sync_interval_seconds
                )
            else:
                state.next_run_at = now + timedelta(seconds=1)
        else:
            state.cursor = next_cursor
            if next_cursor is None:
                state.last_cycle_completed_at = now
                state.cycle_started_at = None
                state.next_run_at = now + timedelta(
                    seconds=self.settings.marketplace_sync_interval_seconds
                )
            else:
                state.next_run_at = now + timedelta(seconds=1)

        reconciliation_stats: dict[str, int] = {}
        if self._should_reconcile_open_yandex_questions(
            account=account,
            state=state,
            page_fetch=page_fetch,
            next_cursor=next_cursor,
            next_checkpoint=historical_next_checkpoint,
        ):
            reconciliation_stats = await self._reconcile_open_yandex_questions(
                account=account,
                adapter=cast(YandexMarketAdapter, adapter),
                credential=credential,
                now=now,
                limit=25,
            )

        account.last_success_sync_at = now
        account.status = "active"
        account.credentials_status = "valid"
        safe_cursor_before = None if page_fetch.phase == "backfill" else cursor_before
        safe_cursor_after = None if page_fetch.phase == "backfill" else next_cursor
        phase_metadata = self._phase_metadata(
            page_fetch=page_fetch,
            next_checkpoint=historical_next_checkpoint,
        )
        reconciliation_metadata = {
            f"reconciliation_{key.lower()}": value
            for key, value in reconciliation_stats.items()
        }
        job.status = "success"
        job.finished_at = now
        job.stats_json = {
            "stream": state.stream,
            "cursor_before": safe_cursor_before,
            "cursor_after": safe_cursor_after,
            "created": created,
            "updated": updated,
            "skipped": skipped,
            **phase_metadata,
            **reconciliation_metadata,
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
                "cursor_before": safe_cursor_before,
                "cursor_after": safe_cursor_after,
                "created": created,
                "updated": updated,
                "skipped": skipped,
                **phase_metadata,
            **reconciliation_metadata,
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
                "has_more": (
                    not historical_next_checkpoint.completed
                    if historical_next_checkpoint is not None
                    else next_cursor is not None
                ),
                **phase_metadata,
            **reconciliation_metadata,
            },
        )
        await self.session.flush()
        return ScheduledSyncResult(status="success")

    async def _fetch_scheduled_page(
        self,
        *,
        adapter: MarketplaceAdapter,
        account: MarketplaceAccount,
        state: MarketplaceSyncState,
        credential: str,
        now: datetime,
    ) -> ScheduledPageFetch:
        is_yandex_question = (
            account.marketplace == Marketplace.YANDEX_MARKET.value
            and state.stream == MarketplaceSyncStream.QUESTIONS.value
        )
        if not is_yandex_question:
            return ScheduledPageFetch(
                result=await self._fetch(
                    adapter=adapter,
                    stream=state.stream,
                    credential=credential,
                    cursor=state.cursor,
                    seller_id=account.seller_id,
                ),
                phase="incremental",
            )
        try:
            checkpoint = load_yandex_question_backfill(state.metadata_json or {})
        except ValueError:
            return ScheduledPageFetch(
                result=AdapterResult(
                    False,
                    error_code="yandex_backfill_checkpoint_invalid",
                    error_message_safe="Yandex question backfill checkpoint is invalid",
                ),
                phase="backfill",
            )
        if checkpoint is None:
            checkpoint = initialize_yandex_question_backfill(now)
            state.metadata_json = store_yandex_question_backfill(
                state.metadata_json or {}, checkpoint
            )
        if checkpoint.completed:
            return ScheduledPageFetch(
                result=await self._fetch(
                    adapter=adapter,
                    stream=state.stream,
                    credential=credential,
                    cursor=state.cursor,
                    seller_id=account.seller_id,
                ),
                phase="incremental",
            )
        yandex_adapter = cast(YandexMarketAdapter, adapter)
        result = await yandex_adapter.fetch_questions_window(
            credential,
            date_from=checkpoint.window.start,
            date_to=checkpoint.window.end,
            cursor=checkpoint.page_token,
            seller_id=account.seller_id,
        )
        return ScheduledPageFetch(result=result, phase="backfill", checkpoint=checkpoint)

    @staticmethod
    def _prepare_yandex_backfill_progress(
        *,
        checkpoint: YandexQuestionBackfillCheckpoint,
        next_cursor: str | None,
    ) -> tuple[YandexQuestionBackfillCheckpoint | None, AdapterResult | None]:
        try:
            page_checkpoint = record_yandex_question_page(checkpoint, next_cursor)
        except ValueError as exc:
            message = str(exc)
            if "page token repeated" in message:
                error_code = "sync_cursor_cycle"
                safe_message = "Yandex Market question pagination cursor repeated"
            elif "page limit exceeded" in message:
                error_code = "sync_page_limit_exceeded"
                safe_message = "Yandex Market question pagination exceeded the safe page limit"
            else:
                error_code = "yandex_backfill_checkpoint_invalid"
                safe_message = "Yandex question backfill checkpoint is invalid"
            return None, AdapterResult(
                False,
                error_code=error_code,
                error_message_safe=safe_message,
            )
        if next_cursor is None:
            page_checkpoint = advance_yandex_question_window(page_checkpoint)
        return page_checkpoint, None

    @staticmethod
    def _should_reconcile_open_yandex_questions(
        *,
        account: MarketplaceAccount,
        state: MarketplaceSyncState,
        page_fetch: ScheduledPageFetch,
        next_cursor: str | None,
        next_checkpoint: YandexQuestionBackfillCheckpoint | None,
    ) -> bool:
        if (
            account.marketplace != Marketplace.YANDEX_MARKET.value
            or state.stream != MarketplaceSyncStream.QUESTIONS.value
        ):
            return False
        if page_fetch.phase == "backfill":
            return next_checkpoint is not None and next_checkpoint.completed
        return next_cursor is None

    async def _reconcile_open_yandex_questions(
        self,
        *,
        account: MarketplaceAccount,
        adapter: YandexMarketAdapter,
        credential: str,
        now: datetime,
        limit: int = 25,
    ) -> dict[str, int]:
        cap = min(max(limit, 1), 25)
        result = await self.session.execute(
            select(CustomerMessage)
            .where(
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.marketplace == Marketplace.YANDEX_MARKET.value,
                CustomerMessage.type == MessageType.QUESTION.value,
                CustomerMessage.status == MessageStatus.NEEDS_REPLY.value,
            )
            .order_by(CustomerMessage.marketplace_created_at.asc(), CustomerMessage.id.asc())
            .limit(cap)
        )
        candidates = list(result.scalars().all())
        stats = {
            "processed": 0,
            "ABSENT": 0,
            "PUBLISHED": 0,
            "UNMODERATED": 0,
            "BANNED": 0,
            "DELETED": 0,
            "UNKNOWN": 0,
        }
        for message in candidates:
            if stats["processed"] >= cap:
                break
            if (
                message.marketplace_account_id != account.id
                or message.marketplace != Marketplace.YANDEX_MARKET.value
                or message.type != MessageType.QUESTION.value
                or message.status != MessageStatus.NEEDS_REPLY.value
            ):
                continue
            stats["processed"] += 1
            reconciliation = await adapter.reconcile_question_reply(
                credential,
                message.external_id,
                seller_id=account.seller_id,
            )
            state = "UNKNOWN"
            answer_id: str | None = None
            if reconciliation.ok and isinstance(reconciliation.data, dict):
                payload = cast(dict[str, object], reconciliation.data)
                raw_state = str(payload.get("state") or "UNKNOWN").upper()
                if raw_state in {
                    "ABSENT",
                    "PUBLISHED",
                    "UNMODERATED",
                    "BANNED",
                    "DELETED",
                    "UNKNOWN",
                }:
                    state = raw_state
                answer_id_value = payload.get("answer_id")
                answer_id = str(answer_id_value) if answer_id_value is not None else None
            stats[state] += 1
            message.metadata_json = {
                **(message.metadata_json or {}),
                "yandex_question_reconciliation": {
                    "state": state,
                    "answer_id": answer_id,
                    "checked_at": now.isoformat(),
                },
            }
            if state == "PUBLISHED":
                ensure_message_transition(message.status, MessageStatus.ANSWERED.value)
                message.status = MessageStatus.ANSWERED.value
            if not reconciliation.ok:
                break
        return stats

    @staticmethod
    def _phase_metadata(
        *,
        page_fetch: ScheduledPageFetch,
        next_checkpoint: YandexQuestionBackfillCheckpoint | None,
    ) -> dict[str, object]:
        metadata: dict[str, object] = {"sync_phase": page_fetch.phase}
        if page_fetch.phase != "backfill" or page_fetch.checkpoint is None:
            return metadata
        metadata.update(
            {
                "window_start": page_fetch.checkpoint.window.start.isoformat(),
                "window_end": page_fetch.checkpoint.window.end.isoformat(),
                "window_page_count": page_fetch.checkpoint.page_count + 1,
                "backfill_completed": bool(
                    next_checkpoint is not None and next_checkpoint.completed
                ),
            }
        )
        return metadata

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
        state.last_error_at = now
        if result.error_code in _PAUSING_ERRORS:
            state.status = MarketplaceSyncStateStatus.PAUSED.value
            state.next_run_at = None
        else:
            state.status = MarketplaceSyncStateStatus.ERROR.value
            retry_delay = result.retry_after_seconds or retry_delay_seconds(
                state.consecutive_failures
            )
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
            status=(
                "paused"
                if result.error_code in _PAUSING_ERRORS
                else "failed"
            ),
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
