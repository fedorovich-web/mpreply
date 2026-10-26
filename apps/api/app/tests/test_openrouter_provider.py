from __future__ import annotations

import json
from decimal import Decimal
from typing import cast

import httpx
import pytest

from app.providers.llm import LLMCompletion
from app.providers.openrouter import OpenRouterProvider, OpenRouterProviderError

MODEL = "openai/gpt-6-luna"
MESSAGES = [{"role": "user", "content": "Synthetic review"}]
REPLY: dict[str, object] = {"answer": "Thank you for your review.", "confidence_score": 0.95, "safety_flags": []}


def response_data(model: str = MODEL) -> dict[str, object]:
    return {
        "id": "gen-synthetic",
        "model": model,
        "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": json.dumps(REPLY)}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120, "cost": 0.00014},
    }


@pytest.mark.parametrize(("model", "temperature", "max_tokens"), [
    ("openai/gpt-6-luna", None, 600),
    ("anthropic/claude-sonnet-5.5", None, 2048),
    ("google/gemini-3.8-flash", 0.2, 600),
    ("deepseek/deepseek-v4.1-flash", 0.2, 600),
])
async def test_complete_sends_exact_bounded_strict_request(model: str, temperature: float | None, max_tokens: int) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert str(request.url) == "https://openrouter.ai/api/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer synthetic-key"
        payload = json.loads(request.content)
        expected: dict[str, object] = {
            "model": model, "messages": MESSAGES, "max_tokens": max_tokens,
            "reasoning": {"effort": "low", "exclude": True},
            "provider": {"require_parameters": True, "allow_fallbacks": False},
            "response_format": {
                "type": "json_schema", "json_schema": {
                    "name": "marketplace_reply", "strict": True, "schema": {
                        "type": "object", "properties": {
                            "answer": {"type": "string", "minLength": 1},
                            "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
                            "safety_flags": {"type": "array", "items": {"type": "string"}},
                        }, "required": ["answer", "confidence_score", "safety_flags"], "additionalProperties": False,
                    },
                },
            },
        }
        if temperature is not None:
            expected["temperature"] = temperature
        assert payload == expected
        return httpx.Response(200, json=response_data(model))

    result = await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler)).complete(
        model=model, messages=MESSAGES, temperature=0.2, max_tokens=max_tokens,
    )
    assert isinstance(result, LLMCompletion)
    assert json.loads(result.text) == REPLY
    assert result.model == model
    assert result.usage.prompt_tokens == 100
    assert result.usage.completion_tokens == 20
    assert result.usage.total_tokens == 120
    assert result.usage.cost == Decimal("0.00014")
    assert result.latency_ms >= 0
    assert len(requests) == 1


@pytest.mark.parametrize(("status", "code"), [
    (302, "openrouter_error"), (400, "openrouter_error"), (401, "openrouter_auth_error"),
    (403, "openrouter_auth_error"), (429, "openrouter_rate_limited"), (503, "openrouter_unavailable"),
])
async def test_rejections_are_safe_single_attempt_without_redirects(status: int, code: str) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(status, headers={"Location": "https://attacker.example/completions"},
                              json={"error": {"message": "private upstream text synthetic-key"}})

    with pytest.raises(OpenRouterProviderError) as caught:
        await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler)).complete(model=MODEL, messages=MESSAGES)
    assert len(requests) == 1
    assert caught.value.status_code == status
    assert caught.value.error_code == code
    assert "synthetic-key" not in str(caught.value)
    assert "private upstream" not in str(caught.value)


@pytest.mark.parametrize(("exception", "code"), [(httpx.ReadTimeout, "openrouter_timeout"), (httpx.ConnectError, "openrouter_network_error")])
async def test_transport_failure_never_retries(exception: type[httpx.RequestError], code: str) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        raise exception("private network text synthetic-key", request=request)

    with pytest.raises(OpenRouterProviderError) as caught:
        await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler)).complete(model=MODEL, messages=MESSAGES)
    assert len(requests) == 1
    assert caught.value.error_code == code
    assert "private" not in str(caught.value)


INVALID_RESPONSE_PATCHES: list[dict[str, object]] = [
    {"error": {"message": "private upstream text"}}, {"model": "openai/other-model"},
    {"choices": []}, {"choices": [{}]},
    {"choices": [{"finish_reason": "length", "message": {"content": json.dumps(REPLY)}}]},
    {"choices": [{"finish_reason": "content_filter", "message": {"content": json.dumps(REPLY)}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(REPLY), "refusal": "private"}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(REPLY), "tool_calls": [{"id": "tool"}]}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": " "}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": "not JSON"}}]},
    {"usage": None}, {"usage": {}},
]


@pytest.mark.parametrize("patch", INVALID_RESPONSE_PATCHES)
async def test_incomplete_malformed_wrong_model_or_error_response_fails_closed(patch: dict[str, object]) -> None:
    data = {**response_data(), **patch}
    with pytest.raises(OpenRouterProviderError) as caught:
        await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(lambda _: httpx.Response(200, json=data))).complete(
            model=MODEL, messages=MESSAGES,
        )
    assert "private" not in str(caught.value)
    assert caught.value.error_code.startswith("openrouter_")


INVALID_REPLIES: list[object] = [
    [], {"answer": "x"}, {**REPLY, "extra": True}, {**REPLY, "answer": " "},
    {**REPLY, "confidence_score": True}, {**REPLY, "confidence_score": 2}, {**REPLY, "confidence_score": float("nan")},
    {**REPLY, "safety_flags": [1]},
]


@pytest.mark.parametrize("reply", INVALID_REPLIES)
async def test_rejects_invalid_reply_schema(reply: object) -> None:
    data = response_data()
    data["choices"] = [{"finish_reason": "stop", "message": {"content": json.dumps(reply)}}]
    with pytest.raises(OpenRouterProviderError, match="malformed"):
        await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(lambda _: httpx.Response(200, json=data))).complete(
            model=MODEL, messages=MESSAGES,
        )


@pytest.mark.parametrize(("field", "value"), [
    ("prompt_tokens", None), ("prompt_tokens", True), ("prompt_tokens", -1),
    ("completion_tokens", "20"), ("completion_tokens", 601), ("total_tokens", 1.5), ("total_tokens", 119),
    ("cost", None), ("cost", True), ("cost", -1), ("cost", "NaN"), ("cost", "Infinity"), ("cost", "invalid"),
])
async def test_usage_and_cost_are_required_finite_nonnegative(field: str, value: object) -> None:
    data = response_data()
    cast(dict[str, object], data["usage"])[field] = value
    with pytest.raises(OpenRouterProviderError):
        await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(lambda _: httpx.Response(200, json=data))).complete(
            model=MODEL, messages=MESSAGES,
        )


@pytest.mark.parametrize(("cost", "expected"), [(0, Decimal("0")), ("0.00012345", Decimal("0.00012345"))])
async def test_preserves_exact_zero_or_decimal_cost(cost: object, expected: Decimal) -> None:
    data = response_data()
    cast(dict[str, object], data["usage"])["cost"] = cost
    result = await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(lambda _: httpx.Response(200, json=data))).complete(
        model=MODEL, messages=MESSAGES,
    )
    assert result.usage.cost == expected


@pytest.mark.parametrize("body", [b"not JSON", b"[]", b"null"])
async def test_rejects_non_object_response(body: bytes) -> None:
    with pytest.raises(OpenRouterProviderError):
        await OpenRouterProvider(api_key="synthetic-key", transport=httpx.MockTransport(lambda _: httpx.Response(200, content=body))).complete(
            model=MODEL, messages=MESSAGES,
        )


@pytest.mark.parametrize(("key", "model", "max_tokens"), [
    ("", MODEL, 600), ("replace-openrouter-key", MODEL, 600), (" ", MODEL, 600),
    ("synthetic-key", "openrouter/auto", 600), ("synthetic-key", MODEL, 0), ("synthetic-key", MODEL, -1),
    ("synthetic-key", "anthropic/claude-sonnet-5.5", 600), ("synthetic-key", "anthropic/claude-sonnet-5.5", 1024),
])
async def test_invalid_configuration_fails_before_request(key: str, model: str, max_tokens: int) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        pytest.fail("invalid configuration sent an upstream request")

    with pytest.raises(OpenRouterProviderError):
        await OpenRouterProvider(api_key=key, transport=httpx.MockTransport(handler)).complete(model=model, messages=MESSAGES, max_tokens=max_tokens)
