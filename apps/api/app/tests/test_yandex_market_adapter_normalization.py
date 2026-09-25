from datetime import UTC, datetime

from app.adapters.yandex_market import YandexMarketAdapter
from app.models.enums import MessageStatus, MessageType


def test_normalizes_yandex_market_review() -> None:
    adapter = YandexMarketAdapter()
    normalized = adapter.normalize_review(
        {
            "feedbackId": 991,
            "createdAt": "2026-07-24T10:15:00+03:00",
            "needReaction": True,
            "author": "Покупатель",
            "identifiers": {"offerId": "SKU-42", "orderId": 123456},
            "description": {
                "advantages": "Удобно",
                "disadvantages": "Нет",
                "comment": "Хороший товар",
            },
            "media": {"photos": [{"url": "https://example.test/photo.jpg"}]},
            "statistics": {"rating": 5, "commentsCount": 0, "recommended": True},
        }
    )

    assert normalized["external_id"] == "991"
    assert normalized["type"] == MessageType.REVIEW.value
    assert normalized["status"] == MessageStatus.NEEDS_REPLY.value
    assert normalized["rating"] == 5
    assert normalized["customer_display_name"] == "Покупатель"
    assert normalized["customer_text"] == "Хороший товар\nПлюсы: Удобно\nМинусы: Нет"  # noqa: RUF001
    assert normalized["marketplace_created_at"] == datetime.fromisoformat("2026-07-24T10:15:00+03:00")
    product = normalized["product"]
    assert isinstance(product, dict)
    assert product["external_id"] == "SKU-42"
    assert product["sku"] == "SKU-42"


def test_normalizes_yandex_market_question() -> None:
    adapter = YandexMarketAdapter()
    normalized = adapter.normalize_question(
        {
            "questionIdentifiers": {"id": 77, "offerId": "OFFER-1", "categoryId": 44},
            "businessId": 900,
            "text": "Подойдёт ли для улицы?",
            "createdAt": "2026-07-24T07:00:00Z",
            "votes": {"likeCount": 3, "dislikeCount": 0},
            "author": {"name": "Иван", "type": "USER"},
        }
    )

    assert normalized["external_id"] == "77"
    assert normalized["type"] == MessageType.QUESTION.value
    assert normalized["customer_text"] == "Подойдёт ли для улицы?"
    assert normalized["customer_display_name"] == "Иван"
    assert normalized["marketplace_created_at"] == datetime(2026, 7, 24, 7, 0, tzinfo=UTC)
    product = normalized["product"]
    assert isinstance(product, dict)
    assert product["external_id"] == "OFFER-1"


def test_extractors_ignore_malformed_payloads() -> None:
    adapter = YandexMarketAdapter()

    assert adapter.extract_reviews(None) == []
    assert adapter.extract_reviews({"result": {"feedbacks": "not-a-list"}}) == []
    assert adapter.extract_questions({"result": {"questions": [{"id": 1}, "bad"]}}) == [{"id": 1}]
