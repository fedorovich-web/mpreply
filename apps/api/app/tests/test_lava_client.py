from __future__ import annotations

import json
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.providers.lava import LavaClient, LavaError


def configured(**overrides: object) -> Settings:
    return Settings.model_validate({"lava_enabled": True, "lava_api_key": SecretStr("provider" + "a" * 32),
                                    "lava_webhook_secret": SecretStr("webhook" + "b" * 32),
                                    "lava_offer_id": uuid4(), "lava_product_id": uuid4(), **overrides})


@pytest.mark.parametrize("field,value", [("lava_api_key", ""), ("lava_webhook_secret", ""), ("lava_offer_id", None),
                                        ("lava_product_id", None), ("lava_webhook_secret", "short")])
def test_enabled_lava_requires_complete_separate_credentials(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        configured(**{field: value})


def test_webhook_key_cannot_reuse_outbound_api_key() -> None:
    with pytest.raises(ValidationError):
        configured(lava_webhook_secret="provider" + "a" * 32)


def test_disabled_lava_accepts_empty_compose_identifiers() -> None:
    settings = Settings.model_validate({"lava_enabled": False, "lava_offer_id": "", "lava_product_id": ""})
    assert settings.lava_offer_id is None and settings.lava_product_id is None


@pytest.mark.asyncio
async def test_create_invoice_uses_one_time_server_price_and_opaque_correlation() -> None:
    settings = configured()
    invoice_id = uuid4()
    calls: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://gate.lava.top/api/v3/invoice"
        assert request.headers["X-Api-Key"] == settings.lava_api_key.get_secret_value()
        body = json.loads(request.content)
        calls.append(body)
        assert body["amount"] == 1290
        assert body["periodicity"] == "ONE_TIME"
        assert body["currency"] == "RUB"
        assert body["offerId"] == str(settings.lava_offer_id)
        assert body["clientUtm"] == {"utm_content": "opaque-order-reference"}
        assert body["successful_return_url"] == "https://app.mpreply.ru/app/billing?order=123"
        return httpx.Response(200, json={"id": str(invoice_id), "status": "new", "amountTotal": {"currency": "RUB", "amount": 1290},
                                        "paymentUrl": "https://app.lava.top/invoice/example"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        result = await LavaClient(settings=settings, http=http).create_invoice(
            email="buyer@example.com", offer_id=settings.lava_offer_id, amount_minor=129000,
            correlation="opaque-order-reference", return_urls={"successful_return_url": "https://app.mpreply.ru/app/billing?order=123"},
        )
    assert result.id == invoice_id
    assert result.payment_url == "https://app.lava.top/invoice/example"
    assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("amount,minor", [("549", 54900), ("40254.19", 4025419)])
async def test_get_invoice_converts_major_units_exactly(amount: str, minor: int) -> None:
    invoice_id = uuid4()
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/api/v1/invoices/{invoice_id}"
        return httpx.Response(200, content=json.dumps({"id": str(invoice_id), "status": "completed", "receipt": {
            "amount": amount, "currency": "RUB"}, "clientUtm": {"utm_content": "correlation"}}).encode())
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        result = await LavaClient(settings=configured(), http=http).get_invoice(invoice_id)
    assert result.amount_minor == minor
    assert result.status == "completed"
    assert result.correlation == "correlation"


@pytest.mark.asyncio
@pytest.mark.parametrize("amount", ["NaN", "Infinity", "-1", "1.001", "21474836.48", True])
async def test_invalid_provider_amount_cannot_be_verified(amount: object) -> None:
    invoice_id = uuid4()
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={
        "id": str(invoice_id), "status": "completed", "receipt": {"amount": amount, "currency": "RUB"},
    }))) as http:
        with pytest.raises(LavaError):
            await LavaClient(settings=configured(), http=http).get_invoice(invoice_id)


@pytest.mark.asyncio
async def test_timeout_creating_invoice_is_not_retried_or_exposed() -> None:
    calls = 0
    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("secret-provider-response", request=request)
    settings = configured()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(LavaError) as failure:
            await LavaClient(settings=settings, http=http).create_invoice(
                email="buyer@example.com", offer_id=settings.lava_offer_id, amount_minor=29900, correlation="ref", return_urls={},
            )
    assert calls == 1
    assert "secret-provider-response" not in str(failure.value)
    assert failure.value.ambiguous


@pytest.mark.asyncio
@pytest.mark.parametrize("url", ["http://app.lava.top/pay", "https://evil.example/pay", "https://user:secret@app.lava.top/pay", None])
async def test_invalid_checkout_url_fails_closed(url: str | None) -> None:
    settings = configured()
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={
        "id": str(uuid4()), "status": "new", "paymentUrl": url,
    }))) as http:
        with pytest.raises(LavaError):
            await LavaClient(settings=settings, http=http).create_invoice(
                email="buyer@example.com", offer_id=settings.lava_offer_id, amount_minor=29900, correlation="ref", return_urls={},
            )
