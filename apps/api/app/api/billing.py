from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import enforce_auth_rate_limit
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.billing_order import BillingOrder
from app.models.user import User
from app.schemas.billing import BillingCatalogResponse, BillingOrderResponse, BillingOverviewResponse, CatalogPack, CatalogPlan, CreateOrderRequest
from app.services.billing_catalog import PACKS, PLANS
from app.services.billing_order_service import BillingOrderService
from app.services.billing_service import BillingService
from app.services.lava_webhook_service import MAX_WEBHOOK_BYTES, LavaWebhookService
from app.services.organization_service import OrganizationService
from app.workers.billing_maintenance import run_billing_maintenance

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/lava/webhook", status_code=204)
async def receive_lava_webhook(
    request: Request, background: BackgroundTasks, api_key: str | None = Header(default=None, alias="X-Api-Key"),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_WEBHOOK_BYTES:
            raise HTTPException(status_code=413, detail="Webhook is too large")
        body.extend(chunk)
    await LavaWebhookService(session).receive(api_key=api_key, payload=bytes(body))
    background.add_task(run_billing_maintenance, limit=10)
    return Response(status_code=204)


@router.get("/overview", response_model=BillingOverviewResponse)
async def get_billing_overview(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BillingOverviewResponse:
    overview = await BillingService(session).overview(actor=current_user, organization_id=organization_id)
    await session.commit()
    return overview


@router.get("/catalog", response_model=BillingCatalogResponse)
async def get_billing_catalog(
    organization_id: UUID, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session),
) -> BillingCatalogResponse:
    membership = await OrganizationService(session).get_membership(organization_id=organization_id, user_id=current_user.id)
    org = await OrganizationService(session).get_for_user(organization_id=organization_id, user_id=current_user.id)
    enabled = get_settings().lava_enabled
    return BillingCatalogResponse(enabled=enabled, can_purchase=enabled and current_user.status == "active" and org.status == "active"
                                  and membership.role in {"owner", "admin"},
                                  plans=[CatalogPlan(code=code, amount_month_minor=price, amount_year_minor=price * 12 * 80 // 100,
                                                     monthly_credits=credits) for code, (price, credits) in PLANS.items()],
                                  packs=[CatalogPack(quantity=quantity, amount_minor=price) for quantity, price in PACKS.items()])


@router.post("/orders", response_model=BillingOrderResponse)
async def create_billing_order(
    payload: CreateOrderRequest, request: Request, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session),
) -> BillingOrderResponse:
    await enforce_auth_rate_limit(request, scope="billing-purchase", identifier=f"{current_user.id}:{payload.organization_id}", limit=20, window_seconds=60)
    order = await BillingOrderService(session).create(actor=current_user, organization_id=payload.organization_id,
                                                     idempotency_key=payload.idempotency_key, purchase=payload)
    return BillingOrderResponse.model_validate(order)


@router.get("/orders", response_model=list[BillingOrderResponse])
async def list_billing_orders(
    organization_id: UUID, limit: int = Query(default=20, ge=1, le=100), offset: int = Query(default=0, ge=0, le=10000),
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session),
) -> list[BillingOrderResponse]:
    await OrganizationService(session).get_membership(organization_id=organization_id, user_id=current_user.id)
    orders = await session.scalars(select(BillingOrder).where(BillingOrder.organization_id == organization_id)
                                   .order_by(BillingOrder.created_at.desc(), BillingOrder.id.desc()).limit(limit).offset(offset))
    return [BillingOrderResponse.model_validate(order) for order in orders]


@router.get("/orders/{order_id}", response_model=BillingOrderResponse)
async def get_billing_order(
    order_id: UUID, organization_id: UUID, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session),
) -> BillingOrderResponse:
    return BillingOrderResponse.model_validate(await BillingOrderService(session).get(actor=current_user, organization_id=organization_id, order_id=order_id))
