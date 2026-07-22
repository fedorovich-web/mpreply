from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class AdapterResult:
    ok: bool
    data: object | None = None
    error_code: str | None = None
    error_message_safe: str | None = None
    next_cursor: str | None = None


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
    async def send_review_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    async def send_question_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        raise NotImplementedError

    @abstractmethod
    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        raise NotImplementedError


MarketplaceOperation = Literal["validate", "fetch_reviews", "fetch_questions", "send_review_reply", "send_question_reply"]
