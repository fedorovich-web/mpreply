from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ResponseMode


class AutomationEvaluationContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_default_mode: str = ResponseMode.AUTO.value
    marketplace_account_default_mode: str | None = None
    marketplace_account_id: UUID
    marketplace: str
    message_type: str
    rating: int | None = Field(default=None, ge=1, le=5)
    product_id: UUID | None = None
    category_id: str | None = None
    customer_text: str
    has_product_context: bool
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)


class AutomationRuleSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str
    priority: int = 100
    is_enabled: bool = True
    mode: str
    applies_to: str
    marketplace_account_id: UUID | None = None
    marketplace: str | None = None
    min_rating: int | None = None
    max_rating: int | None = None
    product_ids: list[str] = Field(default_factory=list)
    category_ids: list[str] = Field(default_factory=list)
    include_keywords: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)
    sensitive_topics: list[str] = Field(default_factory=list)
    daily_limit: int | None = None
    hourly_limit: int | None = None
    require_manual_review_on_flags: bool = True
    stop_on_missing_product_context: bool = True
    stop_on_low_confidence: bool = True
    confidence_threshold: float = Field(default=0.8, ge=0.0, le=1.0)


class AutomationEvaluationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: str
    matched_rule_id: UUID | None = None
    matched_rule_name: str | None = None
    reasons: list[str] = Field(default_factory=list)
    requires_manual_review: bool = False
    requires_limit_check: bool = False


class AutomationRuleEngine:
    def evaluate(
        self,
        context: AutomationEvaluationContext,
        rules: list[AutomationRuleSnapshot],
    ) -> AutomationEvaluationResult:
        base_mode = self._base_mode(context)
        matched_rule = self._first_matching_rule(context, rules)
        mode = matched_rule.mode if matched_rule is not None else base_mode
        reasons = ["Organization default mode applied"]

        if context.marketplace_account_default_mode not in {None, ResponseMode.INHERIT.value}:
            reasons = ["Marketplace account override applied"]
        if matched_rule is not None:
            reasons = [f"Matched automation rule: {matched_rule.name}"]

        requires_manual_review = mode == ResponseMode.SEMI_AUTO.value
        requires_limit_check = False

        if matched_rule is not None:
            if matched_rule.stop_on_missing_product_context and not context.has_product_context:
                requires_manual_review = True
                reasons.append("Manual review required because product context is missing")

            if (
                matched_rule.stop_on_low_confidence
                and context.confidence_score is not None
                and context.confidence_score < matched_rule.confidence_threshold
            ):
                requires_manual_review = True
                reasons.append("Manual review required because AI confidence is below the rule threshold")

            if self._contains_any(context.customer_text, matched_rule.sensitive_topics):
                requires_manual_review = True
                reasons.append("Manual review required because a sensitive topic matched")

            requires_limit_check = matched_rule.daily_limit is not None or matched_rule.hourly_limit is not None
            if requires_limit_check:
                reasons.append("Runtime quota check required before auto-send")

        return AutomationEvaluationResult(
            mode=mode,
            matched_rule_id=matched_rule.id if matched_rule is not None else None,
            matched_rule_name=matched_rule.name if matched_rule is not None else None,
            reasons=reasons,
            requires_manual_review=requires_manual_review,
            requires_limit_check=requires_limit_check,
        )

    @staticmethod
    def _base_mode(context: AutomationEvaluationContext) -> str:
        account_mode = context.marketplace_account_default_mode
        if account_mode and account_mode != ResponseMode.INHERIT.value:
            return account_mode
        return context.organization_default_mode

    def _first_matching_rule(
        self,
        context: AutomationEvaluationContext,
        rules: list[AutomationRuleSnapshot],
    ) -> AutomationRuleSnapshot | None:
        ordered_rules = sorted(rules, key=lambda rule: (rule.priority, str(rule.id)), reverse=True)
        for rule in ordered_rules:
            if self._matches(context, rule):
                return rule
        return None

    def _matches(self, context: AutomationEvaluationContext, rule: AutomationRuleSnapshot) -> bool:
        if not rule.is_enabled:
            return False
        if rule.marketplace_account_id is not None and rule.marketplace_account_id != context.marketplace_account_id:
            return False
        if rule.marketplace is not None and rule.marketplace != context.marketplace:
            return False
        if rule.applies_to not in {"all", context.message_type}:
            return False
        if context.rating is None and (rule.min_rating is not None or rule.max_rating is not None):
            return False
        if context.rating is not None and rule.min_rating is not None and context.rating < rule.min_rating:
            return False
        if context.rating is not None and rule.max_rating is not None and context.rating > rule.max_rating:
            return False
        if rule.product_ids and str(context.product_id) not in rule.product_ids:
            return False
        if rule.category_ids and (context.category_id or "") not in rule.category_ids:
            return False
        if rule.include_keywords and not self._contains_any(context.customer_text, rule.include_keywords):
            return False
        return not (rule.exclude_keywords and self._contains_any(context.customer_text, rule.exclude_keywords))

    @staticmethod
    def _contains_any(text: str, values: list[str]) -> bool:
        normalized = text.casefold()
        return any(value.strip().casefold() in normalized for value in values if value.strip())
