from __future__ import annotations

from collections.abc import Mapping
from typing import cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration_event import IntegrationEvent
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.models.sync_job import SyncJob
from app.models.user import User
from app.schemas.marketplace_overview import (
    MarketplaceAccountOverviewResponse,
    MarketplaceHealthStatus,
    MarketplaceIntegrationEventSummary,
    MarketplaceSyncJobSummary,
    MarketplaceSyncStateSummary,
)
from app.services.marketplace_account_service import MarketplaceAccountService

_SENSITIVE_METADATA_PARTS = (
    "credential",
    "secret",
    "token",
    "api_key",
    "authorization",
    "cursor",
    "client_id",
    "seller_id",
    "provider_body",
)


def extract_account_scopes(scopes_json: Mapping[str, object]) -> list[str]:
    value = scopes_json.get("scopes")
    if not isinstance(value, list):
        return []
    items = cast(list[object], value)
    return sorted({item for item in items if isinstance(item, str) and item.strip()})


def sanitize_integration_metadata(metadata: Mapping[str, object]) -> dict[str, object]:
    safe: dict[str, object] = {}
    for key, value in metadata.items():
        normalized_key = key.lower()
        if any(part in normalized_key for part in _SENSITIVE_METADATA_PARTS):
            continue
        if isinstance(value, dict):
            nested_items = cast(dict[object, object], value)
            nested = {nested_key: nested_value for nested_key, nested_value in nested_items.items() if isinstance(nested_key, str)}
            sanitized_nested = sanitize_integration_metadata(nested)
            if sanitized_nested:
                safe[key] = sanitized_nested
        elif isinstance(value, list):
            items = cast(list[object], value)
            safe[key] = [item for item in items if isinstance(item, (str, int, float, bool)) or item is None]
        elif isinstance(value, (str, int, float, bool)) or value is None:
            safe[key] = value
    return safe


def extract_sync_stats(stats_json: Mapping[str, object]) -> dict[str, int]:
    stats: dict[str, int] = {}
    for key, value in stats_json.items():
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            stats[key] = value
    return stats


def derive_marketplace_health(
    *,
    account_status: str,
    credentials_status: str,
    sync_states: list[MarketplaceSyncState],
    latest_job_status: str | None,
) -> tuple[MarketplaceHealthStatus, list[str]]:
    reasons: list[str] = []

    if account_status == "disabled" or credentials_status == "revoked":
        return "disabled", ["Подключение отключено или ключ отозван."]

    if credentials_status != "valid":
        reasons.append("API-ключ не прошёл проверку.")
    if account_status == "error":
        reasons.append("Подключение находится в состоянии ошибки.")

    failed_streams = [state.stream for state in sync_states if state.status == "error" or state.consecutive_failures > 0]
    if failed_streams:
        reasons.append(f"Ошибки синхронизации: {', '.join(sorted(failed_streams))}.")

    paused_streams = [state.stream for state in sync_states if state.status == "paused"]
    if paused_streams:
        reasons.append(f"Потоки приостановлены: {', '.join(sorted(paused_streams))}.")

    if latest_job_status == "failed":
        reasons.append("Последняя ручная синхронизация завершилась ошибкой.")

    if account_status == "error" or failed_streams:
        return "error", reasons
    if reasons or not sync_states:
        if not sync_states:
            reasons.append("Потоки синхронизации ещё не настроены.")
        return "attention", reasons
    return "healthy", ["Ключ проверен, потоки синхронизации работают без ошибок."]


class MarketplaceAccountOverviewService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.accounts = MarketplaceAccountService(session)

    async def get_overview(
        self,
        *,
        actor: User,
        account_id: UUID,
        jobs_limit: int,
        events_limit: int,
    ) -> MarketplaceAccountOverviewResponse:
        account = await self.accounts.get_account(actor=actor, account_id=account_id)

        states_result = await self.session.execute(
            select(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.marketplace_account_id == account.id,
                MarketplaceSyncState.organization_id == account.organization_id,
            )
            .order_by(MarketplaceSyncState.stream.asc())
        )
        sync_states = list(states_result.scalars().all())

        jobs_result = await self.session.execute(
            select(SyncJob)
            .where(
                SyncJob.marketplace_account_id == account.id,
                SyncJob.organization_id == account.organization_id,
            )
            .order_by(SyncJob.created_at.desc())
            .limit(jobs_limit)
        )
        jobs = list(jobs_result.scalars().all())

        events_result = await self.session.execute(
            select(IntegrationEvent)
            .where(
                IntegrationEvent.marketplace_account_id == account.id,
                IntegrationEvent.organization_id == account.organization_id,
            )
            .order_by(IntegrationEvent.created_at.desc())
            .limit(events_limit)
        )
        events = list(events_result.scalars().all())

        latest_job_status = jobs[0].status if jobs else None
        health_status, health_reasons = derive_marketplace_health(
            account_status=account.status,
            credentials_status=account.credentials_status,
            sync_states=sync_states,
            latest_job_status=latest_job_status,
        )

        return MarketplaceAccountOverviewResponse(
            account=self.accounts.to_response(account),
            health_status=health_status,
            health_reasons=health_reasons,
            scopes=extract_account_scopes(account.scopes_json or {}),
            sync_states=[self._sync_state_summary(state) for state in sync_states],
            recent_jobs=[self._job_summary(job) for job in jobs],
            recent_events=[self._event_summary(event) for event in events],
        )

    @staticmethod
    def _sync_state_summary(state: MarketplaceSyncState) -> MarketplaceSyncStateSummary:
        return MarketplaceSyncStateSummary(
            id=state.id,
            marketplace_account_id=state.marketplace_account_id,
            stream=state.stream,
            status=state.status,
            next_run_at=state.next_run_at,
            last_attempt_at=state.last_attempt_at,
            last_success_at=state.last_success_at,
            last_error_at=state.last_error_at,
            last_cycle_completed_at=state.last_cycle_completed_at,
            consecutive_failures=state.consecutive_failures,
        )

    @staticmethod
    def _job_summary(job: SyncJob) -> MarketplaceSyncJobSummary:
        return MarketplaceSyncJobSummary(
            id=job.id,
            job_type=job.job_type,
            status=job.status,
            started_at=job.started_at,
            finished_at=job.finished_at,
            error_message_safe=job.error_message,
            stats=extract_sync_stats(job.stats_json or {}),
            created_at=job.created_at,
        )

    @staticmethod
    def _event_summary(event: IntegrationEvent) -> MarketplaceIntegrationEventSummary:
        return MarketplaceIntegrationEventSummary(
            id=event.id,
            event_type=event.event_type,
            status=event.status,
            error_code=event.error_code,
            error_message_safe=event.error_message_safe,
            details=sanitize_integration_metadata(event.metadata_json or {}),
            created_at=event.created_at,
        )
