from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from app.adapters.base import MarketplacePage, NormalizedMessage
from app.adapters.conversation import ConversationMessage, ConversationThread
from app.models.enums import MessageType


@dataclass(frozen=True, slots=True)
class AvitoChatProjection:
    page: MarketplacePage[NormalizedMessage]
    can_mark_read: bool


class InvalidAvitoChatTurn(ValueError):
    pass


class AvitoChatIngestService:

    def project(
        self,
        chat: ConversationThread,
        messages: tuple[ConversationMessage, ...],
    ) -> AvitoChatProjection:
        chat_type = chat.metadata.get("chat_type")
        if not isinstance(chat_type, str) or not chat_type or chat_type != chat_type.strip() or len(chat_type) > 32:
            raise InvalidAvitoChatTurn("Avito chat type is invalid")
        ordered = sorted(messages, key=lambda item: (item.created_unix, item.external_id))
        unread_inbound = [message for message in ordered if message.direction == "in" and not message.is_read]
        names_by_author = {participant.external_id: participant.name for participant in chat.participants}
        normalized: list[NormalizedMessage] = []
        unsupported_unread = False
        for message in unread_inbound:
            if message.kind != "text" or message.text is None:
                unsupported_unread = True
                continue
            try:
                created_at = datetime.fromtimestamp(message.created_unix, tz=UTC)
            except (OverflowError, OSError, ValueError) as exc:
                raise InvalidAvitoChatTurn("Avito message timestamp is invalid") from exc
            normalized.append(
                NormalizedMessage(
                    external_id=message.external_id,
                    message_type=MessageType.CHAT,
                    rating=None,
                    customer_display_name=names_by_author.get(message.author_id),
                    customer_text=message.text,
                    customer_photos=(),
                    marketplace_created_at=created_at,
                    product=chat.product,
                    metadata={
                        "source": "avito",
                        "status": "unread",
                        "chat_id": chat.external_id,
                        "chat_type": chat_type,
                        "author_type": "customer",
                        "direction": "in",
                    },
                )
            )
        return AvitoChatProjection(
            page=MarketplacePage(items=tuple(normalized), next_cursor=None),
            can_mark_read=bool(unread_inbound) and not unsupported_unread,
        )
