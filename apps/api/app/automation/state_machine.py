from __future__ import annotations

from app.models.enums import MessageStatus, ReplyStatus

_MESSAGE_TRANSITIONS: dict[str, frozenset[str]] = {
    MessageStatus.NEEDS_REPLY.value: frozenset({
        MessageStatus.AI_DRAFT_READY.value,
        MessageStatus.NEEDS_MANUAL_CHECK.value,
        MessageStatus.SAFETY_BLOCKED.value,
        MessageStatus.WAITING_REVIEW.value,
        MessageStatus.ANSWERED.value,
    }),
    MessageStatus.AI_DRAFT_READY.value: frozenset({
        MessageStatus.AUTO_REPLY_PENDING.value,
        MessageStatus.NEEDS_MANUAL_CHECK.value,
        MessageStatus.WAITING_REVIEW.value,
        MessageStatus.SAFETY_BLOCKED.value,
    }),
    MessageStatus.NEEDS_MANUAL_CHECK.value: frozenset({
        MessageStatus.AI_DRAFT_READY.value,
        MessageStatus.WAITING_REVIEW.value,
        MessageStatus.ESCALATED.value,
        MessageStatus.SAFETY_BLOCKED.value,
    }),
    MessageStatus.SAFETY_BLOCKED.value: frozenset({
        MessageStatus.NEEDS_MANUAL_CHECK.value,
        MessageStatus.WAITING_REVIEW.value,
        MessageStatus.ESCALATED.value,
    }),
    MessageStatus.WAITING_REVIEW.value: frozenset({
        MessageStatus.APPROVED.value,
        MessageStatus.NEEDS_MANUAL_CHECK.value,
        MessageStatus.ESCALATED.value,
    }),
    MessageStatus.APPROVED.value: frozenset({
        MessageStatus.SENDING.value,
        MessageStatus.FAILED.value,
        MessageStatus.BLOCKED_BY_MARKETPLACE.value,
        MessageStatus.ANSWERED.value,
    }),
    MessageStatus.AUTO_RULE_MATCHED.value: frozenset({
        MessageStatus.AUTO_REPLY_PENDING.value,
        MessageStatus.NEEDS_MANUAL_CHECK.value,
    }),
    MessageStatus.AUTO_REPLY_PENDING.value: frozenset({
        MessageStatus.SENDING.value,
        MessageStatus.NEEDS_MANUAL_CHECK.value,
        MessageStatus.FAILED.value,
        MessageStatus.BLOCKED_BY_MARKETPLACE.value,
        MessageStatus.AUTO_REPLY_SENT.value,
    }),
    MessageStatus.SENDING.value: frozenset({
        MessageStatus.AUTO_REPLY_PENDING.value,
        MessageStatus.APPROVED.value,
        MessageStatus.AUTO_REPLY_SENT.value,
        MessageStatus.ANSWERED.value,
        MessageStatus.FAILED.value,
        MessageStatus.BLOCKED_BY_MARKETPLACE.value,
    }),
    MessageStatus.FAILED.value: frozenset({
        MessageStatus.AUTO_REPLY_PENDING.value,
        MessageStatus.APPROVED.value,
        MessageStatus.SENDING.value,
        MessageStatus.NEEDS_MANUAL_CHECK.value,
    }),
}

_REPLY_TRANSITIONS: dict[str, frozenset[str]] = {
    ReplyStatus.DRAFT.value: frozenset({
        ReplyStatus.QUEUED.value,
        ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
        ReplyStatus.WAITING_REVIEW.value,
    }),
    ReplyStatus.MANUAL_REVIEW_REQUIRED.value: frozenset({
        ReplyStatus.DRAFT.value,
        ReplyStatus.WAITING_REVIEW.value,
        ReplyStatus.BLOCKED.value,
    }),
    ReplyStatus.WAITING_REVIEW.value: frozenset({
        ReplyStatus.DRAFT.value,
        ReplyStatus.APPROVED.value,
        ReplyStatus.BLOCKED.value,
    }),
    ReplyStatus.APPROVED.value: frozenset({
        ReplyStatus.DRAFT.value,
        ReplyStatus.QUEUED.value,
        ReplyStatus.BLOCKED.value,
    }),
    ReplyStatus.QUEUED.value: frozenset({
        ReplyStatus.SENDING.value,
        ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
        ReplyStatus.FAILED.value,
        ReplyStatus.BLOCKED.value,
        ReplyStatus.SENT.value,
    }),
    ReplyStatus.SENDING.value: frozenset({
        ReplyStatus.RETRY_PENDING.value,
        ReplyStatus.SENT.value,
        ReplyStatus.FAILED.value,
        ReplyStatus.BLOCKED.value,
        ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
    }),
    ReplyStatus.RETRY_PENDING.value: frozenset({
        ReplyStatus.QUEUED.value,
        ReplyStatus.SENDING.value,
        ReplyStatus.FAILED.value,
        ReplyStatus.BLOCKED.value,
        ReplyStatus.SENT.value,
        ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
    }),
    ReplyStatus.FAILED.value: frozenset({
        ReplyStatus.QUEUED.value,
        ReplyStatus.SENDING.value,
        ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
    }),
}


def ensure_message_transition(current: str, target: str) -> None:
    if current == target:
        return
    allowed = _MESSAGE_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise ValueError(f"Invalid customer message transition: {current} -> {target}")


def ensure_reply_transition(current: str, target: str) -> None:
    if current == target:
        return
    allowed = _REPLY_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise ValueError(f"Invalid reply transition: {current} -> {target}")
