from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import MarketplaceAdapter
from app.adapters.registry import get_marketplace_adapter
from app.core.config import get_settings
from app.core.errors import bad_request, not_found
from app.core.security import CredentialService
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.sync_job import SyncJob
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.organization_service import OrganizationService

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
            reviews_result = await adapter.fetch_reviews(credential=credential)
            if reviews_result.ok:
                for raw in adapter.extract_reviews(reviews_result.data):
                    normalized = adapter.normalize_review(raw)
                    outcome = await self.ingest.upsert_normalized_message(account, normalized)
                    if outcome == "created":
                        stats.imported_reviews += 1
                    elif outcome == "updated":
                        stats.updated_reviews += 1
                    else:
                        stats.skipped += 1
                await self._write_integration_event(
                    account=account,
                    event_type="sync.feedbacks",
                    status="success",
                    metadata={"count": stats.imported_reviews + stats.updated_reviews},
                )
            else:
                error_code = reviews_result.error_code
                error_message_safe = reviews_result.error_message_safe
                await self._write_integration_event(
                    account=account,
                    event_type="sync.feedbacks",
                    status="failed",
                    error_code=reviews_result.error_code,
                    error_message_safe=reviews_result.error_message_safe,
                )

            questions_result = await adapter.fetch_questions(credential=credential)
            if questions_result.ok:
                for raw in adapter.extract_questions(questions_result.data):
                    normalized = adapter.normalize_question(raw)
                    outcome = await self.ingest.upsert_normalized_message(account, normalized)
                    if outcome == "created":
                        stats.imported_questions += 1
                    elif outcome == "updated":
                        stats.updated_questions += 1
                    else:
                        stats.skipped += 1
                await self._write_integration_event(
                    account=account,
                    event_type="sync.questions",
                    status="success",
                    metadata={"count": stats.imported_questions + stats.updated_questions},
                )
            else:
                error_code = error_code or questions_result.error_code
                error_message_safe = error_message_safe or questions_result.error_message_safe
                await self._write_integration_event(
                    account=account,
                    event_type="sync.questions",
                    status="failed",
                    error_code=questions_result.error_code,
                    error_message_safe=questions_result.error_message_safe,
                )

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
