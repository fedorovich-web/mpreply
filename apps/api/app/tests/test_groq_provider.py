from __future__ import annotations

import json
from decimal import Decimal
from typing import cast

import httpx
import pytest

from app.providers.groq import GroqProvider


@pytest.mark.asyncio
async def test_complete_uses_non_reasoning_strict_json_schema() -> None:
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        payload: object = json.loads(request.content.decode("utf-8"))
        assert isinstance(payload, dict)
        captured_payload.update(cast(dict[str, object], payload))
        return httpx.Response(
            200,
            request=request,
            json={
                "model": "qwen/qwen3.8-27b",
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": json.dumps(
                                {
                                    "answer": "Спасибо за отзыв!",
                                    "confidence_score": 0.95,
                                    "safety_flags": [],
                                },
                                ensure_ascii=False,
                            ),
                        }
                    }
                ],
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 20,
                    "total_tokens": 120,
                },
            },
        )

    provider = GroqProvider(
        api_key="gsk_test_key",
        transport=httpx.MockTransport(handler),
    )

    completion = await provider.complete(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": "Отзыв"}],
        temperature=0.3,
        max_tokens=600,
    )

    assert completion.model == "qwen/qwen3.8-27b"
    assert completion.text
    assert captured_payload["max_completion_tokens"] == 600
    assert captured_payload["reasoning_effort"] == "none"
    response_format_value = captured_payload["response_format"]
    assert isinstance(response_format_value, dict)
    response_format = cast(dict[str, object], response_format_value)
    assert response_format["type"] == "json_schema"
    json_schema_value = response_format["json_schema"]
    assert isinstance(json_schema_value, dict)
    json_schema = cast(dict[str, object], json_schema_value)
    assert json_schema["strict"] is True
    schema_value = json_schema["schema"]
    assert isinstance(schema_value, dict)
    schema = cast(dict[str, object], schema_value)
    assert schema["additionalProperties"] is False
    required_value = schema["required"]
    assert isinstance(required_value, list)
    required = cast(list[object], required_value)
    assert {str(item) for item in required} == {"answer", "confidence_score", "safety_flags"}


def test_extract_usage_from_groq_payload() -> None:
    usage = GroqProvider.extract_usage(
        {
            "prompt_tokens": 10,
            "completion_tokens": 4,
            "total_tokens": 14,
        }
    )

    assert usage.prompt_tokens == 10
    assert usage.completion_tokens == 4
    assert usage.total_tokens == 14
    assert usage.cost is None


def test_extract_usage_accepts_optional_cost_if_present() -> None:
    usage = GroqProvider.extract_usage(
        {
            "prompt_tokens": 10,
            "completion_tokens": 4,
            "total_tokens": 14,
            "cost": 0.00014,
        }
    )

    assert usage.cost == Decimal("0.00014")


def test_extract_text_from_groq_payload() -> None:
    text = GroqProvider.extract_text(
        {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Здравствуйте! Спасибо за отзыв.",
                    }
                }
            ]
        }
    )

    assert text == "Здравствуйте! Спасибо за отзыв."
