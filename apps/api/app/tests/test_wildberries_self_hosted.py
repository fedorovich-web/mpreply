from __future__ import annotations

import base64
import json
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.base import ProviderMessageContext
from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import MarketplaceHttpClients
from app.adapters.registry import create_marketplace_registry
from app.adapters.wildberries import WildberriesAdapter
from app.adapters.wildberries_request_limiter import WildberriesRequestLimiter
from app.core.config import Settings
from app.models.enums import Marketplace, MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

OWNER = "12345678-1234-1234-1234-123456789abc"
OWNER_HASH = "04e3d9f2dd10d828ccf1b01bf451d1dc5595e9e2484a8d05af051b1c7fe4a934"
BASE_URL = "https://feedbacks-api.wildberries.ru"


def _token(**overrides: object) -> str:
    payload = {"s": 1 << 7, "acc": 3, "sid": OWNER, "t": False, **overrides}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"synthetic.{encoded}.signature"


@pytest.mark.parametrize("account_type", [1, 3])
async def test_own_installation_can_validate_preflight_and_write_for_its_seller(account_type: int) -> None:
    transport = SequenceTransport([
        response(200, json={"Status": "OK"}),
        response(200, json={"data": {"id": "review-1", "answer": None, "state": "none"}}),
        response(204),
    ])
    context = ProviderMessageContext(message_type=MessageType.REVIEW, external_id="review-1", marketplace_created_at=datetime.now(UTC))
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = WildberriesAdapter(client, self_hosted_seller_hash=OWNER_HASH)
        token = _token(acc=account_type)
        validation = await adapter.validate_credentials(token)
        existing = await adapter.find_existing_reply(token, None, context)
        sent = await adapter.send_reply(token, None, context, "Synthetic answer")
    assert validation.ok and existing.ok and sent.ok
    assert existing.data is not None and not existing.data.exists
    assert sent.data is not None
    assert [(request.method, request.url.path) for request in transport.requests] == [
        ("GET", "/ping"), ("GET", "/api/v1/feedback"), ("POST", "/api/v1/feedbacks/answer"),
    ]
    assert all("X-Client-Secret" not in request.headers for request in transport.requests)


@pytest.mark.parametrize("claims", [
    {"sid": "22345678-1234-1234-1234-123456789abc"},
    {"sid": None}, {"sid": "invalid"}, {"acc": 2}, {"acc": 4},
    {"acc": True}, {"t": True}, {"t": "false"},
])
async def test_own_installation_blocks_other_sellers_and_ineligible_tokens_before_http(claims: dict[str, object]) -> None:
    transport = SequenceTransport([])
    context = ProviderMessageContext(message_type=MessageType.REVIEW, external_id="review-1", marketplace_created_at=datetime.now(UTC))
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = WildberriesAdapter(client, self_hosted_seller_hash=OWNER_HASH)
        token = _token(**claims)
        results = [
            await adapter.validate_credentials(token),
            await adapter.fetch_page(token, None, MarketplaceStream.REVIEWS, None),
            await adapter.find_existing_reply(token, None, context),
            await adapter.send_reply(token, None, context, "Synthetic answer"),
        ]
    assert all(result.error_code == "insufficient_scope" for result in results)
    assert transport.requests == []


@pytest.mark.parametrize(("cloud", "secret"), [(True, None), (False, "synthetic-secret")])
async def test_own_installation_cannot_be_combined_with_cloud_auth(cloud: bool, secret: str | None) -> None:
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        with pytest.raises(ValueError, match="self-hosted"):
            WildberriesAdapter(client, self_hosted_seller_hash=OWNER_HASH, cloud_integration=cloud, service_secret=secret)


async def test_production_own_registry_keeps_coordination_for_both_adapter_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    # Provider IO is simulated; the production registry and adapter paths are real.
    paths: list[str] = []

    class RecordingLimiter(WildberriesRequestLimiter):
        async def request(self, credential: str, path: str, request: Callable[[], Awaitable[httpx.Response]]) -> httpx.Response:
            paths.append(path)
            return await request()

    settings = Settings().model_copy(update={
        "app_env": "production", "wb_integration_mode": "self_hosted", "wb_self_hosted_seller_hash": OWNER_HASH,
    })
    monkeypatch.setattr("app.adapters.registry.get_settings", lambda: settings)
    monkeypatch.setattr("app.adapters.registry.WildberriesRequestLimiter", RecordingLimiter)
    transport = SequenceTransport([
        response(200, json={"Status": "OK"}),
        response(200, json={"data": {"id": "review-1", "answer": None, "state": "none"}}),
        response(204),
    ])
    clients = MarketplaceHttpClients.create(transport=transport.mock())
    try:
        registry = create_marketplace_registry(clients)
        validation = await registry.credentials(Marketplace.WILDBERRIES).validate_credentials(_token(), None)
        adapter = registry.review_questions(Marketplace.WILDBERRIES, MarketplaceStream.REVIEWS)
        context = ProviderMessageContext(message_type=MessageType.REVIEW, external_id="review-1", marketplace_created_at=datetime.now(UTC))
        existing = await adapter.find_existing_reply(_token(), None, context)
        sent = await adapter.send_reply(_token(), None, context, "Synthetic answer")
    finally:
        await clients.aclose()
    assert validation.ok and existing.ok and sent.ok
    assert paths == ["/ping", "/api/v1/feedback", "/api/v1/feedbacks/answer"]
