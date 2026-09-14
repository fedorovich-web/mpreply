from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import TypeVar

from app.adapters.base import CredentialAdapter, ReviewQuestionAdapter
from app.adapters.capabilities import WILDBERRIES_CAPABILITY, MarketplaceCapability, MarketplaceStream
from app.adapters.conversation import ConversationAdapter
from app.adapters.http import MarketplaceHttpClients
from app.adapters.wildberries import WildberriesAdapter
from app.models.enums import Marketplace

ProviderFactory = Callable[[], object]
AdapterT = TypeVar("AdapterT", bound=CredentialAdapter)


@dataclass(frozen=True, slots=True)
class ProviderRegistration:
    capability: MarketplaceCapability
    factory: ProviderFactory


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
        self._instances: dict[Marketplace, object] = {}

    def credentials(self, marketplace: Marketplace) -> CredentialAdapter:
        return self._resolve(marketplace, CredentialAdapter)

    def review_questions(self, marketplace: Marketplace) -> ReviewQuestionAdapter:
        required = frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS})
        self._require_streams(marketplace, required)
        return self._resolve(marketplace, ReviewQuestionAdapter)

    def conversations(self, marketplace: Marketplace) -> ConversationAdapter:
        required = frozenset({MarketplaceStream.CHATS})
        self._require_streams(marketplace, required)
        return self._resolve(marketplace, ConversationAdapter)

    def capability(self, marketplace: Marketplace) -> MarketplaceCapability:
        return self._registration(marketplace).capability

    def _resolve(self, marketplace: Marketplace, expected: type[AdapterT]) -> AdapterT:
        registration = self._registration(marketplace)
        instance = self._instances.get(marketplace)
        if instance is None:
            instance = registration.factory()
            self._instances[marketplace] = instance
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
    return MarketplaceAdapterRegistry(
        {
            Marketplace.WILDBERRIES: ProviderRegistration(
                capability=WILDBERRIES_CAPABILITY,
                factory=lambda: WildberriesAdapter(client=clients.wildberries),
            )
        }
    )
