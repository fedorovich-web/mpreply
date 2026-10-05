from __future__ import annotations

from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from app.adapters.wildberries_read_limiter import WildberriesReadLimiter


async def test_shared_wb_cooldown_prevents_another_provider_request(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.eval.side_effect = [465]
    monkeypatch.setattr("app.adapters.wildberries_read_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock()
    result = await WildberriesReadLimiter().read("synthetic-secret", "/api/v1/questions", provider)
    assert result.status_code == 429 and result.headers["Retry-After"] == "465"
    provider.assert_not_awaited()
    assert "synthetic-secret" not in str(redis.eval.call_args)
    redis.aclose.assert_awaited_once()


async def test_provider_cooldown_is_persisted_and_request_lock_released(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.eval.side_effect = [0, 0]
    monkeypatch.setattr("app.adapters.wildberries_read_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock(return_value=httpx.Response(429, headers={"X-Ratelimit-Retry": "465"}))
    result = await WildberriesReadLimiter().read("synthetic-secret", "/api/v1/feedbacks", provider)
    assert result.status_code == 429
    provider.assert_awaited_once()
    assert redis.eval.await_args_list[1].args[-1] == 465


async def test_success_exhausting_budget_saves_provider_reset(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.eval.side_effect = [0, 0]
    monkeypatch.setattr("app.adapters.wildberries_read_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock(return_value=httpx.Response(200, headers={"X-Ratelimit-Remaining": "0", "X-Ratelimit-Reset": "300"}))
    assert (await WildberriesReadLimiter().read("synthetic-secret", "/api/v1/questions", provider)).status_code == 200
    assert redis.eval.await_args_list[1].args[-1] == 300


async def test_limiter_outage_never_sends_an_uncoordinated_provider_request(monkeypatch: pytest.MonkeyPatch) -> None:
    from redis.exceptions import RedisError

    redis = AsyncMock()
    redis.eval.side_effect = RedisError("unavailable")
    monkeypatch.setattr("app.adapters.wildberries_read_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock()
    assert (await WildberriesReadLimiter().read("synthetic-secret", "/ping", provider)).status_code == 503
    provider.assert_not_awaited()
