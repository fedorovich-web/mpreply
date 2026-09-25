from app.models.enums import Marketplace
from app.services.marketplace_ingest_service import (
    sanitize_message_metadata,
    sanitize_product_metadata,
)


def test_message_metadata_allowlist_drops_secrets_and_raw_payloads() -> None:
    metadata = sanitize_message_metadata(
        Marketplace.OZON,
        {
            "source": "ozon.reviews",
            "status": "NEW",
            "is_answered": False,
            "Api-Key": "synthetic-secret",
            "Authorization": "Bearer synthetic-token",
            "raw": {"client_secret": "synthetic-client-secret"},
            "unexpected": "discard me",
        },
    )

    assert metadata == {
        "source": "ozon.reviews",
        "status": "NEW",
        "is_answered": False,
    }
    assert "synthetic" not in repr(metadata)


def test_metadata_allowlist_rejects_nested_and_oversized_values() -> None:
    metadata = sanitize_message_metadata(
        Marketplace.AVITO,
        {
            "source": {"nested": "not persisted"},
            "chat_id": "x" * 513,
            "direction": "inbound",
        },
    )

    assert metadata == {"direction": "inbound"}


def test_product_metadata_is_provider_specific_and_bounded() -> None:
    metadata = sanitize_product_metadata(
        Marketplace.WILDBERRIES,
        {
            "nm_id": 123,
            "imt_id": 456,
            "supplier_article": "SKU-1",
            "offer_id": "must-not-cross-provider-boundary",
            "raw": {"credential": "synthetic-secret"},
        },
    )

    assert metadata == {
        "nm_id": 123,
        "imt_id": 456,
        "supplier_article": "SKU-1",
    }


def test_wildberries_review_evidence_survives_metadata_sanitization_without_raw_payload() -> None:
    metadata = sanitize_message_metadata(
        Marketplace.WILDBERRIES,
        {
            "source": "wildberries.feedbacks",
            "review_video_url": "https://videofeedback01.wbbasket.ru/review/index.m3u8",
            "review_deficiencies": ["цена", "размер"],
            "raw": {"Authorization": "synthetic-secret"},
        },
    )

    assert metadata == {
        "source": "wildberries.feedbacks",
        "review_video_url": "https://videofeedback01.wbbasket.ru/review/index.m3u8",
        "review_deficiencies": ["цена", "размер"],
    }


def test_wildberries_review_evidence_rejects_unsafe_metadata_values() -> None:
    metadata = sanitize_message_metadata(
        Marketplace.WILDBERRIES,
        {"review_video_url": "javascript:alert(1)", "review_deficiencies": ["цена", "\x00secret"]},
    )

    assert metadata == {}
