from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

ProviderMessageContext = Mapping[str, object]


@dataclass(frozen=True)
class AdapterResult:
    ok: bool
    data: object | None = None
    error_code: str | None = None
    error_message_safe: str | None = None
    next_cursor: str | None = None
    retry_after_seconds: int | None = None


class MarketplaceAdapter(ABC):
    marketplace: str

    @abstractmethod
    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        raise NotImplementedError

    @abstractmethod
    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        raise NotImplementedError

    @abstractmethod
    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        raise NotImplementedError

    @abstractmethod
    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        raise NotImplementedError

    @abstractmethod
    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        raise NotImplementedError


MarketplaceOperation = Literal[
    "validate",
    "fetch_reviews",
    "fetch_questions",
    "fetch_chats",
    "send_review_reply",
    "send_question_reply",
    "send_chat_message",
]
