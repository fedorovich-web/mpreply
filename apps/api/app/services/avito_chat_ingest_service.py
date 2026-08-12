from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.conversation import AvitoChat, AvitoMessage
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType, ReplyStatus
from app.models.marketplace_account import MarketplaceAccount
from app.models.reply import Reply
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService

_TERMINAL_REPLY_STATUSES = {
    ReplyStatus.SENT.value,
    ReplyStatus.FAILED.value,
    ReplyStatus.BLOCKED.value,
}
_ARCHIVABLE_MESSAGE_STATUSES = {
    MessageStatus.NEW.value,
    MessageStatus.IMPORTED.value,
    MessageStatus.NEEDS_REPLY.value,
    MessageStatus.AUTO_RULE_MATCHED.value,
    MessageStatus.AI_DRAFT_READY.value,
    MessageStatus.SAFETY_BLOCKED.value,
    MessageStatus.NEEDS_MANUAL_CHECK.value,
}


@dataclass(frozen=True)
class AvitoChatIngestResult:
    outcome: Literal["created", "updated", "skipped", "manual_review"]
    message_id: UUID | None
    can_mark_read: bool


class AvitoChatIngestService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.ingest = MarketplaceMessageIngestService(session)

    async def ingest_turn(
        self,
        *,
        account: MarketplaceAccount,
        chat: AvitoChat,
        messages: Sequence[AvitoMessage],
    ) -> AvitoChatIngestResult:
        if account.marketplace != Marketplace.AVITO.value or not _valid_chat(chat):
            return _skipped(can_mark_read=False)

        ordered: list[tuple[AvitoMessage, datetime]] = []
        for message in messages:
            created_at = _provider_datetime(message.created_unix)
            if created_at is None or not _valid_message(message):
                return _skipped(can_mark_read=False)
            if message.direction == "in" and not message.is_read and (
                message.kind != "text" or not isinstance(message.text, str) or not message.text
            ):
                return _skipped(can_mark_read=False)
            ordered.append((message, created_at))

        ordered.sort(key=lambda value: (value[0].created_unix, value[0].id))
        latest_outbound_index = max(
            (index for index, (message, _) in enumerate(ordered) if message.direction == "out"),
            default=-1,
        )
        after_boundary = ordered[latest_outbound_index + 1 :]
        turn_reversed: list[tuple[AvitoMessage, datetime]] = []
        for message, created_at in reversed(after_boundary):
            if message.direction != "in" or message.is_read:
                break
            turn_reversed.append((message, created_at))
        turn = list(reversed(turn_reversed))

        unread_after_boundary = [
            message for message, _ in after_boundary if message.direction == "in" and not message.is_read
        ]
        if not turn:
            return _skipped(can_mark_read=not unread_after_boundary)
        if len(turn) != len(unread_after_boundary):
            return _skipped(can_mark_read=False)

        latest_message, latest_created_at = turn[-1]
        chat_targets = list(
            (
                await self.session.execute(
                    select(CustomerMessage).where(
                        CustomerMessage.organization_id == account.organization_id,
                        CustomerMessage.marketplace_account_id == account.id,
                        CustomerMessage.marketplace == Marketplace.AVITO.value,
                        CustomerMessage.type == MessageType.CHAT.value,
                        CustomerMessage.metadata_json["avito_chat_id"].as_string() == chat.id,
                    )
                )
            )
            .scalars()
            .all()
        )
        target_ids = [message.id for message in chat_targets]
        active_replies = list(
            (
                await self.session.execute(
                    select(Reply).where(
                        Reply.organization_id == account.organization_id,
                        Reply.message_id.in_(target_ids),
                        Reply.status.not_in(_TERMINAL_REPLY_STATUSES),
                    )
                )
            )
            .scalars()
            .all()
        )
        active_reply_message_ids = {reply.message_id for reply in active_replies}
        requires_manual_review = bool(active_replies)

        product_payload, item_metadata = _product_context(chat)
        metadata: dict[str, object] = {
            "avito_chat_id": chat.id,
            "avito_chat_type": chat.chat_type,
            "avito_source_message_ids": [message.id for message, _ in turn],
            "avito_source_author_ids": [message.author_id for message, _ in turn],
            "avito_source_created_unix": [message.created_unix for message, _ in turn],
            "avito_inbound_created_unix": latest_message.created_unix,
            **item_metadata,
        }
        normalized: dict[str, object] = {
            "external_id": latest_message.id,
            "type": MessageType.CHAT.value,
            "status": (
                MessageStatus.NEEDS_MANUAL_CHECK.value
                if requires_manual_review
                else MessageStatus.NEEDS_REPLY.value
            ),
            "rating": None,
            "customer_display_name": chat.customer_name,
            "customer_text": "\n".join(message.text for message, _ in turn if message.text is not None),
            "customer_photos_json": list[object](),
            "marketplace_created_at": latest_created_at,
            "metadata_json": metadata,
            "product": product_payload,
        }
        ingest_outcome = await self.ingest.upsert_normalized_message(account, normalized)
        current = (
            await self.session.execute(
                select(CustomerMessage).where(
                    CustomerMessage.organization_id == account.organization_id,
                    CustomerMessage.marketplace_account_id == account.id,
                    CustomerMessage.marketplace == Marketplace.AVITO.value,
                    CustomerMessage.external_id == latest_message.id,
                    CustomerMessage.type == MessageType.CHAT.value,
                )
            )
        ).scalar_one_or_none()
        if current is None:
            return _skipped(can_mark_read=False)

        if requires_manual_review:
            current.status = MessageStatus.NEEDS_MANUAL_CHECK.value
        for previous in chat_targets:
            if (
                previous.id != current.id
                and previous.id not in active_reply_message_ids
                and previous.status in _ARCHIVABLE_MESSAGE_STATUSES
            ):
                previous.status = MessageStatus.ARCHIVED.value
        await self.session.flush()

        if requires_manual_review:
            outcome: Literal["created", "updated", "manual_review"] = "manual_review"
        elif ingest_outcome == "created":
            outcome = "created"
        else:
            outcome = "updated"
        return AvitoChatIngestResult(outcome=outcome, message_id=current.id, can_mark_read=True)


def _valid_chat(chat: AvitoChat) -> bool:
    return (
        bool(chat.id)
        and _provider_datetime(chat.created_unix) is not None
        and _provider_datetime(chat.updated_unix) is not None
    )


def _valid_message(message: AvitoMessage) -> bool:
    return (
        bool(message.id)
        and type(message.author_id) is int
        and message.direction in {"in", "out"}
        and type(message.is_read) is bool
        and (message.read_unix is None or _provider_datetime(message.read_unix) is not None)
    )


def _provider_datetime(value: object) -> datetime | None:
    if type(value) is not int or value < 0:
        return None
    try:
        return datetime.fromtimestamp(value, tz=UTC)
    except (OverflowError, OSError, ValueError):
        return None


def _product_context(chat: AvitoChat) -> tuple[dict[str, object] | None, dict[str, object]]:
    if (
        chat.chat_type != "u2i"
        or type(chat.item_id) is not int
        or chat.item_id <= 0
        or chat.item_title is None
        or not chat.item_title
        or (chat.item_url is not None and not chat.item_url)
    ):
        return None, {}
    item_metadata: dict[str, object] = {
        "avito_item_id": chat.item_id,
        "avito_item_title": chat.item_title,
        "avito_item_url": chat.item_url,
    }
    return (
        {
            "external_id": str(chat.item_id),
            "name": chat.item_title,
            "product_url": chat.item_url,
            "metadata_json": {},
        },
        item_metadata,
    )


def _skipped(*, can_mark_read: bool) -> AvitoChatIngestResult:
    return AvitoChatIngestResult(outcome="skipped", message_id=None, can_mark_read=can_mark_read)
