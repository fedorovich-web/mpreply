from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.enums import ReplyStatus
from app.models.reply import Reply
from app.models.user import User
from app.schemas.reply import (
    AutoReplyEnqueueRequest,
    AutoReplyEnqueueResponse,
    ManualReplyCreateRequest,
    ManualReplyRejectRequest,
    ManualReplySendResponse,
    ManualReplyUpdateRequest,
    ManualReplyWorkflowResponse,
    ReplyListResponse,
    ReplyResponse,
    ReplyRetryResponse,
    ReviewQueueItemResponse,
    ReviewQueueListResponse,
    SafetySummary,
)
from app.services.manual_reply_service import ManualReplyService
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


@router.post("/manual", response_model=ManualReplyWorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_reply_draft(
    payload: ManualReplyCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ManualReplyWorkflowResponse:
    service = ManualReplyService(session)
    reply, safety = await service.create_draft(
        actor=current_user,
        message_id=payload.message_id,
        ai_draft_id=payload.ai_draft_id,
        reply_text=payload.reply_text,
    )
    await session.commit()
    return _workflow_response(reply, safety.decision.value, safety.flags, safety.reasons)


@router.patch("/{reply_id}/draft", response_model=ManualReplyWorkflowResponse)
async def update_manual_reply_draft(
    reply_id: UUID,
    payload: ManualReplyUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ManualReplyWorkflowResponse:
    service = ManualReplyService(session)
    reply, safety = await service.update_draft(
        actor=current_user,
        reply_id=reply_id,
        reply_text=payload.reply_text,
        expected_revision=payload.expected_revision,
    )
    await session.commit()
    return _workflow_response(reply, safety.decision.value, safety.flags, safety.reasons)


@router.post("/{reply_id}/submit-review", response_model=ManualReplyWorkflowResponse)
async def submit_manual_reply_for_review(
    reply_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ManualReplyWorkflowResponse:
    service = ManualReplyService(session)
    reply, safety = await service.submit_for_review(actor=current_user, reply_id=reply_id)
    await session.commit()
    return _workflow_response(reply, safety.decision.value, safety.flags, safety.reasons)


@router.post("/{reply_id}/approve", response_model=ManualReplyWorkflowResponse)
async def approve_manual_reply(
    reply_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ManualReplyWorkflowResponse:
    service = ManualReplyService(session)
    reply, safety = await service.approve(actor=current_user, reply_id=reply_id)
    await session.commit()
    return _workflow_response(reply, safety.decision.value, safety.flags, safety.reasons)


@router.post("/{reply_id}/reject", response_model=ReplyResponse)
async def reject_manual_reply(
    reply_id: UUID,
    payload: ManualReplyRejectRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReplyResponse:
    service = ManualReplyService(session)
    reply = await service.reject(actor=current_user, reply_id=reply_id, reason=payload.reason)
    await session.commit()
    return ReplyResponse.model_validate(reply)


@router.post("/{reply_id}/send", response_model=ManualReplySendResponse, status_code=status.HTTP_202_ACCEPTED)
async def send_approved_manual_reply(
    reply_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ManualReplySendResponse:
    service = ManualReplyService(session)
    result = await service.prepare_send(actor=current_user, reply_id=reply_id)
    await session.commit()

    worker_message_id = result.reply.worker_message_id
    if not result.duplicate:
        worker_message_id = enqueue_auto_reply(result.reply.id)
        result.reply.worker_message_id = worker_message_id
        await session.commit()

    queued = result.reply.status in {
        ReplyStatus.QUEUED.value,
        ReplyStatus.SENDING.value,
        ReplyStatus.RETRY_PENDING.value,
    }
    return ManualReplySendResponse(
        queued=queued,
        duplicate=result.duplicate,
        reply_id=result.reply.id,
        worker_message_id=worker_message_id,
        status=result.reply.status,
    )


@router.get("/review-queue", response_model=ReviewQueueListResponse)
async def list_manual_review_queue(
    organization_id: UUID,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReviewQueueListResponse:
    service = ManualReplyService(session)
    rows, total = await service.list_review_queue(
        actor=current_user,
        organization_id=organization_id,
        page=page,
        page_size=page_size,
    )
    normalized_page = max(page, 1)
    normalized_page_size = min(max(page_size, 1), 100)
    items: list[ReviewQueueItemResponse] = []
    for reply, message, product in rows:
        decision, flags, reasons = service.safety_summary(reply)
        items.append(
            ReviewQueueItemResponse(
                reply=ReplyResponse.model_validate(reply),
                message=service.messages.to_response(message, product),
                safety=SafetySummary(decision=decision, flags=flags, reasons=reasons),
            )
        )
    return ReviewQueueListResponse(
        items=items,
        total=total,
        page=normalized_page,
        page_size=normalized_page_size,
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


def _workflow_response(reply: Reply, decision: str, flags: list[str], reasons: list[str]) -> ManualReplyWorkflowResponse:
    return ManualReplyWorkflowResponse(
        reply=ReplyResponse.model_validate(reply),
        safety=SafetySummary(decision=decision, flags=flags, reasons=reasons),
    )
