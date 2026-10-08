from app.automation.state_machine import ensure_message_transition
from app.models.enums import MessageStatus


def test_external_yandex_reconciliation_can_mark_unprocessed_question_answered() -> None:
    ensure_message_transition(
        MessageStatus.NEEDS_REPLY.value,
        MessageStatus.ANSWERED.value,
    )
