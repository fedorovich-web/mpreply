from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import contact
from app.main import app
from app.services.transactional_email import EmailDeliveryError, TransactionalEmail


def payload() -> dict[str, str | bool]:
    return {
        "name": "Анна",
        "email": "anna@example.com",
        "topic": "support",
        "message": "New reviews are missing from the inbox.",
        "idempotency_key": str(uuid4()),
        "consent": True,
    }


@pytest.mark.asyncio
async def test_contact_message_uses_stable_request_key_and_escapes_html(monkeypatch: pytest.MonkeyPatch) -> None:
    delivered: list[TransactionalEmail] = []

    async def fake_send(_: object, message: TransactionalEmail) -> None:
        delivered.append(message)

    monkeypatch.setattr(contact.ResendEmailClient, "send", fake_send)
    data = payload()
    data["name"] = "  <Anna>  "
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/contact", json=data, headers={"X-CSRF-Token": "1"})
        repeated = await client.post("/api/contact", json=data, headers={"X-CSRF-Token": "1"})

    assert response.status_code == 202
    assert repeated.status_code == 202
    assert len(delivered) == 2
    assert delivered[0].idempotency_key == delivered[1].idempotency_key
    assert delivered[0].to == "support@mpreply.ru"
    assert delivered[0].sender == "MPReply <no-reply@mpreply.ru>"
    assert delivered[0].reply_to == "anna@example.com"
    assert "<Anna>" in delivered[0].text
    assert "&lt;Anna&gt;" in delivered[0].html


@pytest.mark.asyncio
async def test_contact_message_requires_csrf_and_valid_input(monkeypatch: pytest.MonkeyPatch) -> None:
    delivered: list[TransactionalEmail] = []

    async def fake_send(_: object, message: TransactionalEmail) -> None:
        delivered.append(message)

    monkeypatch.setattr(contact.ResendEmailClient, "send", fake_send)
    invalid = payload()
    invalid["message"] = "     "
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        without_csrf = await client.post("/api/contact", json=payload())
        invalid_response = await client.post("/api/contact", json=invalid, headers={"X-CSRF-Token": "1"})

    assert without_csrf.status_code == 403
    assert invalid_response.status_code == 422
    assert delivered == []


@pytest.mark.asyncio
async def test_contact_delivery_failure_does_not_claim_success(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_send(_: object, __: TransactionalEmail) -> None:
        raise EmailDeliveryError("simulated failure")

    monkeypatch.setattr(contact.ResendEmailClient, "send", fail_send)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/contact", json=payload(), headers={"X-CSRF-Token": "1"})

    assert response.status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize("consent", [False, None])
async def test_contact_requires_consent(monkeypatch: pytest.MonkeyPatch, consent: bool | None) -> None:
    delivered: list[TransactionalEmail] = []

    async def fake_send(_: object, message: TransactionalEmail) -> None:
        delivered.append(message)

    monkeypatch.setattr(contact.ResendEmailClient, "send", fake_send)
    data = payload()
    if consent is None:
        data.pop("consent")
    else:
        data["consent"] = consent
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/contact", json=data, headers={"X-CSRF-Token": "1"})
    assert response.status_code == 422
    assert delivered == []
