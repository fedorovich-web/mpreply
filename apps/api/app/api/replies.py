from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.enums import ReplyStatus
from app.models.user import User
from app.schemas.reply import (
    AutoReplyEnqueueRequest,
    AutoReplyEnqueueResponse,
    ReplyListResponse,
    ReplyResponse,
    ReplyRetryResponse,
)
from app.services.reply_execution_service import ReplyExecutionService
from app.workers.auto_reply import enqueue_auto_reply

router = APIRouter(prefix="/api/replies", tags=["replies"])


@router.post("/auto/enqueue", response_model=AutoReplyEnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def enqueue_automatic_reply(
    payload: AutoReplyEnqueueRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AutoReplyEnqueueResponse:
    service = ReplyExecutionService(session)
    result = await service.queue_auto_reply(
        actor=current_user,
        message_id=payload.message_id,
        ai_draft_id=payload.ai_draft_id,
    )
    await session.commit()

    worker_message_id: str | None = None
    if result.reply is not None and result.queued and not result.duplicate:
        worker_message_id = enqueue_auto_reply(result.reply.id)
        result.reply.worker_message_id = worker_message_id
        await session.commit()
    elif result.reply is not None:
        worker_message_id = result.reply.worker_message_id

    response_status = result.reply.status if result.reply is not None else result.reason or "not_queued"
    return AutoReplyEnqueueResponse(
        queued=result.queued,
        duplicate=result.duplicate,
        reply_id=result.reply.id if result.reply is not None else None,
        worker_message_id=worker_message_id,
        status=response_status,
        reason=result.reason,
        matched_rule_id=result.matched_rule_id,
        quota_reason=result.quota_reason,
    )


@router.get("", response_model=ReplyListResponse)
async def list_replies(
    organization_id: UUID,
    reply_status: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReplyListResponse:
    service = ReplyExecutionService(session)
    items, total = await service.list_replies(
        actor=current_user,
        organization_id=organization_id,
        status=reply_status,
    )
    return ReplyListResponse(items=[ReplyResponse.model_validate(item) for item in items], total=total)


@router.get("/{reply_id}", response_model=ReplyResponse)
async def get_reply(
    reply_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReplyResponse:
    service = ReplyExecutionService(session)
    reply = await service.get_reply(actor=current_user, reply_id=reply_id)
    return ReplyResponse.model_validate(reply)


@router.post("/{reply_id}/retry", response_model=ReplyRetryResponse, status_code=status.HTTP_202_ACCEPTED)
async def retry_reply(
    reply_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReplyRetryResponse:
    service = ReplyExecutionService(session)
    reply = await service.prepare_retry(actor=current_user, reply_id=reply_id)
    await session.commit()
    worker_message_id = enqueue_auto_reply(reply.id)
    reply.worker_message_id = worker_message_id
    reply.status = ReplyStatus.QUEUED.value
    await session.commit()
    return ReplyRetryResponse(
        queued=True,
        reply_id=reply.id,
        worker_message_id=worker_message_id,
        status=reply.status,
    )
