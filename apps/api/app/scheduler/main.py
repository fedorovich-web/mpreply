from __future__ import annotations

import asyncio
import logging

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal, engine
from app.services.marketplace_scheduler_service import MarketplaceSchedulerService, MarketplaceSyncLease
from app.services.reply_dispatch_service import ReplyDispatchRecoveryService
from app.workers.auto_reply import enqueue_auto_reply
from app.workers.marketplace_sync import enqueue_marketplace_sync

logger = logging.getLogger(__name__)


async def run_scheduler_cycle() -> int:
    async with AsyncSessionLocal() as session:
        recovery = ReplyDispatchRecoveryService(session)
        recovered = await recovery.recover_missing_dispatches(enqueue=enqueue_auto_reply)
        await session.commit()

    async with AsyncSessionLocal() as session:
        service = MarketplaceSchedulerService(session)
        leases = await service.claim_due_states()
        await session.commit()

    for lease in leases:
        await _enqueue_lease(lease)
    return len(leases) + recovered


async def _enqueue_lease(lease: MarketplaceSyncLease) -> None:
    try:
        worker_message_id = enqueue_marketplace_sync(
            state_id=lease.state_id,
            lease_token=lease.lease_token,
        )
    except Exception as exc:
        logger.exception("marketplace_sync_enqueue_failed", extra={"state_id": str(lease.state_id)})
        async with AsyncSessionLocal() as session:
            service = MarketplaceSchedulerService(session)
            await service.record_enqueue_failure(lease=lease, error_type=type(exc).__name__)
            await session.commit()
        return

    async with AsyncSessionLocal() as session:
        service = MarketplaceSchedulerService(session)
        await service.record_enqueued(lease=lease, worker_message_id=worker_message_id)
        await session.commit()


async def run_forever() -> None:
    settings = get_settings()
    try:
        while True:
            claimed = await run_scheduler_cycle()
            if claimed:
                logger.info("marketplace_scheduler_claimed", extra={"count": claimed})
            await asyncio.sleep(settings.scheduler_poll_interval_seconds)
    finally:
        await engine.dispose()


def main() -> None:
    try:
        asyncio.run(run_forever())
    except KeyboardInterrupt:
        return


if __name__ == "__main__":
    main()
