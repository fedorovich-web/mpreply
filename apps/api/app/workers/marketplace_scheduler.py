from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from app.core.config import get_settings
from app.workers.marketplace_sync import enqueue_due_marketplace_streams


async def run_scheduler() -> None:
    settings = get_settings()
    while True:
        await enqueue_due_marketplace_streams(
            datetime.now(UTC),
            limit=settings.marketplace_scheduler_batch_size,
        )
        await asyncio.sleep(settings.marketplace_scheduler_interval_seconds)


def main() -> None:
    asyncio.run(run_scheduler())


if __name__ == "__main__":
    main()
