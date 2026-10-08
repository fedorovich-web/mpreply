from datetime import UTC, datetime

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.services.billing_period_service import BillingPeriodService
from app.services.lava_webhook_service import LavaWebhookService


async def run_billing_maintenance(now: datetime | None = None, *, limit: int = 25) -> int:
    current = now or datetime.now(UTC)
    processed = 0
    if get_settings().lava_enabled:
        async with AsyncSessionLocal() as session:
            processed = await LavaWebhookService(session).process_due(now=current, limit=limit)
    async with AsyncSessionLocal() as session:
        processed += await BillingPeriodService(session).grant_due(now=current, limit=limit)
    return processed
