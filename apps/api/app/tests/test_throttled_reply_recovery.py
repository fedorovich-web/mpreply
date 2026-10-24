import asyncio
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.ai_draft import AIDraft
from app.models.audit_log import AuditLog
from app.models.organization import OrganizationUser
from app.models.reply import Reply
from app.models.user import User
from app.services.manual_reply_service import ManualReplyService
from app.services.reply_execution_service import ReplyExecutionService
from app.tests.test_automatic_drafts import automatic_db, seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits
from app.workers.auto_reply import claim_due_replies

__all__ = ["automatic_db", "postgres_credits", "synthetic_encryption_key"]


@pytest.mark.parametrize("kind,expected", [
    ("review", "queued"), ("question", "manual_review_required"),
    ("unsafe", "manual_review_required"), ("already_review", "manual_review_required"),
    ("ambiguous", "failed"), ("network", "failed"), ("archived", "failed"),
])
async def test_legacy_throttle_recovery_rechecks_safety_preserves_history_and_is_idempotent(
    automatic_db: async_sessionmaker[AsyncSession], kind: str, expected: str,
) -> None:
    async with automatic_db() as session:
        message = await seed(session)
        actor = await session.scalar(select(User).join(OrganizationUser, OrganizationUser.user_id == User.id)
                                     .where(OrganizationUser.organization_id == message.organization_id))
        assert actor is not None
        message.type = "question" if kind == "question" else "review"
        message.status = "archived" if kind == "archived" else "needs_manual_check" if kind == "already_review" else "failed"
        draft = AIDraft(organization_id=message.organization_id, message_id=message.id,
                        model="synthetic", prompt_version="marketplace-reply-v1", prompt_input_hash="synthetic",
                        draft_text="Спасибо за ваш отзыв!", confidence_score=0.99,
                        safety_flags_json=["missing_product_context"] if kind == "unsafe" else [], created_by=actor.id)
        session.add(draft)
        await session.flush()
        reply = Reply(organization_id=message.organization_id, message_id=message.id, ai_draft_id=draft.id,
                      reply_text=draft.draft_text, status="failed", mode="auto", created_by=actor.id,
                      error_code="network_timeout" if kind == "network" else "rate_limited",
                      attempt_count=4, max_attempts=4, last_dispatched_at=datetime.now(UTC),
                      metadata_json={"provider_write_ambiguity": {"error_code": "network_timeout"}} if kind == "ambiguous" else {})
        session.add(reply)
        await session.commit()
        service = ReplyExecutionService(session)
        await service.recover_throttled_replies()
        assert reply.status == expected
        assert reply.attempt_count == 4
        if expected != "failed":
            assert reply.max_attempts == 8 and reply.last_dispatched_at is None
            assert await session.scalar(select(func.count()).select_from(AuditLog).where(
                AuditLog.action == "reply.throttle_recovered", AuditLog.entity_id == str(reply.id),
            )) == 1
            assert await service.recover_throttled_replies() == 0
        else:
            assert reply.max_attempts == 4
        if kind == "archived":
            assert message.status == "archived"
            other = await seed(session)
            queued = Reply(organization_id=other.organization_id, message_id=other.id, reply_text="Спасибо!",
                           status="queued", mode="auto", attempt_count=0, max_attempts=4, metadata_json={})
            session.add(queued)
            await session.commit()
            assert await service.recover_throttled_replies() == 0
            assert queued.id in await claim_due_replies(session, now=datetime.now(UTC), owner="recovery-test", limit=25)
            assert message.status == "archived" and reply.status == "failed"
        if kind == "question":
            assert reply.mode == "semi_auto"
            manual = ManualReplyService(session)
            queue, _ = await manual.list_review_queue(actor=actor, organization_id=message.organization_id, page=1, page_size=25)
            assert reply.id in {item[0].id for item in queue}
            reply.mode = "auto"
            await session.commit()
            await service.recover_throttled_replies()
            assert reply.mode == "semi_auto"
            fresh = AIDraft(organization_id=message.organization_id, message_id=message.id, model="synthetic",
                            prompt_version="marketplace-reply-v3.1-compatibility", prompt_input_hash="fresh",
                            draft_text="Пришлите маркировку детали.", confidence_score=0.74,
                            safety_flags_json=["missing_product_context", "needs_manual_review"], created_by=actor.id)
            session.add(fresh)
            await session.flush()
            reply.mode = "auto"
            await session.commit()
            if session.get_bind().dialect.name == "postgresql":
                async with automatic_db() as concurrent:
                    await concurrent.scalar(select(Reply).where(Reply.id == reply.id).with_for_update())
                    async with asyncio.timeout(2):
                        with pytest.raises(HTTPException) as busy:
                            await manual.create_draft(actor=actor, message_id=message.id,
                                                      ai_draft_id=fresh.id, reply_text=fresh.draft_text)
                        assert busy.value.status_code == 409
                    await session.rollback()
                    await concurrent.rollback()
                for item in (actor, message, reply, draft, fresh):
                    await session.refresh(item)
            reply.approved_by, reply.approved_at = actor.id, datetime.now(UTC)
            updated, _ = await manual.create_draft(actor=actor, message_id=message.id, ai_draft_id=fresh.id, reply_text=fresh.draft_text)
            assert updated.id == reply.id and updated.revision == 2 and updated.ai_draft_id == fresh.id
            assert updated.mode == "semi_auto"
            assert updated.approved_by is None and updated.approved_at is None
            assert await session.get(AIDraft, draft.id) is draft and draft.draft_text != fresh.draft_text
            reviewed, _ = await manual.submit_for_review(actor=actor, reply_id=updated.id)
            assert reviewed.status == "waiting_review" and message.status == "waiting_review"


@pytest.mark.parametrize("kind,expected", [("review", "queued"), ("question", "manual_review_required"),
                                         ("already_review", "manual_review_required"), ("ambiguous", "failed"), ("archived", "failed")])
async def test_postgres_throttle_recovery_preserves_authorization_and_publication_safety(
    postgres_credits: async_sessionmaker[AsyncSession], kind: str, expected: str,
) -> None:
    await test_legacy_throttle_recovery_rechecks_safety_preserves_history_and_is_idempotent(postgres_credits, kind, expected)
