from collections.abc import Callable

import httpx
import pytest

from app.adapters.base import AdapterResult, CredentialValidation
from app.adapters.capabilities import AVITO_CAPABILITY, MarketplaceCapability, MarketplaceStream
from app.adapters.http import MarketplaceHttpClients
from app.adapters.registry import (
    MarketplaceAdapterRegistry,
    ProviderRegistration,
    UnsupportedCapabilityError,
    create_marketplace_registry,
)
from app.adapters.wildberries import WildberriesAdapter
from app.models.enums import Marketplace, MessageType


class _CredentialOnlyAdapter:
    marketplace = Marketplace.WILDBERRIES

    async def validate_credentials(
        self,
        credential: str,
        seller_id: str | None,
    ) -> AdapterResult[CredentialValidation]:
        del credential, seller_id
        return AdapterResult(ok=True, data=CredentialValidation(scopes=(), account_reference=None))


def _must_not_construct() -> object:
    raise AssertionError("unsupported capability constructed a provider adapter")


def _registry(factory: Callable[[], object]) -> MarketplaceAdapterRegistry:
    return MarketplaceAdapterRegistry(
        {
            Marketplace.AVITO: ProviderRegistration(
                capability=AVITO_CAPABILITY,
                credential_factory=factory,
            )
        }
    )


def test_registry_rejects_review_question_lookup_for_avito_before_construction() -> None:
    registry = _registry(_must_not_construct)

    with pytest.raises(UnsupportedCapabilityError) as captured:
        registry.review_questions(Marketplace.AVITO, MarketplaceStream.QUESTIONS)

    assert captured.value.error_code == "unsupported_capability"
    assert captured.value.marketplace is Marketplace.AVITO
    assert captured.value.required_streams == frozenset({MarketplaceStream.QUESTIONS})


@pytest.mark.asyncio
async def test_registry_resolves_existing_review_and_question_streams() -> None:
    clients = MarketplaceHttpClients.create(transport=httpx.MockTransport(lambda request: httpx.Response(500)))
    try:
        registry = create_marketplace_registry(clients)
        for marketplace in (Marketplace.WILDBERRIES, Marketplace.OZON, Marketplace.YANDEX_MARKET):
            reviews = registry.review_questions(marketplace, MarketplaceStream.REVIEWS)
            questions = registry.review_questions(marketplace, MarketplaceStream.QUESTIONS)
            assert reviews is questions
            assert reviews.marketplace is marketplace
    finally:
        await clients.aclose()


@pytest.mark.asyncio
async def test_review_only_registration_rejects_questions_before_factory_invocation() -> None:
    clients = MarketplaceHttpClients.create(transport=httpx.MockTransport(lambda request: httpx.Response(500)))
    constructions = 0

    def make_review_adapter() -> WildberriesAdapter:
        nonlocal constructions
        constructions += 1
        return WildberriesAdapter(client=clients.wildberries)

    try:
        registry = MarketplaceAdapterRegistry(
            {
                Marketplace.WILDBERRIES: ProviderRegistration(
                    capability=MarketplaceCapability(
                        marketplace=Marketplace.WILDBERRIES,
                        streams=frozenset({MarketplaceStream.REVIEWS}),
                        reply_types=frozenset({MessageType.REVIEW}),
                    ),
                    credential_factory=make_review_adapter,
                    review_factory=make_review_adapter,
                )
            }
        )
        with pytest.raises(UnsupportedCapabilityError):
            registry.review_questions(Marketplace.WILDBERRIES, MarketplaceStream.QUESTIONS)
        assert constructions == 0
        assert registry.review_questions(Marketplace.WILDBERRIES, MarketplaceStream.REVIEWS).marketplace is Marketplace.WILDBERRIES
        assert constructions == 1
    finally:
        await clients.aclose()


def test_registry_returns_the_same_lifecycle_owned_credential_adapter() -> None:
    adapter = _CredentialOnlyAdapter()
    registry = MarketplaceAdapterRegistry(
        {
            Marketplace.WILDBERRIES: ProviderRegistration(
                capability=MarketplaceCapability(
                    marketplace=Marketplace.WILDBERRIES,
                    streams=frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}),
                    reply_types=frozenset({MessageType.REVIEW, MessageType.QUESTION}),
                ),
                credential_factory=lambda: adapter,
            )
        }
    )

    assert registry.credentials(Marketplace.WILDBERRIES) is adapter
    assert registry.credentials(Marketplace.WILDBERRIES) is adapter


def test_registry_rejects_adapter_owned_by_another_marketplace() -> None:
    registry = _registry(_CredentialOnlyAdapter)

    with pytest.raises(UnsupportedCapabilityError) as captured:
        registry.credentials(Marketplace.AVITO)

    assert captured.value.marketplace is Marketplace.AVITO


def test_registry_rejects_capability_registered_under_the_wrong_key() -> None:
    with pytest.raises(ValueError, match="registration key does not match capability marketplace"):
        MarketplaceAdapterRegistry(
            {
                Marketplace.OZON: ProviderRegistration(
                    capability=AVITO_CAPABILITY,
                    credential_factory=_must_not_construct,
                )
            }
        )
