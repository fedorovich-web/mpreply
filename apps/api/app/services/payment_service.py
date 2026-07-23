from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import bad_request, conflict, forbidden, not_found
from app.models.answer_package import AnswerPackage
from app.models.enums import AnswerGrantSource, AnswerPackageKind, PaymentOrderStatus, PaymentWebhookStatus
from app.models.payment_order import PaymentOrder
from app.models.payment_refund import PaymentRefund
from app.models.payment_webhook_event import PaymentWebhookEvent
from app.models.user import User
from app.providers.yookassa import (
    YooKassaNotification,
    YooKassaPayment,
    YooKassaProvider,
    YooKassaProviderError,
    is_allowed_source_ip,
    parse_notification,
    resolve_source_ip,
)
from app.services.answer_entitlement_service import AnswerEntitlementService
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService

_PAYMENT_WRITE_ROLES = {"owner", "admin"}
_PAYMENT_READ_ROLES = {"owner", "admin", "manager", "viewer"}


@dataclass(frozen=True)
class WebhookResult:
    status: str


class PaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()
        self.organizations = OrganizationService(session)
        self.entitlements = AnswerEntitlementService(session)
        self.audit = AuditService(session)

    def provider(self) -> YooKassaProvider:
        if self.settings.payment_provider != "yookassa":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment provider is disabled",
            )
        return YooKassaProvider(
            shop_id=self.settings.yookassa_shop_id.get_secret_value(),
            secret_key=self.settings.yookassa_secret_key.get_secret_value(),
            base_url=self.settings.yookassa_api_base_url,
            timeout_seconds=self.settings.payment_provider_timeout_seconds,
        )

    async def create_order(
        self,
        *,
        actor: User,
        organization_id: UUID,
        package_code: str,
        idempotency_key: str,
    ) -> PaymentOrder:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_PAYMENT_WRITE_ROLES,
        )
        normalized_key = idempotency_key.strip()
        if not normalized_key or len(normalized_key) > 64:
            raise bad_request("Idempotency-Key must contain between 1 and 64 characters")
        await self._advisory_lock(f"payment-order:{organization_id}:{normalized_key}")
        existing_result = await self.session.execute(
            select(PaymentOrder).where(
                PaymentOrder.organization_id == organization_id,
                PaymentOrder.idempotency_key == normalized_key,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            if existing.package_code != package_code:
                raise conflict("Idempotency-Key is already used for a different package")
            if existing.provider_payment_id is not None or existing.status not in {
                PaymentOrderStatus.CREATED.value,
                PaymentOrderStatus.PROVIDER_ERROR.value,
            }:
                return existing
            order = existing
        else:
            package_result = await self.session.execute(
                select(AnswerPackage).where(
                    AnswerPackage.code == package_code,
                    AnswerPackage.kind == AnswerPackageKind.PAID.value,
                    AnswerPackage.is_active.is_(True),
                )
            )
            package = package_result.scalar_one_or_none()
            if package is None:
                raise not_found("Paid answer package not found")
            if package.answer_count is None or package.price_minor is None or package.price_minor <= 0:
                raise conflict("Answer package is not available for online payment")

            order = PaymentOrder(
                organization_id=organization_id,
                package_id=package.id,
                actor_user_id=actor.id,
                provider="yookassa",
                status=PaymentOrderStatus.CREATED.value,
                package_code=package.code,
                answer_quantity=package.answer_count,
                amount_minor=package.price_minor,
                currency=package.currency.upper(),
                idempotency_key=normalized_key,
                metadata_json={},
            )
            self.session.add(order)
            await self.session.flush()
        try:
            payment = await self.provider().create_payment(
                amount_minor=order.amount_minor,
                currency=order.currency,
                idempotency_key=str(order.id),
                return_url=self.settings.payment_return_url,
                description=f"MPReply answer package {order.package_code}",
                metadata={
                    "mpreply_payment_order_id": str(order.id),
                    "organization_id": str(organization_id),
                    "package_code": order.package_code,
                },
            )
        except YooKassaProviderError as exc:
            order.status = PaymentOrderStatus.PROVIDER_ERROR.value
            order.last_provider_error = str(exc)[:500]
            await self.audit.write(
                action="billing.payment_order.provider_error",
                entity_type="payment_order",
                organization_id=organization_id,
                actor_user_id=actor.id,
                entity_id=str(order.id),
                metadata={"error_code": exc.error_code},
            )
            await self.session.flush()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment provider request failed") from exc

        try:
            self._assert_payment_matches_order(order=order, payment=payment)
        except YooKassaProviderError as exc:
            order.status = PaymentOrderStatus.PROVIDER_ERROR.value
            order.provider_payment_id = payment.id
            order.provider_status = payment.status
            order.last_provider_error = str(exc)[:500]
            await self.session.flush()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment provider response failed validation") from exc
        order.provider_payment_id = payment.id
        order.provider_status = payment.status
        order.confirmation_url = payment.confirmation_url
        order.last_provider_error = None
        await self._apply_verified_payment(order=order, payment=payment, actor_user_id=actor.id)
        await self.audit.write(
            action="billing.payment_order.created",
            entity_type="payment_order",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(order.id),
            metadata={
                "package_code": order.package_code,
                "amount_minor": order.amount_minor,
                "currency": order.currency,
                "provider_payment_id": payment.id,
            },
        )
        await self.session.flush()
        return order

    async def list_orders(self, *, actor: User, organization_id: UUID, limit: int = 50) -> list[PaymentOrder]:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_PAYMENT_READ_ROLES,
        )
        if limit < 1 or limit > 100:
            raise bad_request("Payment order limit must be between 1 and 100")
        result = await self.session.execute(
            select(PaymentOrder)
            .where(PaymentOrder.organization_id == organization_id)
            .order_by(PaymentOrder.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_order(self, *, actor: User, order_id: UUID) -> PaymentOrder:
        order = await self._order(order_id=order_id)
        await self.organizations.require_membership_role(
            organization_id=order.organization_id,
            user_id=actor.id,
            allowed_roles=_PAYMENT_READ_ROLES,
        )
        return order

    async def reconcile(self, *, actor: User, order_id: UUID) -> PaymentOrder:
        order = await self._order(order_id=order_id, for_update=True)
        await self.organizations.require_membership_role(
            organization_id=order.organization_id,
            user_id=actor.id,
            allowed_roles=_PAYMENT_WRITE_ROLES,
        )
        if order.provider_payment_id is None:
            raise conflict("Payment order has no provider payment identifier")
        payment = await self.provider().get_payment(order.provider_payment_id)
        await self._apply_verified_payment(order=order, payment=payment, actor_user_id=actor.id)
        return order

    async def process_webhook(
        self,
        *,
        payload: dict[str, object],
        peer_ip: str,
        forwarded_for: str | None,
    ) -> WebhookResult:
        try:
            notification = parse_notification(payload)
            source_ip = resolve_source_ip(
                peer_ip=peer_ip,
                forwarded_for=forwarded_for,
                trusted_proxy_networks=self.settings.payment_trusted_proxy_networks,
            )
        except (ValueError, YooKassaProviderError) as exc:
            raise bad_request("Payment webhook payload is invalid") from exc
        if self.settings.payment_webhook_ip_check_enabled and not is_allowed_source_ip(
            source_ip,
            self.settings.yookassa_webhook_allowed_networks,
        ):
            raise forbidden("Payment webhook source is not allowed")

        event_key = f"{notification.event}:{notification.object_id}"
        await self._advisory_lock(f"payment-webhook:yookassa:{event_key}")
        existing_result = await self.session.execute(
            select(PaymentWebhookEvent)
            .where(
                PaymentWebhookEvent.provider == "yookassa",
                PaymentWebhookEvent.event_key == event_key,
            )
            .with_for_update()
        )
        event_record = existing_result.scalar_one_or_none()
        if event_record is not None and event_record.status in {
            PaymentWebhookStatus.PROCESSED.value,
            PaymentWebhookStatus.IGNORED.value,
        }:
            return WebhookResult(status=event_record.status)
        if event_record is None:
            event_record = PaymentWebhookEvent(
                provider="yookassa",
                event_key=event_key,
                event_type=notification.event,
                object_type=notification.object_type,
                object_id=notification.object_id,
                payload_sha256=notification.payload_sha256,
                source_ip=source_ip,
                status=PaymentWebhookStatus.RECEIVED.value,
                attempt_count=1,
                metadata_json={},
            )
            self.session.add(event_record)
        else:
            event_record.attempt_count += 1
            event_record.status = PaymentWebhookStatus.RECEIVED.value
            event_record.error_code = None
            event_record.error_message_safe = None
        await self.session.flush()

        try:
            if notification.object_type == "payment":
                result = await self._process_payment_notification(notification=notification, event=event_record)
            else:
                result = await self._process_refund_notification(notification=notification, event=event_record)
        except YooKassaProviderError as exc:
            event_record.status = PaymentWebhookStatus.FAILED.value
            event_record.error_code = exc.error_code
            event_record.error_message_safe = str(exc)[:500]
            await self.session.flush()
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Payment webhook verification failed") from exc
        return result

    async def _process_payment_notification(
        self,
        *,
        notification: YooKassaNotification,
        event: PaymentWebhookEvent,
    ) -> WebhookResult:
        payment = await self.provider().get_payment(notification.object_id)
        order_result = await self.session.execute(
            select(PaymentOrder)
            .where(
                PaymentOrder.provider == "yookassa",
                PaymentOrder.provider_payment_id == payment.id,
            )
            .with_for_update()
        )
        order = order_result.scalar_one_or_none()
        if order is None:
            raise YooKassaProviderError(
                "Payment order is not committed yet",
                error_code="payment_order_not_ready",
            )
        event.order_id = order.id
        self._assert_payment_matches_order(order=order, payment=payment)
        expected_status = notification.event.removeprefix("payment.")
        if payment.status != expected_status:
            return await self._ignore_event(event=event, reason="stale_payment_notification")
        await self._apply_verified_payment(order=order, payment=payment, actor_user_id=None)
        event.status = PaymentWebhookStatus.PROCESSED.value
        event.processed_at = datetime.now(UTC)
        event.metadata_json = {"provider_status": payment.status}
        await self.session.flush()
        return WebhookResult(status=event.status)

    async def _process_refund_notification(
        self,
        *,
        notification: YooKassaNotification,
        event: PaymentWebhookEvent,
    ) -> WebhookResult:
        refund = await self.provider().get_refund(notification.object_id)
        order_result = await self.session.execute(
            select(PaymentOrder)
            .where(
                PaymentOrder.provider == "yookassa",
                PaymentOrder.provider_payment_id == refund.payment_id,
            )
            .with_for_update()
        )
        order = order_result.scalar_one_or_none()
        if order is None:
            raise YooKassaProviderError(
                "Refund order is not committed yet",
                error_code="refund_order_not_ready",
            )
        event.order_id = order.id
        existing_refund_result = await self.session.execute(
            select(PaymentRefund).where(
                PaymentRefund.provider == "yookassa",
                PaymentRefund.provider_refund_id == refund.id,
            )
        )
        payment_refund = existing_refund_result.scalar_one_or_none()
        if payment_refund is None:
            payment_refund = PaymentRefund(
                order_id=order.id,
                grant_id=order.grant_id,
                provider="yookassa",
                provider_refund_id=refund.id,
                status="manual_review",
                amount_minor=refund.amount_minor,
                currency=refund.currency,
                metadata_json={},
            )
            self.session.add(payment_refund)
            await self.session.flush()
        if notification.event != "refund.succeeded" or refund.status != "succeeded":
            payment_refund.status = "canceled" if refund.status == "canceled" else "manual_review"
            event.status = PaymentWebhookStatus.PROCESSED.value
            event.processed_at = datetime.now(UTC)
            await self.session.flush()
            return WebhookResult(status=event.status)
        amount_matches = refund.amount_minor == order.amount_minor and refund.currency == order.currency
        revocation = None
        if order.grant_id is not None:
            revocation = await self.entitlements.revoke_purchase_grant(
                organization_id=order.organization_id,
                grant_id=order.grant_id,
                payment_order_id=order.id,
                actor_user_id=None,
            )
        if revocation is not None and revocation.revoked_quantity > 0:
            payment_refund.answer_quantity_revoked = revocation.revoked_quantity
        if amount_matches and revocation is not None and revocation.safe_to_finalize_full_refund:
            order.status = PaymentOrderStatus.REFUNDED.value
            order.refunded_at = datetime.now(UTC)
            payment_refund.status = "succeeded"
        else:
            order.status = PaymentOrderStatus.REFUND_REVIEW_REQUIRED.value
            payment_refund.status = "manual_review"
        payment_refund.processed_at = datetime.now(UTC)
        event.status = PaymentWebhookStatus.PROCESSED.value
        event.processed_at = datetime.now(UTC)
        event.metadata_json = {"refund_status": payment_refund.status}
        await self.audit.write(
            action="billing.refund.processed",
            entity_type="payment_refund",
            organization_id=order.organization_id,
            entity_id=str(payment_refund.id),
            metadata={
                "payment_order_id": str(order.id),
                "provider_refund_id": refund.id,
                "status": payment_refund.status,
            },
        )
        await self.session.flush()
        return WebhookResult(status=event.status)

    async def _apply_verified_payment(
        self,
        *,
        order: PaymentOrder,
        payment: YooKassaPayment,
        actor_user_id: UUID | None,
    ) -> None:
        self._assert_payment_matches_order(order=order, payment=payment)
        order.provider_status = payment.status
        if order.status in {
            PaymentOrderStatus.REFUNDED.value,
            PaymentOrderStatus.REFUND_REVIEW_REQUIRED.value,
        }:
            return
        if payment.status == "succeeded" and payment.paid:
            if order.grant_id is None:
                grant = await self.entitlements.grant_package(
                    organization_id=order.organization_id,
                    package_code=order.package_code,
                    source_type=AnswerGrantSource.PURCHASE.value,
                    idempotency_key=f"payment:{order.id}:grant",
                    reference_type="payment_order",
                    reference_id=str(order.id),
                    actor_user_id=actor_user_id,
                    metadata={"provider": order.provider, "provider_payment_id": payment.id},
                )
                order.grant_id = grant.id
            order.status = PaymentOrderStatus.SUCCEEDED.value
            order.paid_at = order.paid_at or datetime.now(UTC)
            order.last_provider_error = None
            await self.audit.write(
                action="billing.payment_order.succeeded",
                entity_type="payment_order",
                organization_id=order.organization_id,
                actor_user_id=actor_user_id,
                entity_id=str(order.id),
                metadata={"provider_payment_id": payment.id, "grant_id": str(order.grant_id)},
            )
        elif payment.status == "canceled":
            if order.status != PaymentOrderStatus.SUCCEEDED.value:
                order.status = PaymentOrderStatus.CANCELED.value
                order.canceled_at = order.canceled_at or datetime.now(UTC)
        elif payment.status in {"pending", "waiting_for_capture"}:
            order.status = PaymentOrderStatus.PENDING.value
            order.confirmation_url = payment.confirmation_url or order.confirmation_url
        await self.session.flush()

    @staticmethod
    def _assert_payment_matches_order(*, order: PaymentOrder, payment: YooKassaPayment) -> None:
        metadata_order_id = payment.metadata.get("mpreply_payment_order_id")
        if metadata_order_id is None:
            legacy_candidates = [
                value
                for key, value in payment.metadata.items()
                if key.endswith("_payment_order_id")
            ]
            if len(legacy_candidates) == 1:
                metadata_order_id = legacy_candidates[0]
        if str(metadata_order_id or "") != str(order.id):
            raise YooKassaProviderError("Payment metadata does not match the order", error_code="payment_metadata_mismatch")
        if payment.amount_minor != order.amount_minor or payment.currency != order.currency:
            raise YooKassaProviderError("Payment amount does not match the order", error_code="payment_amount_mismatch")

    async def _ignore_event(self, *, event: PaymentWebhookEvent, reason: str) -> WebhookResult:
        event.status = PaymentWebhookStatus.IGNORED.value
        event.processed_at = datetime.now(UTC)
        event.metadata_json = {"reason": reason}
        await self.session.flush()
        return WebhookResult(status=event.status)

    async def _advisory_lock(self, key: str) -> None:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": key},
        )

    async def _order(self, *, order_id: UUID, for_update: bool = False) -> PaymentOrder:
        statement = select(PaymentOrder).where(PaymentOrder.id == order_id)
        if for_update:
            statement = statement.with_for_update()
        result = await self.session.execute(statement)
        order = result.scalar_one_or_none()
        if order is None:
            raise not_found("Payment order not found")
        return order
