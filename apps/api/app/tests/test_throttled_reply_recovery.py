from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.ai_draft import AIDraft
from app.models.audit_log import AuditLog
from app.models.organization import OrganizationUser
from app.models.reply import Reply
from app.models.user import User
from app.services.reply_execution_service import ReplyExecutionService
from app.tests.test_automatic_drafts import automatic_db, seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits
from app.workers.auto_reply import claim_due_replies

__all__ = ["automatic_db", "postgres_credits", "synthetic_encryption_key"]


@pytest.mark.parametrize("kind,expected", [
    ("review", "queued"), ("question", "manual_review_required"),
    ("unsafe", "manual_review_required"), ("ambiguous", "failed"), ("network", "failed"), ("archived", "failed"),
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
        message.status = "archived" if kind == "archived" else "failed"
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


@pytest.mark.parametrize("kind,expected", [("review", "queued"), ("question", "manual_review_required"), ("ambiguous", "failed"), ("archived", "failed")])
async def test_postgres_throttle_recovery_preserves_authorization_and_publication_safety(
    postgres_credits: async_sessionmaker[AsyncSession], kind: str, expected: str,
) -> None:
    await test_legacy_throttle_recovery_rechecks_safety_preserves_history_and_is_idempotent(postgres_credits, kind, expected)
