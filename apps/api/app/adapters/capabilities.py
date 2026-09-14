from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import cast

from app.models.enums import Marketplace, MessageType


class MarketplaceStream(StrEnum):
    REVIEWS = "reviews"
    QUESTIONS = "questions"
    CHATS = "chats"


@dataclass(frozen=True, slots=True)
class MarketplaceCapability:
    marketplace: Marketplace
    streams: frozenset[MarketplaceStream]
    reply_types: frozenset[MessageType]

    def supports_stream(self, stream: MarketplaceStream) -> bool:
        return stream in self.streams

    def supports_reply_type(self, message_type: MessageType) -> bool:
        return message_type in self.reply_types


_REVIEW_QUESTION_STREAMS = frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS})
_REVIEW_QUESTION_REPLIES = frozenset({MessageType.REVIEW, MessageType.QUESTION})

WILDBERRIES_CAPABILITY = MarketplaceCapability(
    marketplace=Marketplace.WILDBERRIES,
    streams=_REVIEW_QUESTION_STREAMS,
    reply_types=_REVIEW_QUESTION_REPLIES,
)
OZON_CAPABILITY = MarketplaceCapability(
    marketplace=Marketplace.OZON,
    streams=_REVIEW_QUESTION_STREAMS,
    reply_types=_REVIEW_QUESTION_REPLIES,
)
YANDEX_MARKET_CAPABILITY = MarketplaceCapability(
    marketplace=Marketplace.YANDEX_MARKET,
    streams=_REVIEW_QUESTION_STREAMS,
    reply_types=_REVIEW_QUESTION_REPLIES,
)
AVITO_CAPABILITY = MarketplaceCapability(
    marketplace=Marketplace.AVITO,
    streams=frozenset({MarketplaceStream.CHATS}),
    reply_types=frozenset({MessageType.CHAT}),
)

_CAPABILITIES = {
    capability.marketplace: capability
    for capability in (
        WILDBERRIES_CAPABILITY,
        OZON_CAPABILITY,
        YANDEX_MARKET_CAPABILITY,
        AVITO_CAPABILITY,
    )
}

_STREAM_READ_SCOPES = {
    MarketplaceStream.REVIEWS: "reviews:read",
    MarketplaceStream.QUESTIONS: "questions:read",
    MarketplaceStream.CHATS: "chats:read",
}
_MESSAGE_WRITE_SCOPES = {
    MessageType.REVIEW: "reviews:write",
    MessageType.QUESTION: "questions:write",
    MessageType.CHAT: "chats:write",
}


def get_marketplace_capability(marketplace: Marketplace | str) -> MarketplaceCapability:
    try:
        normalized = marketplace if isinstance(marketplace, Marketplace) else Marketplace(marketplace)
    except ValueError:
        raise ValueError("unsupported marketplace") from None
    return _CAPABILITIES[normalized]


def validated_scope_names(scopes_json: Mapping[str, object]) -> frozenset[str]:
    value = scopes_json.get("scopes")
    if not isinstance(value, list):
        return frozenset()
    items = cast(list[object], value)
    if not all(isinstance(item, str) and item for item in items):
        return frozenset()
    return frozenset(cast(str, item) for item in items)


def read_scope_for_stream(stream: MarketplaceStream) -> str:
    return _STREAM_READ_SCOPES[stream]


def write_scope_for_message(message_type: MessageType) -> str:
    return _MESSAGE_WRITE_SCOPES[message_type]


def streams_for_scopes(
    capability_streams: frozenset[MarketplaceStream],
    scopes_json: Mapping[str, object],
) -> frozenset[MarketplaceStream]:
    scopes = validated_scope_names(scopes_json)
    return frozenset(
        stream
        for stream in capability_streams
        if read_scope_for_stream(stream) in scopes
    )
