from __future__ import annotations

import asyncio
import json
import random
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import cast

import httpx

_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
_MAX_RETRY_DELAY_SECONDS = 8.0


@dataclass(frozen=True)
class LLMUsage:
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    cost: Decimal | None


@dataclass(frozen=True)
class LLMCompletion:
    text: str
    model: str
    usage: LLMUsage
    latency_ms: int
    raw_response: dict[str, object]


class GroqProviderError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, error_code: str = "groq_error") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


class GroqProvider:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.groq.com/openai/v1",
        timeout_seconds: float = 45.0,
        max_attempts: int = 3,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not 1 <= max_attempts <= 5:
            raise ValueError("max_attempts must be between 1 and 5")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_attempts = max_attempts
        self.transport = transport

    async def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 600,
    ) -> LLMCompletion:
        self._validate_api_key()
        started_at = time.perf_counter()
        payload: dict[str, object] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
            "reasoning_effort": "none",
            "response_format": self._response_format(),
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport) as client:
            response: httpx.Response | None = None
            for attempt in range(1, self.max_attempts + 1):
                try:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    )
                except httpx.TimeoutException as exc:
                    raise GroqProviderError("Groq request timed out", error_code="groq_timeout") from exc
                except httpx.HTTPError as exc:
                    raise GroqProviderError("Groq network error", error_code="groq_network_error") from exc

                if response.status_code not in _RETRYABLE_STATUS_CODES or attempt >= self.max_attempts:
                    break

                await asyncio.sleep(self._retry_delay_seconds(response=response, attempt=attempt))

        if response is None:  # pragma: no cover - defensive invariant
            raise GroqProviderError("Groq request did not produce a response", error_code="groq_network_error")

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        data = self._safe_json(response)
        if not response.is_success:
            raise GroqProviderError(
                self._safe_error_message(data),
                status_code=response.status_code,
                error_code=self._map_status(response.status_code),
            )

        return LLMCompletion(
            text=self.extract_text(data),
            model=str(data.get("model") or model),
            usage=self.extract_usage(data.get("usage")),
            latency_ms=latency_ms,
            raw_response=data,
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _validate_api_key(self) -> None:
        if not self.api_key or self.api_key.startswith("replace-"):
            raise GroqProviderError("Groq API key is not configured", error_code="groq_not_configured")

    @staticmethod
    def _response_format() -> dict[str, object]:
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "marketplace_reply",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "answer": {"type": "string", "minLength": 1},
                        "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
                        "safety_flags": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["answer", "confidence_score", "safety_flags"],
                    "additionalProperties": False,
                },
            },
        }

    @staticmethod
    def _retry_delay_seconds(*, response: httpx.Response, attempt: int) -> float:
        retry_after = response.headers.get("Retry-After")
        if retry_after is not None:
            try:
                parsed = float(retry_after)
            except ValueError:
                parsed = -1.0
            if parsed >= 0:
                return min(parsed, _MAX_RETRY_DELAY_SECONDS)

        exponential = 0.5 * (2 ** (attempt - 1))
        jitter = random.uniform(0.0, 0.25)
        return min(exponential + jitter, _MAX_RETRY_DELAY_SECONDS)

    @staticmethod
    def _safe_json(response: httpx.Response) -> dict[str, object]:
        try:
            payload: object = response.json()
        except (json.JSONDecodeError, ValueError):
            return {}
        if not isinstance(payload, dict):
            return {}
        return cast(dict[str, object], payload)

    @staticmethod
    def extract_text(data: dict[str, object]) -> str:
        choices_value = data.get("choices")
        if not isinstance(choices_value, list) or not choices_value:
            raise GroqProviderError("Groq response has no choices", error_code="groq_empty_response")
        choices = cast(list[object], choices_value)
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise GroqProviderError("Groq response choice is malformed", error_code="groq_malformed_response")
        choice = cast(dict[str, object], first_choice)
        message_value = choice.get("message")
        if not isinstance(message_value, dict):
            raise GroqProviderError("Groq response message is malformed", error_code="groq_malformed_response")
        message = cast(dict[str, object], message_value)
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise GroqProviderError("Groq response content is empty", error_code="groq_empty_response")
        return content.strip()

    @staticmethod
    def extract_usage(raw_usage: object) -> LLMUsage:
        usage = cast(dict[str, object], raw_usage) if isinstance(raw_usage, dict) else {}
        cost_value = usage.get("cost")
        cost = Decimal(str(cost_value)) if cost_value is not None else None
        return LLMUsage(
            prompt_tokens=_int_or_none(usage.get("prompt_tokens")),
            completion_tokens=_int_or_none(usage.get("completion_tokens")),
            total_tokens=_int_or_none(usage.get("total_tokens")),
            cost=cost,
        )

    @staticmethod
    def _safe_error_message(data: dict[str, object]) -> str:
        error_value = data.get("error")
        if isinstance(error_value, dict):
            error = cast(dict[str, object], error_value)
            message = error.get("message")
            if isinstance(message, str):
                return message
        message = data.get("message")
        if isinstance(message, str):
            return message
        return "Groq returned an error"

    @staticmethod
    def _map_status(status_code: int) -> str:
        if status_code in {401, 403}:
            return "groq_auth_error"
        if status_code == 429:
            return "groq_rate_limited"
        if 500 <= status_code <= 599:
            return "groq_unavailable"
        return "groq_error"


def _int_or_none(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float | str):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    return None
