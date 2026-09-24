from __future__ import annotations

import httpx
import pytest

from app.adapters.avito_reviews import AvitoReviewAdapter
from app.adapters.capabilities import MarketplaceStream
from app.models.enums import MessageStatus
from app.tests.marketplace_fixtures import SequenceTransport, response

_CREDENTIAL = '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}'


def _token() -> httpx.Response:
    return response(200, json={"access_token": "synthetic-token", "token_type": "Bearer", "expires_in": 3600})


def _review(review_id: int = 92312343, **changes: object) -> dict[str, object]:
    record: dict[str, object] = {
        "id": review_id,
        "score": 5,
        "stage": "done",
        "text": "",
        "usedInScore": True,
        "canAnswer": True,
        "createdAt": 1_757_855_200,
        "item": None,
        "sender": {"name": "Synthetic Buyer"},
        "images": [{"number": 1, "sizes": [{"size": "100x100", "url": "https://images.avito.ru/synthetic.jpg"}]}],
    }
    record.update(changes)
    return record


@pytest.mark.asyncio
async def test_review_read_probe_and_raw_offset_pagination() -> None:
    answered = _review(answer={"id": 123, "text": "Answered", "status": "published", "createdAt": 1_757_855_210})
    transport = SequenceTransport(
        [
            _token(),
            response(200, json={"reviews": [_review()] + [answered] * 49, "total": 51}),
            response(200, json={"reviews": [_review(92312344, item={"id": 98765, "title": "Real item"})], "total": 51}),
        ]
    )
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        adapter = AvitoReviewAdapter(client)
        first = await adapter.fetch_page(_CREDENTIAL, "123", MarketplaceStream.REVIEWS, None)
        second = await adapter.fetch_page(_CREDENTIAL, "123", MarketplaceStream.REVIEWS, "50")

    assert first.ok and first.data is not None
    assert [item.external_id for item in first.data.items] == ["92312343"]
    assert first.data.items[0].product is None
    assert first.data.items[0].customer_text == ""
    assert first.data.items[0].customer_display_name == "Synthetic Buyer"
    assert first.data.items[0].customer_photos == ("https://images.avito.ru/synthetic.jpg",)
    assert first.data.next_cursor == "50"
    assert len(first.data.resolutions) == 49
    assert all(item.status is MessageStatus.ANSWERED for item in first.data.resolutions)
    assert second.ok and second.data is not None
    assert second.data.items[0].product is not None
    assert second.data.items[0].product.external_id == "98765"
    assert second.data.next_cursor is None
    assert dict(transport.requests[1].url.params) == {"offset": "0", "limit": "50"}
    assert dict(transport.requests[2].url.params) == {"offset": "50", "limit": "50"}
    assert all(request.url.host == "api.avito.ru" for request in transport.requests)


@pytest.mark.asyncio
async def test_review_credential_validation_is_read_only() -> None:
    transport = SequenceTransport([_token(), response(200, json={"reviews": [], "total": 0})])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).validate_credentials(_CREDENTIAL, "123")

    assert result.ok and result.data is not None
    assert result.data.scopes == ("reviews:read", "reviews:write")
    assert [request.method for request in transport.requests] == ["POST", "GET"]


@pytest.mark.asyncio
async def test_unanswerable_and_pending_answers_become_reconciliation_only() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(
                200,
                json={
                    "reviews": [
                        _review(1, canAnswer=False),
                        _review(2, answer={"id": 10, "text": "", "status": "moderation", "createdAt": 1_757_855_210}),
                        _review(3, answer={"id": 11, "text": "Rejected", "status": "rejected", "createdAt": 1_757_855_210}),
                    ],
                    "total": 3,
                },
            ),
        ]
    )
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).fetch_page(_CREDENTIAL, None, MarketplaceStream.REVIEWS, None)

    assert result.ok and result.data is not None
    assert result.data.items == ()
    assert [(item.external_id, item.status) for item in result.data.resolutions] == [
        ("1", MessageStatus.BLOCKED_BY_MARKETPLACE),
        ("2", MessageStatus.WAITING_REVIEW),
        ("3", MessageStatus.NEEDS_MANUAL_CHECK),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"reviews": [], "total": 1},
        {"reviews": [_review(score=0)], "total": 1},
        {"reviews": [_review(canAnswer="true")], "total": 1},
        {"reviews": [_review(images=[{"number": 1, "sizes": [{"size": "100x100", "url": "http://unsafe.invalid/a"}]}])], "total": 1},
        {"reviews": [_review(answer={"id": 2, "text": "x", "status": "unknown", "createdAt": 1})], "total": 1},
    ],
)
async def test_malformed_or_partial_review_page_fails_closed(payload: dict[str, object]) -> None:
    transport = SequenceTransport([_token(), response(200, json=payload)])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).fetch_page(_CREDENTIAL, None, MarketplaceStream.REVIEWS, None)

    assert result.ok is False
    assert result.error_code == "malformed_payload"
