from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput


def test_edited_manual_reply_is_blocked_when_it_exposes_contact_data() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Напишите нам на support@example.com, решим вопрос лично.",
            confidence_score=1.0,
            message_type="review",
            rating=2,
            has_product_context=True,
            model_flags=[],
        )
    )

    assert result.decision is SafetyDecision.BLOCK
    assert "personal_data_exposure" in result.flags


def test_safe_manual_reply_can_pass_safety_gate() -> None:
    result = SafetyGate().evaluate(
        SafetyInput(
            draft_text="Спасибо за вопрос. Кабель поддерживает мощность до 100 Вт при совместимом блоке питания.",
            confidence_score=1.0,
            message_type="question",
            rating=None,
            has_product_context=True,
            model_flags=[],
        )
    )

    assert result.decision is SafetyDecision.ALLOW
