from __future__ import annotations

import json
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import bad_request
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.payment import PaymentOrderCreateRequest, PaymentOrderResponse, PaymentWebhookResponse
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/api/billing", tags=["billing"])


async def _read_limited_body(request: Request, *, maximum_bytes: int) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_length = int(content_length)
        except ValueError as exc:
            raise bad_request("Webhook Content-Length is invalid") from exc
        if declared_length < 0:
            raise bad_request("Webhook Content-Length is invalid")
        if declared_length > maximum_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Webhook payload is too large",
            )

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > maximum_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Webhook payload is too large",
            )
    return bytes(body)


@router.post("/payment-orders", response_model=PaymentOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_order(
    payload: PaymentOrderCreateRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=1, max_length=64),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentOrderResponse:
    try:
        order = await PaymentService(session).create_order(
            actor=current_user,
            organization_id=payload.organization_id,
            package_code=payload.package_code,
            idempotency_key=idempotency_key,
        )
    except HTTPException:
        await session.commit()
        raise
    await session.commit()
    return PaymentOrderResponse.model_validate(order)


@router.get("/payment-orders", response_model=list[PaymentOrderResponse])
async def list_payment_orders(
    organization_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PaymentOrderResponse]:
    orders = await PaymentService(session).list_orders(
        actor=current_user,
        organization_id=organization_id,
        limit=limit,
    )
    return [PaymentOrderResponse.model_validate(order) for order in orders]


@router.get("/payment-orders/{order_id}", response_model=PaymentOrderResponse)
async def get_payment_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentOrderResponse:
    order = await PaymentService(session).get_order(actor=current_user, order_id=order_id)
    return PaymentOrderResponse.model_validate(order)


@router.post("/payment-orders/{order_id}/reconcile", response_model=PaymentOrderResponse)
async def reconcile_payment_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentOrderResponse:
    order = await PaymentService(session).reconcile(actor=current_user, order_id=order_id)
    await session.commit()
    return PaymentOrderResponse.model_validate(order)


@router.post("/webhooks/yookassa", response_model=PaymentWebhookResponse)
async def process_yookassa_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> PaymentWebhookResponse:
    content_type = request.headers.get("content-type", "")
    if not content_type.lower().startswith("application/json"):
        raise bad_request("Webhook Content-Type must be application/json")
    raw_body = await _read_limited_body(
        request,
        maximum_bytes=get_settings().payment_webhook_max_body_bytes,
    )
    try:
        raw_payload: object = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise bad_request("Webhook payload is not valid JSON") from exc
    if not isinstance(raw_payload, dict):
        raise bad_request("Webhook payload must be an object")
    payload = cast(dict[str, object], raw_payload)
    peer_ip = request.client.host if request.client is not None else "127.0.0.1"
    try:
        result = await PaymentService(session).process_webhook(
            payload=payload,
            peer_ip=peer_ip,
            forwarded_for=request.headers.get("x-forwarded-for"),
        )
    except HTTPException:
        await session.commit()
        raise
    await session.commit()
    return PaymentWebhookResponse(status=result.status)
