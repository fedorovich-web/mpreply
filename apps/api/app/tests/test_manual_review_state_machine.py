import pytest

from app.automation.state_machine import ensure_message_transition, ensure_reply_transition
from app.models.enums import MessageStatus, ReplyStatus


def test_manual_message_workflow_happy_path() -> None:
    ensure_message_transition(MessageStatus.NEEDS_REPLY.value, MessageStatus.WAITING_REVIEW.value)
    ensure_message_transition(MessageStatus.WAITING_REVIEW.value, MessageStatus.APPROVED.value)
    ensure_message_transition(MessageStatus.APPROVED.value, MessageStatus.SENDING.value)
    ensure_message_transition(MessageStatus.SENDING.value, MessageStatus.ANSWERED.value)


def test_manual_reply_workflow_happy_path() -> None:
    ensure_reply_transition(ReplyStatus.DRAFT.value, ReplyStatus.WAITING_REVIEW.value)
    ensure_reply_transition(ReplyStatus.WAITING_REVIEW.value, ReplyStatus.APPROVED.value)
    ensure_reply_transition(ReplyStatus.APPROVED.value, ReplyStatus.QUEUED.value)
    ensure_reply_transition(ReplyStatus.QUEUED.value, ReplyStatus.SENDING.value)
    ensure_reply_transition(ReplyStatus.SENDING.value, ReplyStatus.SENT.value)


def test_safety_blocked_message_can_enter_human_review() -> None:
    ensure_message_transition(MessageStatus.SAFETY_BLOCKED.value, MessageStatus.WAITING_REVIEW.value)


def test_rejected_review_returns_to_draft() -> None:
    ensure_reply_transition(ReplyStatus.WAITING_REVIEW.value, ReplyStatus.DRAFT.value)
    ensure_message_transition(MessageStatus.WAITING_REVIEW.value, MessageStatus.NEEDS_MANUAL_CHECK.value)


def test_invalid_direct_draft_to_sent_transition_is_rejected() -> None:
    with pytest.raises(ValueError, match="Invalid reply transition"):
        ensure_reply_transition(ReplyStatus.DRAFT.value, ReplyStatus.SENT.value)
