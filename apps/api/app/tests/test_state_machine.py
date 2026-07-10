import pytest

from app.automation.state_machine import ensure_message_transition, ensure_reply_transition
from app.models.enums import MessageStatus, ReplyStatus


def test_message_state_machine_allows_auto_reply_flow() -> None:
    ensure_message_transition(MessageStatus.AI_DRAFT_READY.value, MessageStatus.AUTO_REPLY_PENDING.value)
    ensure_message_transition(MessageStatus.AUTO_REPLY_PENDING.value, MessageStatus.SENDING.value)
    ensure_message_transition(MessageStatus.SENDING.value, MessageStatus.AUTO_REPLY_SENT.value)


def test_message_state_machine_rejects_invalid_terminal_transition() -> None:
    with pytest.raises(ValueError, match="Invalid customer message transition"):
        ensure_message_transition(MessageStatus.AUTO_REPLY_SENT.value, MessageStatus.SENDING.value)


def test_reply_state_machine_allows_retry_flow() -> None:
    ensure_reply_transition(ReplyStatus.QUEUED.value, ReplyStatus.SENDING.value)
    ensure_reply_transition(ReplyStatus.SENDING.value, ReplyStatus.RETRY_PENDING.value)
    ensure_reply_transition(ReplyStatus.RETRY_PENDING.value, ReplyStatus.SENDING.value)
    ensure_reply_transition(ReplyStatus.SENDING.value, ReplyStatus.SENT.value)
