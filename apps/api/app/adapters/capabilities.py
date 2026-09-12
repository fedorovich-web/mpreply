from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

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


def get_marketplace_capability(marketplace: Marketplace | str) -> MarketplaceCapability:
    try:
        normalized = marketplace if isinstance(marketplace, Marketplace) else Marketplace(marketplace)
    except ValueError:
        raise ValueError("unsupported marketplace") from None
    return _CAPABILITIES[normalized]
