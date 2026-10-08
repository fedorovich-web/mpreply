from __future__ import annotations

import httpx
import pytest

from app.adapters.capabilities import MarketplaceStream
from app.adapters.wildberries import WildberriesAdapter
from app.tests.marketplace_fixtures import SequenceTransport, response


@pytest.mark.parametrize(
    ("headers", "expected_delay"),
    [
        ({"X-Ratelimit-Retry": "650"}, 650),
        ({"Retry-After": "720"}, 720),
        ({"Retry-After": "2", "X-Ratelimit-Retry": "650"}, 650),
        ({"Retry-After": "720", "X-Ratelimit-Retry": "650"}, 720),
        ({"X-Ratelimit-Retry": "86400"}, 86400),
    ],
)
@pytest.mark.asyncio
async def test_wb_cooldown_is_returned_to_scheduler_without_early_retry(
    headers: dict[str, str], expected_delay: int,
) -> None:
    transport = SequenceTransport([response(429, headers=headers) for _ in range(3)])
    async with httpx.AsyncClient(
        base_url="https://feedbacks-api.wildberries.ru", transport=transport.mock(),
    ) as client:
        result = await WildberriesAdapter(client).fetch_page(
            "synthetic-token", None, MarketplaceStream.REVIEWS, None,
        )

    assert result.error_code == "rate_limited"
    assert result.retry_after_seconds == expected_delay
    assert len(transport.requests) == 1


@pytest.mark.parametrize("value", ["-1", "nan", "86401", "9" * 100, "9" * 5000])
@pytest.mark.asyncio
async def test_wb_malformed_cooldown_uses_bounded_existing_retry(value: str) -> None:
    transport = SequenceTransport([response(429, headers={"X-Ratelimit-Retry": value}) for _ in range(3)])
    async with httpx.AsyncClient(
        base_url="https://feedbacks-api.wildberries.ru", transport=transport.mock(),
    ) as client:
        result = await WildberriesAdapter(client).fetch_page(
            "synthetic-token", None, MarketplaceStream.REVIEWS, None,
        )

    assert result.error_code == "rate_limited"
    assert result.retry_after_seconds is None
    assert len(transport.requests) == 3
