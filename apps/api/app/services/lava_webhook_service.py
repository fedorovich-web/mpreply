from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import cast
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import bad_request, unauthorized
from app.models.billing_order import BillingOrder
from app.models.billing_webhook import BillingWebhook
from app.providers.lava import LavaClient, LavaError, money_minor
from app.services.billing_order_service import BillingOrderService
from app.services.reply_credit_service import utc

MAX_WEBHOOK_BYTES = 65536


class LavaWebhookService:
    def __init__(self, session: AsyncSession, *, settings: Settings | None = None, client: LavaClient | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.client = client or LavaClient(settings=self.settings)

    async def receive(self, *, api_key: str | None, payload: bytes) -> None:
        if not self.settings.lava_enabled:
            raise HTTPException(status_code=503, detail="Payments are not available")
        if api_key is None or not hmac.compare_digest(api_key.encode(), self.settings.lava_webhook_secret.get_secret_value().encode()):
            raise unauthorized("Invalid webhook authorization")
        if len(payload) > MAX_WEBHOOK_BYTES:
            raise HTTPException(status_code=413, detail="Webhook is too large")
        try:
            raw: object = json.loads(payload, parse_float=Decimal)
            if not isinstance(raw, dict):
                raise ValueError("Invalid event")
            data = cast(dict[str, object], raw)
            kind = data.get("eventType", data.get("event_type"))
            if not isinstance(kind, str) or not kind.isascii() or not 0 < len(kind) <= 64:
                raise ValueError("Invalid event")
            if kind in {"payment.success", "payment.failed"}:
                raw_product = data.get("product")
                currency = data.get("currency")
                if not isinstance(raw_product, dict) or not isinstance(currency, str) or currency not in {"RUB", "USD", "EUR"}:
                    raise ValueError("Invalid product or currency")
                product = cast(dict[str, object], raw_product)
                normalized: dict[str, object] = {"eventType": kind, "contractId": str(UUID(str(data["contractId"]))),
                                                 "product_id": str(UUID(str(product["id"]))), "currency": currency,
                                                 "amount_minor": money_minor(data.get("amount"))}
            else:
                event_data = data.get("data")
                normalized = {"eventType": kind, "event_id": str(data.get("event_id", ""))[:128],
                              "payload_digest": hashlib.sha256(payload).hexdigest()}
                if isinstance(event_data, dict):
                    event_data = cast(dict[str, object], event_data)
                    for field in ("refund_id", "chargeback_id", "currency"):
                        if isinstance(event_data.get(field), str):
                            normalized[field] = str(event_data[field])[:128]
            digest = hashlib.sha256(json.dumps(normalized, sort_keys=True).encode()).hexdigest()
        except (ValueError, KeyError, UnicodeDecodeError, LavaError):
            raise bad_request("Invalid webhook event") from None
        previous = await self.session.scalar(select(BillingWebhook.id).where(BillingWebhook.event_digest == digest))
        if previous is None:
            try:
                async with self.session.begin_nested():
                    self.session.add(BillingWebhook(event_digest=digest, event_type=kind, payload_json=normalized,
                                                    state="pending" if kind in {"payment.success", "payment.failed"} else "review_required"))
                    await self.session.flush()
            except IntegrityError:
                if await self.session.scalar(select(BillingWebhook.id).where(BillingWebhook.event_digest == digest)) is None:
                    raise
        await self.session.commit()

    async def process_due(self, *, now: datetime, limit: int) -> int:
        processed = 0
        for _ in range(limit):
            event = await self.session.scalar(select(BillingWebhook).where(
                BillingWebhook.next_attempt_at <= now,
                or_(BillingWebhook.state == "pending", (BillingWebhook.state == "processing") & (BillingWebhook.lease_expires_at <= now)),
            ).order_by(BillingWebhook.next_attempt_at, BillingWebhook.id).with_for_update(skip_locked=True).limit(1))
            if event is None:
                break
            lease = uuid4()
            event.state = "processing"
            event.lease_token = lease
            event.lease_expires_at = now + timedelta(seconds=60)
            event.attempt_count += 1
            event_id, payload = event.id, dict(event.payload_json)
            await self.session.commit()
            try:
                invoice_id = UUID(str(payload["contractId"]))
                invoice = await self.client.get_invoice(invoice_id)
                if invoice.amount_minor != payload["amount_minor"] or invoice.currency != payload["currency"]:
                    raise ValueError("payment_terms_mismatch")
                event = await self.session.scalar(select(BillingWebhook).where(BillingWebhook.id == event_id).with_for_update()
                                                  .execution_options(populate_existing=True))
                if (event is None or event.lease_token != lease or event.state != "processing"
                        or event.lease_expires_at is None or utc(event.lease_expires_at) <= utc(now)):
                    await self.session.rollback()
                    continue
                order = await self.session.scalar(select(BillingOrder).where(BillingOrder.provider_invoice_id == invoice.id))
                if order is None and invoice.correlation is not None:
                    order = await self.session.scalar(select(BillingOrder).where(BillingOrder.correlation == invoice.correlation))
                if order is None:
                    raise LavaError("order_not_yet_bound")
                product_id = UUID(str(payload["product_id"]))
                if order.snapshot_json.get("product_id") != str(product_id):
                    raise ValueError("payment_product_mismatch")
                service = BillingOrderService(self.session, settings=self.settings, client=self.client)
                if invoice.status == "completed":
                    await service.settle(order_id=order.id, invoice=invoice, event_product_id=product_id, now=now)
                elif invoice.status == "failed":
                    order = await service.lock_order(order.id)
                    if order.state != "paid":
                        order.state = "failed"
                        order.last_error = "payment_failed"
                elif invoice.status != "completed":
                    raise LavaError("invoice_not_final")
                event.state = "processed"
                event.last_error = None
                event.lease_token = None
                event.lease_expires_at = None
                await self.session.commit()
                processed += 1
            except (LavaError, ValueError) as error:
                await self.session.rollback()
                current = await self.session.scalar(select(BillingWebhook).where(BillingWebhook.id == event_id).with_for_update()
                                                    .execution_options(populate_existing=True))
                if current is None or current.lease_token != lease:
                    await self.session.rollback()
                    continue
                code = error.code if isinstance(error, LavaError) else "payment_verification_mismatch"
                retry = isinstance(error, LavaError) and current.attempt_count < 20
                current.state = "pending" if retry else "review_required"
                current.last_error = code
                delays = (1, 5, 15, 60)
                current.next_attempt_at = now + timedelta(seconds=delays[min(current.attempt_count - 1, 3)] if current.attempt_count <= 4 else 3600)
                current.lease_token = None
                current.lease_expires_at = None
                await self.session.commit()
        return processed
