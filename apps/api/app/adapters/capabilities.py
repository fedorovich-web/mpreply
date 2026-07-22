from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.adapters.base import MarketplaceOperation
from app.models.enums import Marketplace, MessageType

IntegrationStatus = Literal["enabled", "planned"]
PaginationStrategy = Literal["offset", "page_token", "none", "unknown"]


@dataclass(frozen=True)
class MarketplaceCapability:
    marketplace: Marketplace
    integration_status: IntegrationStatus
    operations: tuple[MarketplaceOperation, ...]
    message_types: tuple[MessageType, ...]
    polling_enabled: bool
    pagination_strategy: PaginationStrategy
    notes: str

    @property
    def connection_enabled(self) -> bool:
        return self.integration_status == "enabled" and "validate" in self.operations

    @property
    def scheduler_enabled(self) -> bool:
        return self.connection_enabled and self.polling_enabled


_CAPABILITIES: dict[Marketplace, MarketplaceCapability] = {
    Marketplace.WILDBERRIES: MarketplaceCapability(
        marketplace=Marketplace.WILDBERRIES,
        integration_status="enabled",
        operations=(
            "validate",
            "fetch_reviews",
            "fetch_questions",
            "send_review_reply",
            "send_question_reply",
        ),
        message_types=(MessageType.REVIEW, MessageType.QUESTION),
        polling_enabled=True,
        pagination_strategy="offset",
        notes="Implemented and covered by the Respio Wildberries adapter contract.",
    ),
    Marketplace.OZON: MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="planned",
        operations=(),
        message_types=(),
        polling_enabled=False,
        pagination_strategy="unknown",
        notes="No production adapter is enabled in Respio yet.",
    ),
    Marketplace.YANDEX_MARKET: MarketplaceCapability(
        marketplace=Marketplace.YANDEX_MARKET,
        integration_status="planned",
        operations=(),
        message_types=(),
        polling_enabled=False,
        pagination_strategy="unknown",
        notes="No production adapter is enabled in Respio yet.",
    ),
    Marketplace.AVITO: MarketplaceCapability(
        marketplace=Marketplace.AVITO,
        integration_status="planned",
        operations=(),
        message_types=(),
        polling_enabled=False,
        pagination_strategy="unknown",
        notes="No production adapter is enabled in Respio yet.",
    ),
}


def get_marketplace_capability(marketplace: Marketplace | str) -> MarketplaceCapability:
    value = marketplace if isinstance(marketplace, Marketplace) else Marketplace(marketplace)
    return _CAPABILITIES[value]


def list_marketplace_capabilities() -> tuple[MarketplaceCapability, ...]:
    return tuple(_CAPABILITIES[marketplace] for marketplace in Marketplace)


def scheduler_marketplaces() -> tuple[str, ...]:
    return tuple(capability.marketplace.value for capability in _CAPABILITIES.values() if capability.scheduler_enabled)
