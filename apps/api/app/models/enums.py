from enum import StrEnum


class ResponseMode(StrEnum):
    AUTO = "auto"
    SEMI_AUTO = "semi_auto"
    INHERIT = "inherit"


class Marketplace(StrEnum):
    WILDBERRIES = "wildberries"
    OZON = "ozon"
    YANDEX_MARKET = "yandex_market"
    AVITO = "avito"


class MessageType(StrEnum):
    REVIEW = "review"
    QUESTION = "question"
    CHAT = "chat"


class MessageStatus(StrEnum):
    NEW = "new"
    IMPORTED = "imported"
    NEEDS_REPLY = "needs_reply"
    AUTO_RULE_MATCHED = "auto_rule_matched"
    AUTO_REPLY_PENDING = "auto_reply_pending"
    AI_DRAFT_READY = "ai_draft_ready"
    SAFETY_BLOCKED = "safety_blocked"
    NEEDS_MANUAL_CHECK = "needs_manual_check"
    WAITING_REVIEW = "waiting_review"
    APPROVED = "approved"
    SENDING = "sending"
    ANSWERED = "answered"
    AUTO_REPLY_SENT = "auto_reply_sent"
    FAILED = "failed"
    BLOCKED_BY_MARKETPLACE = "blocked_by_marketplace"
    DUPLICATE = "duplicate"
    SKIPPED = "skipped"
    ARCHIVED = "archived"
    ESCALATED = "escalated"


class ReplyStatus(StrEnum):
    DRAFT = "draft"
    QUEUED = "queued"
    SENDING = "sending"
    RETRY_PENDING = "retry_pending"
    SENT = "sent"
    FAILED = "failed"
    BLOCKED = "blocked"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    WAITING_REVIEW = "waiting_review"
    APPROVED = "approved"
