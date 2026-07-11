from decimal import Decimal

from app.providers.openrouter import OpenRouterProvider


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
