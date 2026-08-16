from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

import httpx


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


@dataclass(frozen=True)
class OpenRouterKeyMetadata:
    is_management_key: bool
    is_provisioning_key: bool


@dataclass(frozen=True)
class OpenRouterModel:
    id: str
    name: str
    input_modalities: tuple[str, ...]
    output_modalities: tuple[str, ...]
    context_length: int | None
    prompt_price: Decimal | None
    completion_price: Decimal | None
    expiration_date: datetime | None


class OpenRouterProviderError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, error_code: str = "openrouter_error") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


class OpenRouterProvider:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        site_url: str | None = None,
        app_title: str = "MPReply",
        timeout_seconds: float = 45.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.site_url = site_url
        self.app_title = app_title
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    async def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 600,
        provider_order: list[str] | None = None,
        allow_fallbacks: bool = True,
    ) -> LLMCompletion:
        self._validate_api_key()
        started_at = time.perf_counter()
        payload: dict[str, object] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if provider_order:
            payload["provider"] = {"order": provider_order, "allow_fallbacks": allow_fallbacks}

        async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
            except httpx.TimeoutException as exc:
                raise OpenRouterProviderError("OpenRouter request timed out", error_code="openrouter_timeout") from exc
            except httpx.HTTPError as exc:
                raise OpenRouterProviderError("OpenRouter network error", error_code="openrouter_network_error") from exc

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        data = self._safe_json(response)
        if not response.is_success:
            raise OpenRouterProviderError(
                self._safe_error_message(data),
                status_code=response.status_code,
                error_code=self._map_status(response.status_code),
            )
        text = self.extract_text(data)
        return LLMCompletion(
            text=text,
            model=str(data.get("model") or model),
            usage=self.extract_usage(data.get("usage")),
            latency_ms=latency_ms,
            raw_response=data,
        )

    async def get_current_key(self) -> OpenRouterKeyMetadata:
        data = await self._get("/key")
        metadata_value = data.get("data")
        if not isinstance(metadata_value, dict):
            raise OpenRouterProviderError(
                "OpenRouter key metadata is malformed",
                error_code="openrouter_malformed_response",
            )
        metadata = cast(dict[str, object], metadata_value)
        is_management_key = metadata.get("is_management_key")
        is_provisioning_key = metadata.get("is_provisioning_key")
        if not isinstance(is_management_key, bool) or not isinstance(is_provisioning_key, bool):
            raise OpenRouterProviderError(
                "OpenRouter key metadata is malformed",
                error_code="openrouter_malformed_response",
            )
        return OpenRouterKeyMetadata(
            is_management_key=is_management_key,
            is_provisioning_key=is_provisioning_key,
        )

    async def list_user_models(self) -> list[OpenRouterModel]:
        data = await self._get("/models/user")
        models_value = data.get("data")
        if not isinstance(models_value, list):
            raise OpenRouterProviderError(
                "OpenRouter model catalog is malformed",
                error_code="openrouter_malformed_response",
            )
        models: list[OpenRouterModel] = []
        for value in cast(list[object], models_value):
            model = self._parse_model(value)
            if model is not None:
                models.append(model)
        return models

    async def _get(self, path: str) -> dict[str, object]:
        self._validate_api_key()
        async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport) as client:
            try:
                response = await client.get(f"{self.base_url}{path}", headers=self._headers())
            except httpx.TimeoutException as exc:
                raise OpenRouterProviderError(
                    "OpenRouter request timed out",
                    error_code="openrouter_timeout",
                ) from exc
            except httpx.HTTPError as exc:
                raise OpenRouterProviderError(
                    "OpenRouter network error",
                    error_code="openrouter_network_error",
                ) from exc
        data = self._safe_json(response)
        if not response.is_success:
            raise OpenRouterProviderError(
                "OpenRouter request failed",
                status_code=response.status_code,
                error_code=self._map_status(response.status_code),
            )
        return data

    @classmethod
    def _parse_model(cls, value: object) -> OpenRouterModel | None:
        if not isinstance(value, dict):
            return None
        raw = cast(dict[str, object], value)
        model_id = _bounded_string(raw.get("id"), max_length=255)
        name = _bounded_string(raw.get("name"), max_length=255)
        architecture_value = raw.get("architecture")
        if model_id is None or name is None or not isinstance(architecture_value, dict):
            return None
        architecture = cast(dict[str, object], architecture_value)
        input_modalities = _string_tuple(architecture.get("input_modalities"))
        output_modalities = _string_tuple(architecture.get("output_modalities"))
        if input_modalities is None or output_modalities is None or "text" not in output_modalities:
            return None

        prompt_price: Decimal | None = None
        completion_price: Decimal | None = None
        pricing_value = raw.get("pricing")
        if pricing_value is not None:
            if not isinstance(pricing_value, dict):
                return None
            pricing = cast(dict[str, object], pricing_value)
            prompt_value = pricing.get("prompt")
            completion_value = pricing.get("completion")
            prompt_price = _non_negative_decimal_or_none(prompt_value)
            completion_price = _non_negative_decimal_or_none(completion_value)
            if (prompt_value is not None and prompt_price is None) or (
                completion_value is not None and completion_price is None
            ):
                return None

        return OpenRouterModel(
            id=model_id,
            name=name,
            input_modalities=input_modalities,
            output_modalities=output_modalities,
            context_length=_positive_int_or_none(raw.get("context_length")),
            prompt_price=prompt_price,
            completion_price=completion_price,
            expiration_date=_datetime_or_none(raw.get("expiration_date")),
        )

    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-OpenRouter-Title": self.app_title,
        }
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        return headers

    def _validate_api_key(self) -> None:
        if not self.api_key or self.api_key.startswith("replace-"):
            raise OpenRouterProviderError("OpenRouter API key is not configured", error_code="openrouter_not_configured")

    @staticmethod
    def _safe_json(response: httpx.Response) -> dict[str, object]:
        try:
            payload: object = response.json()
        except json.JSONDecodeError:
            return {}
        if not isinstance(payload, dict):
            return {}
        return cast(dict[str, object], payload)

    @staticmethod
    def extract_text(data: dict[str, object]) -> str:
        choices_value = data.get("choices")
        if not isinstance(choices_value, list) or not choices_value:
            raise OpenRouterProviderError("OpenRouter response has no choices", error_code="openrouter_empty_response")
        choices = cast(list[object], choices_value)
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise OpenRouterProviderError("OpenRouter response choice is malformed", error_code="openrouter_malformed_response")
        choice = cast(dict[str, object], first_choice)
        message_value = choice.get("message")
        if not isinstance(message_value, dict):
            raise OpenRouterProviderError("OpenRouter response message is malformed", error_code="openrouter_malformed_response")
        message = cast(dict[str, object], message_value)
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise OpenRouterProviderError("OpenRouter response content is empty", error_code="openrouter_empty_response")
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
        return "OpenRouter returned an error"

    @staticmethod
    def _map_status(status_code: int) -> str:
        if status_code in {401, 403}:
            return "openrouter_auth_error"
        if status_code == 429:
            return "openrouter_rate_limited"
        if 500 <= status_code <= 599:
            return "openrouter_unavailable"
        return "openrouter_error"


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


def _bounded_string(value: object, *, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized or len(normalized) > max_length:
        return None
    return normalized


def _string_tuple(value: object) -> tuple[str, ...] | None:
    if not isinstance(value, list) or len(value) > 16:
        return None
    normalized: list[str] = []
    for item in cast(list[object], value):
        parsed = _bounded_string(item, max_length=32)
        if parsed is None:
            return None
        if parsed not in normalized:
            normalized.append(parsed)
    return tuple(normalized)


def _positive_int_or_none(value: object) -> int | None:
    if type(value) is int and value > 0:
        return value
    return None


def _non_negative_decimal_or_none(value: object) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = Decimal(str(value))
    except (ArithmeticError, ValueError):
        return None
    if not parsed.is_finite() or parsed < 0:
        return None
    return parsed


def _datetime_or_none(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)
