from __future__ import annotations

import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import conflict, forbidden, not_found
from app.models.billing_order import BillingOrder
from app.models.billing_plan import BillingPlan
from app.models.organization import Organization
from app.models.user import User
from app.providers.lava import LavaClient, LavaError, VerifiedInvoice
from app.schemas.billing import PurchaseRequest
from app.services.billing_catalog import PLANS, quote_purchase
from app.services.billing_period_service import BillingPeriodService
from app.services.organization_service import OrganizationService
from app.services.reply_credit_service import ReplyCreditService, utc


class BillingOrderService:
    def __init__(self, session: AsyncSession, *, settings: Settings | None = None, client: LavaClient | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.client = client or LavaClient(settings=self.settings)
        self.organizations = OrganizationService(session)

    async def _preorder_error(self, *, organization_id: UUID, key: UUID, status: int, message: str) -> HTTPException:
        existing = await self.session.scalar(select(BillingOrder.id).where(
            BillingOrder.organization_id == organization_id, BillingOrder.idempotency_key == key,
        ))
        return HTTPException(status_code=status, detail=message, headers={"X-Billing-Order-Not-Created": "1"} if existing is None else None)

    async def get(self, *, actor: User, organization_id: UUID, order_id: UUID) -> BillingOrder:
        await self.organizations.require_membership_role(organization_id=organization_id, user_id=actor.id,
                                                        allowed_roles={"owner", "admin", "manager", "viewer"})
        order = await self.session.scalar(select(BillingOrder).where(BillingOrder.id == order_id, BillingOrder.organization_id == organization_id))
        if order is None:
            raise not_found("Payment order not found")
        return order

    async def create(self, *, actor: User, organization_id: UUID, idempotency_key: UUID, purchase: PurchaseRequest) -> BillingOrder:
        if actor.status != "active":
            raise forbidden("Only active accounts can purchase")
        await self.organizations.require_membership_role(organization_id=organization_id, user_id=actor.id, allowed_roles={"owner", "admin"})
        org = await self.session.scalar(select(Organization).where(Organization.id == organization_id).with_for_update(key_share=True))
        if org is None or org.status != "active":
            raise forbidden("Workspace is not active")
        try:
            quote = quote_purchase(kind=purchase.kind, plan_code=purchase.plan_code, months=purchase.months,
                                   packs=[(pack.quantity, pack.count) for pack in purchase.packs])
        except ValueError as error:
            raise await self._preorder_error(organization_id=organization_id, key=idempotency_key, status=400, message=str(error)) from None
        request_hash = hashlib.sha256(json.dumps({**quote.snapshot, "amount_minor": quote.amount_minor}, sort_keys=True).encode()).hexdigest()
        previous = await self.session.scalar(select(BillingOrder).where(
            BillingOrder.organization_id == organization_id, BillingOrder.idempotency_key == idempotency_key,
        ))
        if previous is not None:
            if previous.request_hash != request_hash:
                raise conflict("Payment key was reused with different purchase terms")
            if previous.state == "creating" and utc(previous.created_at) < datetime.now(UTC) - timedelta(minutes=1):
                previous.state = "review_required"
                previous.last_error = "creation_interrupted"
            await self.session.commit()
            return previous
        if not self.settings.lava_enabled:
            raise HTTPException(status_code=503, detail="Payments are not available")
        if purchase.kind == "plan":
            plan = await self.session.scalar(select(BillingPlan).where(BillingPlan.code == purchase.plan_code, BillingPlan.is_active.is_(True)))
            if plan is None or plan.currency != "RUB" or plan.price_month_minor != PLANS[plan.code][0]:
                raise await self._preorder_error(organization_id=organization_id, key=idempotency_key, status=409,
                                                 message="This tariff is not available for purchase")
        order = BillingOrder(organization_id=organization_id, actor_user_id=actor.id, idempotency_key=idempotency_key,
                             request_hash=request_hash, correlation=secrets.token_urlsafe(32), kind=purchase.kind,
                             amount_minor=quote.amount_minor, currency=quote.currency, monthly_credits=quote.monthly_credits,
                             addon_credits=quote.addon_credits, snapshot_json={**quote.snapshot, "offer_id": str(self.settings.lava_offer_id),
                                                                            "product_id": str(self.settings.lava_product_id)}, state="creating")
        self.session.add(order)
        await self.session.flush()
        await self.session.commit()
        order_id = order.id
        return_url = self.settings.web_app_url.rstrip("/") + f"/app/billing?order={order_id}"
        try:
            invoice = await self.client.create_invoice(email=actor.email, offer_id=self.settings.lava_offer_id, amount_minor=quote.amount_minor,
                                                       correlation=order.correlation, return_urls={name: return_url for name in (
                                                           "successful_return_url", "failure_return_url", "cancel_return_url")})
        except LavaError as error:
            order = await self.lock_order(order_id)
            if order.state != "paid":
                order.state = "review_required" if error.ambiguous else "failed"
                order.last_error = error.code
            await self.session.commit()
            return order
        order = await self.lock_order(order_id)
        if order.provider_invoice_id is None or order.provider_invoice_id == invoice.id:
            order.provider_invoice_id = invoice.id
            order.payment_url = invoice.payment_url
            if order.state != "paid":
                order.state = "pending"
                order.last_error = None
        elif order.state != "paid":
            order.state = "review_required"
            order.last_error = "invoice_binding_conflict"
        await self.session.commit()
        return order

    async def lock_order(self, order_id: UUID) -> BillingOrder:
        order = await self.session.scalar(select(BillingOrder).where(BillingOrder.id == order_id).with_for_update()
                                          .execution_options(populate_existing=True))
        if order is None:
            raise not_found("Payment order not found")
        return order

    async def settle(self, *, order_id: UUID, invoice: VerifiedInvoice, event_product_id: UUID, now: datetime) -> BillingOrder:
        candidate = await self.session.get(BillingOrder, order_id)
        if candidate is None:
            raise ValueError("order_missing")
        await self.session.scalar(select(Organization.id).where(Organization.id == candidate.organization_id).with_for_update(key_share=True))
        order = await self.lock_order(order_id)
        if (invoice.status != "completed" or invoice.amount_minor != order.amount_minor or invoice.currency != order.currency
                or order.snapshot_json.get("product_id") != str(event_product_id)):
            raise ValueError("payment_terms_mismatch")
        if order.provider_invoice_id is not None:
            if order.provider_invoice_id != invoice.id:
                raise ValueError("invoice_binding_conflict")
        elif invoice.correlation != order.correlation:
            raise ValueError("invoice_correlation_mismatch")
        if order.state == "paid":
            return order
        order.provider_invoice_id = invoice.id
        order.state = "paid"
        order.paid_at = now
        order.last_error = None
        await self.session.flush()
        if order.kind == "plan":
            periods = BillingPeriodService(self.session)
            await periods.add_paid_period(order=order, now=now)
            await periods.materialize_current(organization_id=order.organization_id, now=now)
        else:
            await ReplyCreditService(self.session).grant(organization_id=order.organization_id, source_key=f"lava:order:{order.id}:addon",
                                                         kind="addon", quantity=order.addon_credits, now=now)
        return order
