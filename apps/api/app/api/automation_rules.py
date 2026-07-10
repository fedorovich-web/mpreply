from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.automation_rule import AutomationRule
from app.models.user import User
from app.schemas.automation_rule import (
    AutomationRuleActionResponse,
    AutomationRuleCreateRequest,
    AutomationRuleEvaluateRequest,
    AutomationRuleEvaluateResponse,
    AutomationRuleListResponse,
    AutomationRuleResponse,
    AutomationRuleUpdateRequest,
)
from app.services.automation_rule_service import AutomationRuleService

router = APIRouter(prefix="/api/automation-rules", tags=["automation-rules"])


@router.post("", response_model=AutomationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_automation_rule(
    payload: AutomationRuleCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutomationRuleResponse:
    service = AutomationRuleService(session)
    rule = await service.create_rule(actor=current_user, payload=payload)
    await session.commit()
    return to_automation_rule_response(rule)


@router.get("", response_model=AutomationRuleListResponse)
async def list_automation_rules(
    organization_id: UUID,
    is_enabled: bool | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutomationRuleListResponse:
    service = AutomationRuleService(session)
    rules, total = await service.list_rules(actor=current_user, organization_id=organization_id, is_enabled=is_enabled)
    return AutomationRuleListResponse(items=[to_automation_rule_response(rule) for rule in rules], total=total)


@router.get("/{rule_id}", response_model=AutomationRuleResponse)
async def get_automation_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutomationRuleResponse:
    service = AutomationRuleService(session)
    rule = await service.get_rule(actor=current_user, rule_id=rule_id)
    return to_automation_rule_response(rule)


@router.patch("/{rule_id}", response_model=AutomationRuleResponse)
async def update_automation_rule(
    rule_id: UUID,
    payload: AutomationRuleUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutomationRuleResponse:
    service = AutomationRuleService(session)
    rule = await service.update_rule(actor=current_user, rule_id=rule_id, payload=payload)
    await session.commit()
    return to_automation_rule_response(rule)


@router.delete("/{rule_id}", response_model=AutomationRuleActionResponse)
async def disable_automation_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutomationRuleActionResponse:
    service = AutomationRuleService(session)
    rule = await service.disable_rule(actor=current_user, rule_id=rule_id)
    await session.commit()
    return AutomationRuleActionResponse(id=rule.id, is_enabled=rule.is_enabled)


@router.post("/evaluate", response_model=AutomationRuleEvaluateResponse)
async def evaluate_automation_rules(
    payload: AutomationRuleEvaluateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutomationRuleEvaluateResponse:
    service = AutomationRuleService(session)
    result = await service.evaluate_message(
        actor=current_user,
        message_id=payload.message_id,
        confidence_score=payload.confidence_score,
    )
    await session.commit()
    return AutomationRuleEvaluateResponse(**result.model_dump())


def to_automation_rule_response(rule: AutomationRule) -> AutomationRuleResponse:
    return AutomationRuleResponse(
        id=rule.id,
        organization_id=rule.organization_id,
        marketplace_account_id=rule.marketplace_account_id,
        name=rule.name,
        priority=rule.priority,
        is_enabled=rule.is_enabled,
        mode=rule.mode,
        applies_to=rule.applies_to,
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
        created_by=rule.created_by,
        updated_by=rule.updated_by,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )
