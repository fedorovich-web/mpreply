from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput


def test_safety_gate_allows_clean_high_confidence_reply() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Спасибо за отзыв. Рады, что товар вам подошёл.",
            confidence_score=0.94,
            message_type="review",
            rating=5,
            has_product_context=True,
        )
    )

    assert result.decision is SafetyDecision.ALLOW
    assert result.auto_send_allowed is True
    assert result.flags == []


def test_safety_gate_requires_manual_review_for_risky_promise() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Мы обязательно компенсируем стоимость и точно решим вопрос сегодня.",
            confidence_score=0.91,
            message_type="review",
            rating=2,
            has_product_context=True,
        )
    )

    assert result.decision is SafetyDecision.MANUAL_REVIEW
    assert result.auto_send_allowed is False
    assert "risky_promise" in result.flags
    assert "negative_review" in result.flags


def test_safety_gate_blocks_personal_contact_data() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Напишите нам на support@example.com, и мы продолжим обсуждение.",
            confidence_score=0.99,
            message_type="question",
            has_product_context=True,
        )
    )

    assert result.decision is SafetyDecision.BLOCK
    assert "personal_data_exposure" in result.flags


def test_safety_gate_blocks_external_links_and_urls() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Подробности смотрите на https://external-promo.site/discount или в t.me/my_channel",
            confidence_score=0.95,
            message_type="review",
            has_product_context=True,
        )
    )

    assert result.decision is SafetyDecision.BLOCK
    assert result.auto_send_allowed is False
    assert "prohibited_link" in result.flags


def test_safety_gate_requires_manual_review_for_competitor_redirect() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Этот товар закончился, переходите на ozon для оформления заказа.",
            confidence_score=0.92,
            message_type="question",
            has_product_context=True,
        )
    )

    assert result.decision is SafetyDecision.MANUAL_REVIEW
    assert result.auto_send_allowed is False
    assert "competitor_mention" in result.flags
