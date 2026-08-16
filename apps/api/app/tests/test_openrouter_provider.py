from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest

from app.providers.openrouter import OpenRouterProvider, OpenRouterProviderError


class _RequestRecorder:
    def __init__(self, responses: list[httpx.Response]) -> None:
        self.responses = responses
        self.requests: list[httpx.Request] = []

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.responses.pop(0)


def _text_model() -> dict[str, object]:
    return {
        "id": "openai/text-model",
        "name": "Text Model",
        "architecture": {
            "input_modalities": ["text", "image"],
            "output_modalities": ["text"],
            "modality": "text->text",
            "tokenizer": "GPT",
            "instruct_type": "chatml",
        },
        "context_length": 128000,
        "created": 1_690_000_000,
        "pricing": {
            "prompt": "0.0000025",
            "completion": "0.00001",
            "image": "0",
            "request": "0",
        },
        "top_provider": {
            "is_moderated": True,
            "context_length": 128000,
            "max_completion_tokens": 4096,
        },
        "description": "Provider-controlled description that must not be retained.",
        "expiration_date": "2027-12-31T23:59:59Z",
    }


def test_extract_usage_from_openrouter_payload() -> None:
    usage = OpenRouterProvider.extract_usage(
        {
            "prompt_tokens": 10,
            "completion_tokens": 4,
            "total_tokens": 14,
            "cost": 0.00014,
        }
    )

    assert usage.prompt_tokens == 10
    assert usage.completion_tokens == 4
    assert usage.total_tokens == 14
    assert usage.cost == Decimal("0.00014")


def test_extract_text_from_openrouter_payload() -> None:
    text = OpenRouterProvider.extract_text(
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


async def test_get_current_key_normalizes_inference_key_metadata() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(
                200,
                json={
                    "data": {
                        "byok_usage": 0,
                        "creator_user_id": "user_provider_owned",
                        "include_byok_in_limit": False,
                        "is_free_tier": False,
                        "is_management_key": False,
                        "is_provisioning_key": False,
                        "label": "sk-or-v1-masked",
                        "limit": 100,
                        "limit_remaining": 99,
                        "limit_reset": "monthly",
                        "usage": 1,
                        "expires_at": "2027-12-31T23:59:59Z",
                    }
                },
            )
        ]
    )
    provider = OpenRouterProvider(
        api_key="sk-or-v1-test-key-value",
        transport=httpx.MockTransport(recorder),
    )

    metadata = await provider.get_current_key()

    assert metadata.is_management_key is False
    assert metadata.is_provisioning_key is False
    assert recorder.requests[0].url.path == "/api/v1/key"
    assert recorder.requests[0].headers["authorization"] == "Bearer sk-or-v1-test-key-value"


async def test_list_user_models_returns_only_safe_text_models() -> None:
    image_only = {
        **_text_model(),
        "id": "openai/image-only",
        "name": "Image Only",
        "architecture": {"input_modalities": ["text"], "output_modalities": ["image"]},
    }
    invalid_price = {
        **_text_model(),
        "id": "openai/invalid-price",
        "name": "Invalid Price",
        "pricing": {"prompt": "NaN", "completion": "0.1"},
    }
    recorder = _RequestRecorder(
        [httpx.Response(200, json={"data": [_text_model(), image_only, invalid_price, {"id": "missing-fields"}]})]
    )
    provider = OpenRouterProvider(
        api_key="sk-or-v1-test-key-value",
        transport=httpx.MockTransport(recorder),
    )

    models = await provider.list_user_models()

    assert len(models) == 1
    model = models[0]
    assert model.id == "openai/text-model"
    assert model.name == "Text Model"
    assert model.input_modalities == ("text", "image")
    assert model.output_modalities == ("text",)
    assert model.context_length == 128000
    assert model.prompt_price == Decimal("0.0000025")
    assert model.completion_price == Decimal("0.00001")
    assert model.expiration_date == datetime(2027, 12, 31, 23, 59, 59, tzinfo=UTC)
    assert not hasattr(model, "description")
    assert recorder.requests[0].url.path == "/api/v1/models/user"


@pytest.mark.parametrize("payload", [{}, {"data": {}}, {"data": "invalid"}])
async def test_user_model_catalog_rejects_malformed_provider_data(payload: dict[str, object]) -> None:
    provider = OpenRouterProvider(
        api_key="sk-or-v1-test-key-value",
        transport=httpx.MockTransport(_RequestRecorder([httpx.Response(200, json=payload)])),
    )

    with pytest.raises(OpenRouterProviderError) as exc_info:
        await provider.list_user_models()

    assert exc_info.value.error_code == "openrouter_malformed_response"
    assert str(exc_info.value) == "OpenRouter model catalog is malformed"


async def test_catalog_error_is_safe_and_does_not_echo_provider_body() -> None:
    provider = OpenRouterProvider(
        api_key="sk-or-v1-test-key-value",
        transport=httpx.MockTransport(
            _RequestRecorder(
                [httpx.Response(401, json={"error": {"message": "provider-secret-detail"}})]
            )
        ),
    )

    with pytest.raises(OpenRouterProviderError) as exc_info:
        await provider.get_current_key()

    assert exc_info.value.error_code == "openrouter_auth_error"
    assert str(exc_info.value) == "OpenRouter request failed"
    assert "provider-secret-detail" not in str(exc_info.value)


async def test_completion_uses_the_injected_transport() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(
                200,
                json={
                    "model": "openai/text-model",
                    "choices": [{"message": {"role": "assistant", "content": "Ответ"}}],
                    "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6, "cost": "0.001"},
                },
            )
        ]
    )
    provider = OpenRouterProvider(
        api_key="sk-or-v1-test-key-value",
        transport=httpx.MockTransport(recorder),
    )

    completion = await provider.complete(model="openai/text-model", messages=[{"role": "user", "content": "Тест"}])

    assert completion.text == "Ответ"
    assert len(recorder.requests) == 1
    assert recorder.requests[0].url.path == "/api/v1/chat/completions"
