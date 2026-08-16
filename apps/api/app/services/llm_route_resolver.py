from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.models.enums import MessageType


class LLMConfigurationError(RuntimeError):
    def __init__(self, error_code: str) -> None:
        super().__init__(error_code)
        self.error_code = error_code


@dataclass(frozen=True)
class LLMModelRoutes:
    review_model: str
    negative_review_model: str
    question_model: str
    chat_model: str
    safety_retry_model: str
    fallback_model: str


@dataclass(frozen=True)
class LLMRuntimeConfiguration:
    api_key: str
    source: Literal["database", "environment"]
    routes: LLMModelRoutes


class LLMRouteResolver:
    @staticmethod
    def select_model(
        routes: LLMModelRoutes,
        *,
        message_type: str,
        rating: int | None,
    ) -> str:
        if message_type == MessageType.REVIEW.value:
            if rating is not None and rating <= 2:
                return routes.negative_review_model
            return routes.review_model
        if message_type == MessageType.QUESTION.value:
            return routes.question_model
        if message_type == MessageType.CHAT.value:
            return routes.chat_model
        raise LLMConfigurationError("openrouter_unsupported_message_type")
