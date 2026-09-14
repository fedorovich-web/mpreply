from __future__ import annotations

from app.adapters.base import NormalizedProduct
from app.adapters.conversation import ConversationMessage, ConversationThread
from app.models.enums import MessageType
from app.services.avito_chat_ingest_service import AvitoChatIngestService


def _thread(product: NormalizedProduct | None = None) -> ConversationThread:
    return ConversationThread(
        external_id="chat-123",
        created_unix=1_723_456_789,
        updated_unix=1_723_456_790,
        customer_id="42",
        customer_name="Synthetic buyer",
        product=product,
        metadata={"chat_type": "item" if product is not None else "user"},
    )


def _message(
    message_id: str,
    *,
    kind: str = "text",
    text: str | None = "Synthetic text",
) -> ConversationMessage:
    return ConversationMessage(
        external_id=message_id,
        author_id="42",
        created_unix=1_723_456_791,
        direction="in",
        is_read=False,
        kind=kind,
        text=text,
    )


def test_avito_projects_each_real_unread_text_without_synthetic_product() -> None:
    projection = AvitoChatIngestService().project(
        _thread(),
        (_message("message-123"),),
    )

    assert projection.can_mark_read is True
    assert len(projection.page.items) == 1
    message = projection.page.items[0]
    assert message.external_id == "message-123"
    assert message.message_type is MessageType.CHAT
    assert message.product is None
    assert message.metadata == {
        "source": "avito",
        "status": "unread",
        "chat_id": "chat-123",
        "chat_type": "user",
        "author_type": "customer",
        "direction": "in",
    }


def test_avito_unsupported_unread_kind_is_not_silently_marked_read() -> None:
    projection = AvitoChatIngestService().project(
        _thread(),
        (
            _message("message-text"),
            _message("message-image", kind="image", text=None),
        ),
    )

    assert [item.external_id for item in projection.page.items] == ["message-text"]
    assert projection.can_mark_read is False


def test_avito_preserves_only_real_item_identity() -> None:
    product = NormalizedProduct(
        external_id="998877",
        sku=None,
        name="Synthetic item",
        brand=None,
        category=None,
        image_url=None,
        product_url="https://www.avito.ru/synthetic",
        metadata={"item_id": 998877},
    )
    projection = AvitoChatIngestService().project(
        _thread(product),
        (_message("message-123"),),
    )

    assert projection.page.items[0].product is product
