from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.automation.engine import AutomationEvaluationContext, AutomationEvaluationResult, AutomationRuleEngine, AutomationRuleSnapshot
from app.core.errors import bad_request, not_found
from app.models.automation_rule import AutomationRule
from app.models.marketplace_account import MarketplaceAccount
from app.models.user import User
from app.schemas.automation_rule import AutomationRuleCreateRequest, AutomationRuleUpdateRequest
from app.services.audit_service import AuditService
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService

_WRITE_ROLES = {"owner", "admin"}
_READ_ROLES = {"owner", "admin", "manager", "viewer"}


class AutomationRuleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.engine = AutomationRuleEngine()
        self.message_service = MessageService(session)
        self.organization_service = OrganizationService(session)

    async def create_rule(self, *, actor: User, payload: AutomationRuleCreateRequest) -> AutomationRule:
        await self.organization_service.require_membership_role(
            organization_id=payload.organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )
        if payload.marketplace_account_id is not None:
            await self._require_account_in_organization(payload.marketplace_account_id, payload.organization_id)

        rule = AutomationRule(
            organization_id=payload.organization_id,
            marketplace_account_id=payload.marketplace_account_id,
            name=payload.name.strip(),
            priority=payload.priority,
            is_enabled=payload.is_enabled,
            mode=payload.mode,
            applies_to=payload.applies_to,
            marketplace=payload.marketplace,
            min_rating=payload.min_rating,
            max_rating=payload.max_rating,
            product_ids_json=payload.product_ids,
            category_ids_json=payload.category_ids,
            include_keywords_json=payload.include_keywords,
            exclude_keywords_json=payload.exclude_keywords,
            sensitive_topics_json=payload.sensitive_topics,
            daily_limit=payload.daily_limit,
            hourly_limit=payload.hourly_limit,
            require_manual_review_on_flags=payload.require_manual_review_on_flags,
            stop_on_missing_product_context=payload.stop_on_missing_product_context,
            stop_on_low_confidence=payload.stop_on_low_confidence,
            confidence_threshold=payload.confidence_threshold,
            created_by=actor.id,
            updated_by=actor.id,
        )
        self.session.add(rule)
        await self.session.flush()
        await self.audit.write(
            action="automation_rule.created",
            entity_type="automation_rule",
            organization_id=rule.organization_id,
            actor_user_id=actor.id,
            entity_id=str(rule.id),
            metadata={"name": rule.name, "mode": rule.mode, "priority": rule.priority},
        )
        return rule

    async def list_rules(
        self,
        *,
        actor: User,
        organization_id: UUID,
        is_enabled: bool | None = None,
    ) -> tuple[list[AutomationRule], int]:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        stmt = select(AutomationRule).where(AutomationRule.organization_id == organization_id)
        count_stmt = select(func.count(AutomationRule.id)).where(AutomationRule.organization_id == organization_id)
        if is_enabled is not None:
            stmt = stmt.where(AutomationRule.is_enabled == is_enabled)
            count_stmt = count_stmt.where(AutomationRule.is_enabled == is_enabled)

        count_result = await self.session.execute(count_stmt)
        total = int(count_result.scalar_one())
        result = await self.session.execute(stmt.order_by(AutomationRule.priority.desc(), AutomationRule.created_at.asc()))
        return list(result.scalars().all()), total

    async def get_rule(self, *, actor: User, rule_id: UUID) -> AutomationRule:
        result = await self.session.execute(select(AutomationRule).where(AutomationRule.id == rule_id))
        rule = result.scalar_one_or_none()
        if rule is None:
            raise not_found("Automation rule not found")
        await self.organization_service.require_membership_role(
            organization_id=rule.organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        return rule

    async def update_rule(
        self,
        *,
        actor: User,
        rule_id: UUID,
        payload: AutomationRuleUpdateRequest,
    ) -> AutomationRule:
        rule = await self.get_rule(actor=actor, rule_id=rule_id)
        await self.organization_service.require_membership_role(
            organization_id=rule.organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )

        changes = payload.model_dump(exclude_unset=True)
        marketplace_account_id = changes.get("marketplace_account_id")
        if marketplace_account_id is not None:
            await self._require_account_in_organization(marketplace_account_id, rule.organization_id)

        json_field_map = {
            "product_ids": "product_ids_json",
            "category_ids": "category_ids_json",
            "include_keywords": "include_keywords_json",
            "exclude_keywords": "exclude_keywords_json",
            "sensitive_topics": "sensitive_topics_json",
        }
        for field_name, value in changes.items():
            model_field_name = json_field_map.get(field_name, field_name)
            setattr(rule, model_field_name, value)

        if rule.min_rating is not None and rule.max_rating is not None and rule.min_rating > rule.max_rating:
            raise bad_request("min_rating cannot be greater than max_rating")

        rule.updated_by = actor.id
        await self.session.flush()
        await self.audit.write(
            action="automation_rule.updated",
            entity_type="automation_rule",
            organization_id=rule.organization_id,
            actor_user_id=actor.id,
            entity_id=str(rule.id),
            metadata={"changed_fields": sorted(changes)},
        )
        return rule

    async def disable_rule(self, *, actor: User, rule_id: UUID) -> AutomationRule:
        rule = await self.get_rule(actor=actor, rule_id=rule_id)
        await self.organization_service.require_membership_role(
            organization_id=rule.organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )
        rule.is_enabled = False
        rule.updated_by = actor.id
        await self.session.flush()
        await self.audit.write(
            action="automation_rule.disabled",
            entity_type="automation_rule",
            organization_id=rule.organization_id,
            actor_user_id=actor.id,
            entity_id=str(rule.id),
            metadata={"name": rule.name},
        )
        return rule

    async def evaluate_message(
        self,
        *,
        actor: User,
        message_id: UUID,
        confidence_score: float | None = None,
    ) -> AutomationEvaluationResult:
        message, product = await self.message_service.get_message(actor=actor, message_id=message_id)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        organization = await self.organization_service.get_for_user(
            organization_id=message.organization_id,
            user_id=actor.id,
        )
        account = await self._require_account_in_organization(message.marketplace_account_id, message.organization_id)
        rules, _ = await self.list_rules(actor=actor, organization_id=message.organization_id, is_enabled=True)

        result = self.engine.evaluate(
            AutomationEvaluationContext(
                organization_default_mode=organization.default_response_mode,
                marketplace_account_default_mode=account.default_response_mode,
                marketplace_account_id=account.id,
                marketplace=message.marketplace,
                message_type=message.type,
                rating=message.rating,
                product_id=message.product_id,
                category_id=product.category if product is not None else None,
                customer_text=message.customer_text,
                has_product_context=product is not None,
                confidence_score=confidence_score,
            ),
            [self._to_snapshot(rule) for rule in rules],
        )
        await self.audit.write(
            action="automation_rule.evaluated",
            entity_type="customer_message",
            organization_id=message.organization_id,
            actor_user_id=actor.id,
            entity_id=str(message.id),
            metadata={
                "mode": result.mode,
                "matched_rule_id": str(result.matched_rule_id) if result.matched_rule_id is not None else None,
                "requires_manual_review": result.requires_manual_review,
                "requires_limit_check": result.requires_limit_check,
            },
        )
        return result

    async def _require_account_in_organization(self, account_id: UUID, organization_id: UUID) -> MarketplaceAccount:
        result = await self.session.execute(
            select(MarketplaceAccount).where(
                MarketplaceAccount.id == account_id,
                MarketplaceAccount.organization_id == organization_id,
            )
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found in this organization")
        return account

    @staticmethod
    def _to_snapshot(rule: AutomationRule) -> AutomationRuleSnapshot:
        return AutomationRuleSnapshot(
            id=rule.id,
            name=rule.name,
            priority=rule.priority,
            is_enabled=rule.is_enabled,
            mode=rule.mode,
            applies_to=rule.applies_to,
            marketplace_account_id=rule.marketplace_account_id,
            marketplace=rule.marketplace,
            min_rating=rule.min_rating,
            max_rating=rule.max_rating,
            product_ids=[str(value) for value in (rule.product_ids_json or [])],
            category_ids=[str(value) for value in (rule.category_ids_json or [])],
            include_keywords=[str(value) for value in (rule.include_keywords_json or [])],
            exclude_keywords=[str(value) for value in (rule.exclude_keywords_json or [])],
            sensitive_topics=[str(value) for value in (rule.sensitive_topics_json or [])],
            daily_limit=rule.daily_limit,
            hourly_limit=rule.hourly_limit,
            require_manual_review_on_flags=rule.require_manual_review_on_flags,
            stop_on_missing_product_context=rule.stop_on_missing_product_context,
            stop_on_low_confidence=rule.stop_on_low_confidence,
            confidence_threshold=rule.confidence_threshold,
        )
