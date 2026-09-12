from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Generic, Literal, Protocol, TypeVar, runtime_checkable

from app.adapters.capabilities import MarketplaceStream
from app.models.enums import Marketplace, MessageType

MarketplaceErrorCode = Literal[
    "invalid_credentials",
    "insufficient_scope",
    "marketplace_validation_error",
    "marketplace_not_found",
    "rate_limited",
    "marketplace_unavailable",
    "network_timeout",
    "network_error",
    "malformed_payload",
    "unsupported_capability",
]

T_co = TypeVar("T_co", covariant=True, default=object)


def _empty_metadata() -> dict[str, object]:
    return {}


@dataclass(frozen=True)
class AdapterResult(Generic[T_co]):
    ok: bool
    data: T_co | None = None
    error_code: MarketplaceErrorCode | None = None
    error_message_safe: str | None = None
    retry_after_seconds: int | None = None


@dataclass(frozen=True, slots=True)
class MarketplacePage(Generic[T_co]):
    items: tuple[T_co, ...]
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class CredentialValidation:
    scopes: tuple[str, ...]
    account_reference: str | None


@dataclass(frozen=True, slots=True)
class NormalizedProduct:
    external_id: str
    sku: str | None
    name: str
    brand: str | None
    category: str | None
    image_url: str | None
    product_url: str | None
    metadata: dict[str, object] = field(default_factory=_empty_metadata)


@dataclass(frozen=True, slots=True)
class NormalizedMessage:
    external_id: str
    message_type: MessageType
    rating: int | None
    customer_display_name: str | None
    customer_text: str
    customer_photos: tuple[str, ...]
    marketplace_created_at: datetime
    product: NormalizedProduct | None
    metadata: dict[str, object] = field(default_factory=_empty_metadata)


@dataclass(frozen=True, slots=True)
class ProviderMessageContext:
    message_type: MessageType
    external_id: str
    marketplace_created_at: datetime
    metadata: dict[str, object] = field(default_factory=_empty_metadata)


@dataclass(frozen=True, slots=True)
class ExistingReplyResult:
    exists: bool
    provider_reply_id: str | None = None
    provider_state: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderWriteReceipt:
    provider_reply_id: str


@runtime_checkable
class CredentialAdapter(Protocol):
    marketplace: Marketplace

    async def validate_credentials(
        self,
        credential: str,
        seller_id: str | None,
    ) -> AdapterResult[CredentialValidation]: ...


@runtime_checkable
class ReviewQuestionAdapter(CredentialAdapter, Protocol):
    async def fetch_page(
        self,
        credential: str,
        seller_id: str | None,
        stream: MarketplaceStream,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]: ...

    async def find_existing_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]: ...

    async def send_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]: ...


class MarketplaceAdapter(ABC):
    marketplace: str

    @abstractmethod
    async def validate_credentials(self, credential: str) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def fetch_reviews(self, credential: str, cursor: str | None = None) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def fetch_questions(self, credential: str, cursor: str | None = None) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def send_review_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def send_question_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        raise NotImplementedError


MarketplaceOperation = Literal["validate", "fetch_reviews", "fetch_questions", "send_review_reply", "send_question_reply"]
