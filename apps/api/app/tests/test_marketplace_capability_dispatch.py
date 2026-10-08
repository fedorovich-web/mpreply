import pytest

from app.adapters.capabilities import MarketplaceStream, get_marketplace_capability
from app.models.enums import Marketplace, MessageType


@pytest.mark.parametrize(
    ("marketplace", "streams", "reply_types"),
    [
        (
            Marketplace.WILDBERRIES,
            frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}),
            frozenset({MessageType.REVIEW, MessageType.QUESTION}),
        ),
        (
            Marketplace.OZON,
            frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}),
            frozenset({MessageType.REVIEW, MessageType.QUESTION}),
        ),
        (
            Marketplace.YANDEX_MARKET,
            frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}),
            frozenset({MessageType.REVIEW, MessageType.QUESTION}),
        ),
        (
            Marketplace.AVITO,
            frozenset({MarketplaceStream.CHATS, MarketplaceStream.REVIEWS}),
            frozenset({MessageType.CHAT, MessageType.REVIEW}),
        ),
    ],
)
def test_marketplace_capabilities_match_supported_product_contract(
    marketplace: Marketplace,
    streams: frozenset[MarketplaceStream],
    reply_types: frozenset[MessageType],
) -> None:
    capability = get_marketplace_capability(marketplace)

    assert capability.marketplace is marketplace
    assert capability.streams == streams
    assert capability.reply_types == reply_types


def test_capability_lookup_rejects_unknown_marketplace() -> None:
    with pytest.raises(ValueError, match="unsupported marketplace"):
        get_marketplace_capability("unknown-provider")
