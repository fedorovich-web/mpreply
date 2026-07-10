from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.ai_draft import AIDraft
from app.models.user import User
from app.schemas.ai import AIDraftGenerateRequest, AIDraftListResponse, AIDraftResponse
from app.services.ai_service import AIService, decimal_to_float

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/drafts/generate", response_model=AIDraftResponse)
async def generate_ai_draft(
    payload: AIDraftGenerateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIDraftResponse:
    service = AIService(session)
    draft = await service.generate_draft(
        actor=current_user,
        message_id=payload.message_id,
        tone=payload.tone,
        model=payload.model,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        brand_rules=payload.brand_rules,
        knowledge_base=payload.knowledge_base,
    )
    await session.commit()
    return to_ai_draft_response(draft)


@router.get("/drafts", response_model=AIDraftListResponse)
async def list_ai_drafts(
    organization_id: UUID,
    message_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIDraftListResponse:
    service = AIService(session)
    drafts, total = await service.list_drafts(
        actor=current_user,
        organization_id=organization_id,
        message_id=message_id,
    )
    return AIDraftListResponse(items=[to_ai_draft_response(draft) for draft in drafts], total=total)


@router.get("/drafts/{draft_id}", response_model=AIDraftResponse)
async def get_ai_draft(
    draft_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIDraftResponse:
    service = AIService(session)
    draft = await service.get_draft(actor=current_user, draft_id=draft_id)
    return to_ai_draft_response(draft)


def to_ai_draft_response(draft: AIDraft) -> AIDraftResponse:
    return AIDraftResponse(
        id=draft.id,
        organization_id=draft.organization_id,
        message_id=draft.message_id,
        provider=draft.provider,
        model=draft.model,
        prompt_version=draft.prompt_version,
        draft_text=draft.draft_text,
        tokens_input=draft.tokens_input,
        tokens_output=draft.tokens_output,
        latency_ms=draft.latency_ms,
        cost_estimate=decimal_to_float(draft.cost_estimate),
        confidence_score=draft.confidence_score,
        safety_flags_json=draft.safety_flags_json or [],
        created_by=draft.created_by,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )
