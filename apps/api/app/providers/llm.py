from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


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


def reply_response_format() -> dict[str, object]:
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
