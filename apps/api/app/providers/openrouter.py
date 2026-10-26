from __future__ import annotations

import json
import time
from decimal import Decimal, InvalidOperation
from typing import cast

import httpx

from app.providers.llm import LLMCompletion, LLMUsage, reply_response_format

SUPPORTED_OPENROUTER_MODELS = frozenset({
    "openai/gpt-6-luna",
    "anthropic/claude-sonnet-5.5",
    "google/gemini-3.8-flash",
    "deepseek/deepseek-v4.1-flash",
})
_TEMPERATURE_MODELS = {"google/gemini-3.8-flash", "deepseek/deepseek-v4.1-flash"}
_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"


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
        timeout_seconds: float = 45.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    async def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 600,
    ) -> LLMCompletion:
        if not self.api_key.strip() or self.api_key != self.api_key.strip() or self.api_key.lower().startswith("replace-"):
            raise OpenRouterProviderError("OpenRouter API key is not configured", error_code="openrouter_not_configured")
        if model not in SUPPORTED_OPENROUTER_MODELS:
            raise OpenRouterProviderError("OpenRouter model is not supported", error_code="openrouter_invalid_model")
        if type(max_tokens) is not int or max_tokens < 1:
            raise OpenRouterProviderError("OpenRouter token limit is invalid", error_code="openrouter_invalid_request")
        if model == "anthropic/claude-sonnet-5.5" and max_tokens <= 1024:
            raise OpenRouterProviderError("OpenRouter token limit is too low for this model", error_code="openrouter_invalid_request")
        payload: dict[str, object] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "reasoning": {"effort": "low", "exclude": True},
            "provider": {"require_parameters": True, "allow_fallbacks": False},
            "response_format": reply_response_format(),
        }
        if model in _TEMPERATURE_MODELS:
            payload["temperature"] = temperature
        started_at = time.perf_counter()
        async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport, follow_redirects=False) as client:
            try:
                response = await client.post(
                    _COMPLETIONS_URL,
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json=payload,
                )
            except httpx.TimeoutException:
                raise OpenRouterProviderError("OpenRouter request timed out", error_code="openrouter_timeout") from None
            except httpx.HTTPError:
                raise OpenRouterProviderError("OpenRouter network error", error_code="openrouter_network_error") from None
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        if not response.is_success:
            raise OpenRouterProviderError(
                "OpenRouter rejected the request", status_code=response.status_code, error_code=_status_error_code(response.status_code),
            )
        try:
            raw: object = response.json()
        except ValueError:
            raise _malformed_response() from None
        data = _object(raw)
        if "error" in data:
            raise OpenRouterProviderError("OpenRouter returned an error", error_code="openrouter_error")
        if data.get("model") != model:
            raise OpenRouterProviderError("OpenRouter returned a different model", error_code="openrouter_wrong_model")
        return LLMCompletion(
            text=_reply_text(data), model=model, usage=_usage(data.get("usage"), max_tokens=max_tokens), latency_ms=latency_ms,
        )


def _malformed_response() -> OpenRouterProviderError:
    return OpenRouterProviderError("OpenRouter response is malformed", error_code="openrouter_malformed_response")


def _object(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise _malformed_response()
    return cast(dict[str, object], value)


def _reply_text(data: dict[str, object]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list):
        raise _malformed_response()
    choices = cast(list[object], choices)
    if len(choices) != 1:
        raise _malformed_response()
    choice = _object(choices[0])
    if choice.get("finish_reason") != "stop":
        raise OpenRouterProviderError("OpenRouter completion is incomplete", error_code="openrouter_incomplete_response")
    message = _object(choice.get("message"))
    if message.get("refusal") or message.get("tool_calls") or "error" in choice or "error" in message:
        raise OpenRouterProviderError("OpenRouter completion was refused", error_code="openrouter_refused_response")
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise _malformed_response()
    try:
        reply: object = json.loads(content)
    except ValueError:
        raise _malformed_response() from None
    reply = _object(reply)
    if set(reply) != {"answer", "confidence_score", "safety_flags"}:
        raise _malformed_response()
    answer, confidence, flags = reply["answer"], reply["confidence_score"], reply["safety_flags"]
    if not isinstance(answer, str) or not answer.strip():
        raise _malformed_response()
    if type(confidence) not in {int, float} or not 0 <= cast(float, confidence) <= 1:
        raise _malformed_response()
    if not isinstance(flags, list) or any(not isinstance(flag, str) for flag in cast(list[object], flags)):
        raise _malformed_response()
    return content.strip()


def _usage(value: object, *, max_tokens: int) -> LLMUsage:
    usage = _object(value)
    counts: list[int] = []
    for field in ("prompt_tokens", "completion_tokens", "total_tokens"):
        count = usage.get(field)
        if type(count) is not int or count < 0:
            raise _malformed_response()
        counts.append(count)
    prompt_tokens, completion_tokens, total_tokens = counts
    if completion_tokens > max_tokens or total_tokens != prompt_tokens + completion_tokens:
        raise _malformed_response()
    cost = usage.get("cost")
    if isinstance(cost, bool) or not isinstance(cost, int | float | str):
        raise _malformed_response()
    try:
        parsed_cost = Decimal(str(cost))
    except InvalidOperation:
        raise _malformed_response() from None
    if not parsed_cost.is_finite() or parsed_cost < 0:
        raise _malformed_response()
    return LLMUsage(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=total_tokens, cost=parsed_cost)


def _status_error_code(status: int) -> str:
    if status in {401, 403}:
        return "openrouter_auth_error"
    if status == 429:
        return "openrouter_rate_limited"
    if status >= 500:
        return "openrouter_unavailable"
    return "openrouter_error"
