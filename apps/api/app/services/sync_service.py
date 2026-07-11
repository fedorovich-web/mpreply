from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.wildberries import WildberriesAdapter
from app.core.config import get_settings
from app.core.errors import bad_request, forbidden, not_found
from app.core.security import CredentialService
from app.models.customer_message import CustomerMessage
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product
from app.models.sync_job import SyncJob
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.services.audit_service import AuditService
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
                    outcome = await self._upsert_normalized_message(account, normalized)
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
                    outcome = await self._upsert_normalized_message(account, normalized)
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

    def _adapter_for(self, marketplace: str) -> WildberriesAdapter:
        if marketplace == "wildberries":
            return WildberriesAdapter()
        raise forbidden("Marketplace adapter is not enabled yet")

    async def _upsert_normalized_message(self, account: MarketplaceAccount, normalized: dict[str, Any]) -> str:
        if not normalized.get("external_id") or not normalized.get("customer_text"):
            return "skipped"
        now = datetime.now(UTC)
        product = await self._upsert_product(account, normalized["product"])
        result = await self.session.execute(
            select(CustomerMessage).where(
                CustomerMessage.organization_id == account.organization_id,
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.marketplace == account.marketplace,
                CustomerMessage.external_id == normalized["external_id"],
                CustomerMessage.type == normalized["type"],
            )
        )
        message = result.scalar_one_or_none()
        if message is None:
            message = CustomerMessage(
                organization_id=account.organization_id,
                marketplace_account_id=account.id,
                product_id=product.id,
                marketplace=account.marketplace,
                external_id=normalized["external_id"],
                type=normalized["type"],
                status=normalized["status"],
                rating=normalized.get("rating"),
                customer_display_name=normalized.get("customer_display_name"),
                customer_text=normalized["customer_text"],
                customer_photos_json=normalized.get("customer_photos_json") or [],
                marketplace_created_at=normalized["marketplace_created_at"],
                imported_at=now,
                last_synced_at=now,
                priority=self._priority_for(normalized),
                metadata_json=normalized.get("metadata_json") or {},
            )
            self.session.add(message)
            await self.session.flush()
            return "created"
        message.product_id = product.id
        message.rating = normalized.get("rating")
        message.customer_display_name = normalized.get("customer_display_name")
        message.customer_text = normalized["customer_text"]
        message.customer_photos_json = normalized.get("customer_photos_json") or []
        message.last_synced_at = now
        message.metadata_json = {**(message.metadata_json or {}), **(normalized.get("metadata_json") or {})}
        await self.session.flush()
        return "updated"

    async def _upsert_product(self, account: MarketplaceAccount, product_payload: dict[str, Any]) -> Product:
        external_id = product_payload.get("external_id") or "unknown"
        result = await self.session.execute(
            select(Product).where(
                Product.organization_id == account.organization_id,
                Product.marketplace_account_id == account.id,
                Product.external_id == external_id,
            )
        )
        product = result.scalar_one_or_none()
        if product is None:
            product = Product(
                organization_id=account.organization_id,
                marketplace_account_id=account.id,
                marketplace=account.marketplace,
                external_id=external_id,
                sku=product_payload.get("sku"),
                name=product_payload.get("name") or "Wildberries product",
                brand=product_payload.get("brand"),
                category=product_payload.get("category"),
                image_url=product_payload.get("image_url"),
                product_url=product_payload.get("product_url"),
                metadata_json=product_payload.get("metadata_json") or {},
            )
            self.session.add(product)
            await self.session.flush()
            return product
        product.sku = product_payload.get("sku")
        product.name = product_payload.get("name") or product.name
        product.brand = product_payload.get("brand")
        product.category = product_payload.get("category")
        product.image_url = product_payload.get("image_url")
        product.product_url = product_payload.get("product_url")
        product.metadata_json = {**(product.metadata_json or {}), **(product_payload.get("metadata_json") or {})}
        await self.session.flush()
        return product

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

    @staticmethod
    def _priority_for(normalized: dict[str, Any]) -> str:
        rating = normalized.get("rating")
        if rating is not None and rating <= 2:
            return "high"
        return "normal"
