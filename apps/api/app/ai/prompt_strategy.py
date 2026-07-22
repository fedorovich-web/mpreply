from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Literal

PROMPT_VERSION = "marketplace-reply-v1"
ResponseTone = Literal["neutral", "friendly", "formal", "apologetic"]


@dataclass(frozen=True)
class PromptBundle:
    version: str
    messages: list[dict[str, str]]
    input_hash: str
    input_snapshot: dict[str, Any]


_SYSTEM_PROMPT = """Ты AI-ассистент MPReply для ответов продавца на отзывы и вопросы маркетплейсов.

Правила:
- Пиши только на русском языке, естественно и без канцелярита.
- Не спорь с покупателем, не обвиняй покупателя и не раскрывай внутренние процессы продавца.
- Не обещай возврат, замену, компенсацию, скидку, сроки доставки или решение проблемы, если этих данных нет во входном контексте.
- Не выдумывай характеристики товара, состав, гарантию, наличие, доставку, комплектацию или действия поддержки.
- Для негативных отзывов сначала признай проблему и извинись, затем предложи безопасный следующий шаг.
- Для вопросов отвечай кратко и по существу, используя только контекст товара и базу знаний.
- Если данных не хватает, прямо напиши, что информацию нужно уточнить, и не придумывай ответ.
- Верни строго JSON без markdown: {"answer": string, "confidence_score": number, "safety_flags": string[]}.
"""

_TONE_INSTRUCTIONS: dict[ResponseTone, str] = {
    "neutral": "Тон: нейтральный, спокойный, профессиональный.",
    "friendly": "Тон: доброжелательный, но без фамильярности и чрезмерных эмоций.",
    "formal": "Тон: более официальный, аккуратный, без сложной бюрократической лексики.",
    "apologetic": "Тон: эмпатичный, с коротким извинением, особенно для негативного опыта.",
}


def build_marketplace_reply_prompt(
    *,
    marketplace: str,
    message_type: str,
    customer_text: str,
    rating: int | None,
    product: dict[str, Any] | None,
    tone: ResponseTone = "neutral",
    brand_rules: str | None = None,
    knowledge_base: str | None = None,
) -> PromptBundle:
    input_snapshot = {
        "marketplace": marketplace,
        "message_type": message_type,
        "rating": rating,
        "customer_text": customer_text.strip(),
        "product": product or {},
        "tone": tone,
        "brand_rules": brand_rules or "",
        "knowledge_base": knowledge_base or "",
    }
    payload = json.dumps(input_snapshot, ensure_ascii=False, sort_keys=True)
    input_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    user_prompt = {
        "task": "Сгенерируй безопасный ответ продавца для маркетплейса.",
        "tone_instruction": _TONE_INSTRUCTIONS[tone],
        "context": input_snapshot,
        "output_contract": {
            "answer": "Готовый текст ответа продавца. Без markdown. Без JSON внутри строки.",
            "confidence_score": "Число от 0 до 1. Ниже 0.75, если не хватает контекста.",
            "safety_flags": (
                "Массив строк. Используй missing_product_context, risky_promise, "
                "medical_or_legal_claim, unclear_customer_issue, needs_manual_review."
            ),
        },
    }

    return PromptBundle(
        version=PROMPT_VERSION,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
        ],
        input_hash=input_hash,
        input_snapshot=input_snapshot,
    )
