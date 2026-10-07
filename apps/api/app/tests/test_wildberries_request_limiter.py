from __future__ import annotations

from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from app.adapters.wildberries_request_limiter import WildberriesCoordinationUnavailable, WildberriesRequestLimiter


async def test_rotated_tokens_share_a_sellers_budget_and_ping_stays_independent(monkeypatch: pytest.MonkeyPatch) -> None:
    import base64
    import json

    payload = base64.urlsafe_b64encode(json.dumps({"sid": "11111111-1111-4111-8111-111111111111"}).encode()).decode().rstrip("=")
    cooldowns: dict[str, int] = {}

    async def evaluate(script: str, count: int, *args: object) -> int:
        key = str(args[0])
        if len(args) == 3:
            return cooldowns.get(key, 0)
        cooldowns[key] = int(str(args[-1]))
        return 0

    redis = AsyncMock()
    redis.eval.side_effect = evaluate
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    limiter = WildberriesRequestLimiter()
    requests: list[str] = []

    async def provider(path: str) -> httpx.Response:
        requests.append(path)
        return httpx.Response(200, headers={"X-Ratelimit-Remaining": "0", "X-Ratelimit-Reset": "566"})

    await limiter.request(f"first.{payload}.signature", "/api/v1/feedbacks", lambda: provider("feedbacks"))
    assert (await limiter.request(f"rotated.{payload}.signature", "/api/v1/questions", lambda: provider("questions"))).status_code == 429
    assert (await limiter.request(f"rotated.{payload}.signature", "/ping", lambda: provider("ping"))).status_code == 200
    assert requests == ["feedbacks", "ping"]
    assert "11111111-1111" not in str(redis.eval.call_args)


async def test_feedback_cooldown_covers_questions_and_detail_reads(monkeypatch: pytest.MonkeyPatch) -> None:
    cooldowns: dict[str, int] = {}

    async def evaluate(script: str, count: int, *args: object) -> int:
        key = str(args[0])
        if len(args) == 3:
            return cooldowns.get(key, 0)
        cooldowns[key] = int(str(args[-1]))
        return 0

    redis = AsyncMock()
    redis.eval.side_effect = evaluate
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    limiter = WildberriesRequestLimiter()
    paths: list[str] = []

    async def provider(path: str) -> httpx.Response:
        paths.append(path)
        return httpx.Response(200, headers={"X-Ratelimit-Remaining": "0", "X-Ratelimit-Reset": "566"})

    await limiter.request("synthetic-secret", "/api/v1/feedbacks", lambda: provider("feedbacks"))
    result = await limiter.request("synthetic-secret", "/api/v1/question", lambda: provider("question"))
    assert result.status_code == 429
    assert result.headers["Retry-After"] == "566"
    assert paths == ["feedbacks"]


async def test_wb_write_obeys_the_same_cooldown_as_preflight(monkeypatch: pytest.MonkeyPatch) -> None:
    from datetime import UTC, datetime

    from app.adapters.base import ProviderMessageContext
    from app.adapters.wildberries import WildberriesAdapter
    from app.models.enums import MessageType

    redis = AsyncMock()
    redis.eval.side_effect = [566]
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    requests: list[httpx.Request] = []

    def provider(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(204)

    async with httpx.AsyncClient(base_url="https://feedbacks-api.wildberries.ru", transport=httpx.MockTransport(provider)) as client:
        result = await WildberriesAdapter(client, read_limiter=WildberriesRequestLimiter()).send_reply(
            "synthetic-secret", None,
            ProviderMessageContext(message_type=MessageType.REVIEW, external_id="review-1", marketplace_created_at=datetime.now(UTC)),
            "Synthetic answer",
        )
    assert result.error_code == "rate_limited"
    assert result.retry_after_seconds == 566
    assert requests == []


@pytest.mark.parametrize("cleanup", ["release", "close"])
async def test_coordination_cleanup_cannot_discard_a_confirmed_write(monkeypatch: pytest.MonkeyPatch, cleanup: str) -> None:
    from datetime import UTC, datetime

    from redis.exceptions import RedisError

    from app.adapters.base import ProviderMessageContext
    from app.adapters.wildberries import WildberriesAdapter
    from app.models.enums import MessageType

    redis = AsyncMock()
    redis.eval.side_effect = [0, RedisError("unavailable")] if cleanup == "release" else [0, 0]
    if cleanup == "close":
        redis.aclose.side_effect = RedisError("unavailable")
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    writes: list[str] = []

    def provider(request: httpx.Request) -> httpx.Response:
        writes.append(request.method)
        return httpx.Response(204)

    async with httpx.AsyncClient(base_url="https://feedbacks-api.wildberries.ru", transport=httpx.MockTransport(provider)) as client:
        result = await WildberriesAdapter(client, read_limiter=WildberriesRequestLimiter()).send_reply("synthetic-token", None,
            ProviderMessageContext(message_type=MessageType.REVIEW, external_id="review-1", marketplace_created_at=datetime.now(UTC)), "Answer")
    assert result.ok and result.data and result.data.provider_reply_id == "review-1"
    assert writes == ["POST"]


async def test_coordination_outage_is_explicitly_not_a_provider_write(monkeypatch: pytest.MonkeyPatch) -> None:
    from datetime import UTC, datetime

    from redis.exceptions import RedisError

    from app.adapters.base import ProviderMessageContext
    from app.adapters.wildberries import WildberriesAdapter
    from app.models.enums import MessageType

    redis = AsyncMock()
    redis.eval.side_effect = RedisError("unavailable")
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    writes: list[str] = []

    def provider(request: httpx.Request) -> httpx.Response:
        writes.append(request.method)
        return httpx.Response(204)

    async with httpx.AsyncClient(base_url="https://feedbacks-api.wildberries.ru", transport=httpx.MockTransport(provider)) as client:
        result = await WildberriesAdapter(client, read_limiter=WildberriesRequestLimiter()).send_reply("synthetic-token", None,
            ProviderMessageContext(message_type=MessageType.REVIEW, external_id="review-1", marketplace_created_at=datetime.now(UTC)), "Answer")
    assert result.error_code == "coordination_unavailable"
    assert result.retry_after_seconds == 30
    assert writes == []


async def test_shared_wb_cooldown_prevents_another_provider_request(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.eval.side_effect = [465]
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock()
    result = await WildberriesRequestLimiter().request("synthetic-secret", "/api/v1/questions", provider)
    assert result.status_code == 429 and result.headers["Retry-After"] == "465"
    provider.assert_not_awaited()
    assert "synthetic-secret" not in str(redis.eval.call_args)
    redis.aclose.assert_awaited_once()


async def test_provider_cooldown_is_persisted_and_request_lock_released(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.eval.side_effect = [0, 0]
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock(return_value=httpx.Response(429, headers={"X-Ratelimit-Retry": "465"}))
    result = await WildberriesRequestLimiter().request("synthetic-secret", "/api/v1/feedbacks", provider)
    assert result.status_code == 429
    provider.assert_awaited_once()
    assert redis.eval.await_args_list[1].args[-1] == 465


async def test_success_exhausting_budget_saves_provider_reset(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = AsyncMock()
    redis.eval.side_effect = [0, 0]
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock(return_value=httpx.Response(200, headers={"X-Ratelimit-Remaining": "0", "X-Ratelimit-Reset": "300"}))
    assert (await WildberriesRequestLimiter().request("synthetic-secret", "/api/v1/questions", provider)).status_code == 200
    assert redis.eval.await_args_list[1].args[-1] == 300


async def test_limiter_outage_never_sends_an_uncoordinated_provider_request(monkeypatch: pytest.MonkeyPatch) -> None:
    from redis.exceptions import RedisError

    redis = AsyncMock()
    redis.eval.side_effect = RedisError("unavailable")
    monkeypatch.setattr("app.adapters.wildberries_request_limiter.redis_from_url", Mock(return_value=redis))
    provider = AsyncMock()
    with pytest.raises(WildberriesCoordinationUnavailable):
        await WildberriesRequestLimiter().request("synthetic-secret", "/ping", provider)
    provider.assert_not_awaited()
