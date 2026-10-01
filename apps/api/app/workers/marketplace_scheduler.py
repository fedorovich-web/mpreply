from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from app.core.config import get_settings
from app.workers.auto_reply import dispatch_due_replies
from app.workers.automatic_drafts import dispatch_automatic_drafts
from app.workers.billing_maintenance import run_billing_maintenance
from app.workers.marketplace_sync import enqueue_due_marketplace_streams
from app.workers.reply_credit_maintenance import recover_due_reply_credits


async def run_scheduler() -> None:
    settings = get_settings()
    while True:
        await run_billing_maintenance(datetime.now(UTC), limit=settings.marketplace_scheduler_batch_size)
        await recover_due_reply_credits(datetime.now(UTC), limit=settings.marketplace_scheduler_batch_size)
        await enqueue_due_marketplace_streams(
            datetime.now(UTC),
            limit=settings.marketplace_scheduler_batch_size,
        )
        await dispatch_automatic_drafts(datetime.now(UTC), limit=settings.marketplace_scheduler_batch_size)
        await dispatch_due_replies(
            datetime.now(UTC),
            limit=settings.marketplace_scheduler_batch_size,
        )
        await asyncio.sleep(settings.marketplace_scheduler_interval_seconds)


def main() -> None:
    asyncio.run(run_scheduler())


if __name__ == "__main__":
    main()
