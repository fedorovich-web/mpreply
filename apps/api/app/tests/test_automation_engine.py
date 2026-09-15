from uuid import UUID, uuid4

from app.automation.engine import AutomationEvaluationContext, AutomationRuleEngine, AutomationRuleSnapshot


def _context(
    *,
    marketplace_account_id: UUID | None = None,
    rating: int | None = 5,
    has_product_context: bool = True,
) -> AutomationEvaluationContext:
    return AutomationEvaluationContext(
        organization_default_mode="auto",
        marketplace_account_default_mode="inherit",
        marketplace_account_id=marketplace_account_id or uuid4(),
        marketplace="wildberries",
        message_type="review",
        rating=rating,
        customer_text="Отличный товар",
        has_product_context=has_product_context,
    )


def test_engine_uses_auto_first_organization_default() -> None:
    result = AutomationRuleEngine().evaluate(_context(), [])

    assert result.mode == "auto"
    assert result.matched_rule_id is None
    assert result.requires_manual_review is False


def test_engine_prefers_highest_priority_matching_rule() -> None:
    account_id = uuid4()
    low_priority = AutomationRuleSnapshot(
        id=uuid4(),
        name="All reviews",
        priority=100,
        mode="auto",
        applies_to="review",
    )
    high_priority = AutomationRuleSnapshot(
        id=uuid4(),
        name="Negative reviews",
        priority=500,
        mode="semi_auto",
        applies_to="review",
        max_rating=3,
    )

    result = AutomationRuleEngine().evaluate(
        _context(marketplace_account_id=account_id, rating=2),
        [low_priority, high_priority],
    )

    assert result.matched_rule_id == high_priority.id
    assert result.mode == "semi_auto"
    assert result.requires_manual_review is True


def test_engine_requires_manual_review_for_missing_product_context() -> None:
    rule = AutomationRuleSnapshot(
        id=uuid4(),
        name="Balanced auto",
        mode="auto",
        applies_to="all",
        stop_on_missing_product_context=True,
    )

    result = AutomationRuleEngine().evaluate(
        _context(has_product_context=False),
        [rule],
    )

    assert result.mode == "auto"
    assert result.requires_manual_review is True
    assert any("product context" in reason.lower() for reason in result.reasons)


def test_rating_restricted_rule_does_not_match_question_without_rating() -> None:
    rule = AutomationRuleSnapshot(
        id=uuid4(),
        name="Negative reviews",
        priority=500,
        mode="semi_auto",
        applies_to="all",
        max_rating=3,
    )
    context = AutomationEvaluationContext(
        organization_default_mode="auto",
        marketplace_account_default_mode="inherit",
        marketplace_account_id=uuid4(),
        marketplace="wildberries",
        message_type="question",
        rating=None,
        customer_text="Есть ли гарантия?",
        has_product_context=True,
    )

    result = AutomationRuleEngine().evaluate(context, [rule])

    assert result.matched_rule_id is None
    assert result.mode == "auto"
