import pytest

from app.adapters.base import NormalizedMessage, NormalizedProduct
from app.adapters.wildberries import WildberriesAdapter
from app.models.enums import MessageType


def test_wildberries_extracts_feedbacks_from_nested_payload():
    adapter = WildberriesAdapter()
    payload = {"data": {"feedbacks": [{"id": "fb-1", "text": "ok"}]}}

    assert adapter.extract_reviews(payload) == [{"id": "fb-1", "text": "ok"}]


def test_wildberries_normalizes_feedback_without_customer_name():
    adapter = WildberriesAdapter()
    normalized = adapter.normalize_review(
        {
            "id": "fb-1",
            "text": "Хороший товар",
            "productValuation": 5,
            "createdDate": "2026-07-08T10:00:00Z",
            "productDetails": {"nmId": 123, "productName": "Кроссовки", "brandName": "Brand"},
        }
    )

    assert isinstance(normalized, NormalizedMessage)
    assert normalized.external_id == "fb-1"
    assert normalized.message_type is MessageType.REVIEW
    assert normalized.rating == 5
    assert normalized.customer_text == "Хороший товар"
    assert isinstance(normalized.product, NormalizedProduct)
    assert normalized.product.external_id == "123"
    assert normalized.product.name == "Кроссовки"
    assert normalized.product.metadata == {"nm_id": 123}


def test_wildberries_normalizes_question():
    adapter = WildberriesAdapter()
    normalized = adapter.normalize_question(
        {
            "id": "q-1",
            "question": "Подойдёт на рост 170?",
            "createdDate": "2026-07-08T10:00:00Z",
            "nmId": 777,
            "productName": "Куртка",
        }
    )

    assert isinstance(normalized, NormalizedMessage)
    assert normalized.external_id == "q-1"
    assert normalized.message_type is MessageType.QUESTION
    assert normalized.rating is None
    assert normalized.customer_text == "Подойдёт на рост 170?"
    assert isinstance(normalized.product, NormalizedProduct)
    assert normalized.product.external_id == "777"


@pytest.mark.parametrize(
    "payload",
    [
        {"id": "fb-1", "text": "Valid", "nmId": 1},
        {"id": "fb-1", "text": "Valid", "nmId": 1, "createdDate": "not-a-date"},
        {"text": "Valid", "nmId": 1, "createdDate": "2026-07-08T10:00:00Z"},
        {"id": "fb-1", "text": "Valid", "createdDate": "2026-07-08T10:00:00Z"},
    ],
)
def test_wildberries_rejects_malformed_required_fields(payload: dict[str, object]) -> None:
    with pytest.raises(ValueError):
        WildberriesAdapter().normalize_review(payload)
