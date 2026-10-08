from app.ai.prompt_strategy import PROMPT_VERSION, build_marketplace_reply_prompt


def test_build_marketplace_reply_prompt_hash_is_stable() -> None:
    first = build_marketplace_reply_prompt(
        marketplace="wildberries",
        message_type="review",
        customer_text="Товар пришёл быстро, всё хорошо",
        rating=5,
        product={"name": "Кружка", "brand": "Respio Test"},
        tone="friendly",
    )
    second = build_marketplace_reply_prompt(
        marketplace="wildberries",
        message_type="review",
        customer_text="Товар пришёл быстро, всё хорошо",
        rating=5,
        product={"name": "Кружка", "brand": "Respio Test"},
        tone="friendly",
    )

    assert first.version == PROMPT_VERSION
    assert first.input_hash == second.input_hash
    assert first.messages[0]["role"] == "system"
    assert "MPReply" in first.messages[0]["content"]
    assert "Respio" not in first.messages[0]["content"]
    assert "строго JSON" in first.messages[0]["content"]
    assert first.messages[1]["role"] == "user"
    assert "Кружка" in first.messages[1]["content"]


def test_build_marketplace_reply_prompt_changes_hash_when_context_changes() -> None:
    first = build_marketplace_reply_prompt(
        marketplace="wildberries",
        message_type="question",
        customer_text="Есть ли гарантия?",
        rating=None,
        product={"name": "Чайник"},
    )
    second = build_marketplace_reply_prompt(
        marketplace="wildberries",
        message_type="question",
        customer_text="Подходит ли для индукции?",
        rating=None,
        product={"name": "Чайник"},
    )

    assert first.input_hash != second.input_hash
