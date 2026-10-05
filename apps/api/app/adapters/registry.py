from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import TypeVar

from app.adapters.avito import AvitoAdapter
from app.adapters.avito_account import AvitoCredentialAdapter
from app.adapters.avito_auth import AvitoCredentialResolver
from app.adapters.avito_reviews import AvitoReviewAdapter
from app.adapters.base import CredentialAdapter, ReviewQuestionAdapter
from app.adapters.capabilities import (
    AVITO_CAPABILITY,
    OZON_CAPABILITY,
    WILDBERRIES_CAPABILITY,
    YANDEX_MARKET_CAPABILITY,
    MarketplaceCapability,
    MarketplaceStream,
)
from app.adapters.conversation import ConversationAdapter
from app.adapters.http import MarketplaceHttpClients
from app.adapters.ozon import OzonAdapter
from app.adapters.wildberries import WildberriesAdapter
from app.adapters.wildberries_read_limiter import WildberriesReadLimiter
from app.adapters.yandex_market import YandexMarketAdapter
from app.core.config import get_settings
from app.models.enums import Marketplace

ProviderFactory = Callable[[], object]
AdapterT = TypeVar("AdapterT", bound=CredentialAdapter)


@dataclass(frozen=True, slots=True)
class ProviderRegistration:
    capability: MarketplaceCapability
    credential_factory: ProviderFactory
    review_factory: ProviderFactory | None = None
    conversation_factory: ProviderFactory | None = None


class UnsupportedCapabilityError(RuntimeError):
    error_code = "unsupported_capability"

    def __init__(self, marketplace: Marketplace, required_streams: frozenset[MarketplaceStream]) -> None:
        super().__init__(f"{marketplace.value} does not support the requested marketplace capability")
        self.marketplace = marketplace
        self.required_streams = required_streams


class MarketplaceAdapterRegistry:
    def __init__(self, registrations: Mapping[Marketplace, ProviderRegistration]) -> None:
        for marketplace, registration in registrations.items():
            if registration.capability.marketplace is not marketplace:
                raise ValueError("registration key does not match capability marketplace")
        self._registrations = dict(registrations)
        self._instances: dict[tuple[Marketplace, str], object] = {}

    def credentials(self, marketplace: Marketplace) -> CredentialAdapter:
        return self._resolve_role(marketplace, "credentials", CredentialAdapter)

    def review_questions(self, marketplace: Marketplace, stream: MarketplaceStream) -> ReviewQuestionAdapter:
        required = frozenset({stream})
        if stream not in {MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}:
            raise UnsupportedCapabilityError(marketplace, required)
        self._require_streams(marketplace, required)
        return self._resolve_role(marketplace, "reviews", ReviewQuestionAdapter)

    def conversations(self, marketplace: Marketplace) -> ConversationAdapter:
        required = frozenset({MarketplaceStream.CHATS})
        self._require_streams(marketplace, required)
        return self._resolve_role(marketplace, "conversations", ConversationAdapter)

    def capability(self, marketplace: Marketplace) -> MarketplaceCapability:
        return self._registration(marketplace).capability

    def _resolve_role(self, marketplace: Marketplace, role: str, expected: type[AdapterT]) -> AdapterT:
        registration = self._registration(marketplace)
        key = (marketplace, role)
        instance = self._instances.get(key)
        if instance is None:
            factory = {
                "credentials": registration.credential_factory,
                "reviews": registration.review_factory,
                "conversations": registration.conversation_factory,
            }[role]
            if factory is None:
                raise UnsupportedCapabilityError(marketplace, registration.capability.streams)
            instance = factory()
            self._instances[key] = instance
        if not isinstance(instance, expected) or instance.marketplace is not marketplace:
            raise UnsupportedCapabilityError(marketplace, registration.capability.streams)
        return instance

    def _require_streams(self, marketplace: Marketplace, required: frozenset[MarketplaceStream]) -> None:
        registration = self._registration(marketplace)
        if not required.issubset(registration.capability.streams):
            raise UnsupportedCapabilityError(marketplace, required)

    def _registration(self, marketplace: Marketplace) -> ProviderRegistration:
        registration = self._registrations.get(marketplace)
        if registration is None:
            raise UnsupportedCapabilityError(marketplace, frozenset())
        return registration


def create_marketplace_registry(clients: MarketplaceHttpClients) -> MarketplaceAdapterRegistry:
    avito_resolver = AvitoCredentialResolver(clients.avito)
    wb_limiter = WildberriesReadLimiter() if get_settings().app_env == "production" else None
    return MarketplaceAdapterRegistry(
        {
            Marketplace.AVITO: ProviderRegistration(
                capability=AVITO_CAPABILITY,
                credential_factory=lambda: AvitoCredentialAdapter(client=clients.avito, credential_resolver=avito_resolver),
                review_factory=lambda: AvitoReviewAdapter(client=clients.avito, credential_resolver=avito_resolver),
                conversation_factory=lambda: AvitoAdapter(client=clients.avito, credential_resolver=avito_resolver),
            ),
            Marketplace.WILDBERRIES: ProviderRegistration(
                capability=WILDBERRIES_CAPABILITY,
                credential_factory=lambda: WildberriesAdapter(client=clients.wildberries, read_limiter=wb_limiter),
                review_factory=lambda: WildberriesAdapter(client=clients.wildberries, read_limiter=wb_limiter),
            ),
            Marketplace.OZON: ProviderRegistration(
                capability=OZON_CAPABILITY,
                credential_factory=lambda: OzonAdapter(client=clients.ozon),
                review_factory=lambda: OzonAdapter(client=clients.ozon),
            ),
            Marketplace.YANDEX_MARKET: ProviderRegistration(
                capability=YANDEX_MARKET_CAPABILITY,
                credential_factory=lambda: YandexMarketAdapter(client=clients.yandex_market),
                review_factory=lambda: YandexMarketAdapter(client=clients.yandex_market),
            ),
        }
    )
