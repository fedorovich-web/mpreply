from uuid import uuid4

from app.models.customer_message import CustomerMessage
from app.services.reply_execution_service import ReplyExecutionService


def make_message(external_id: str) -> CustomerMessage:
    return CustomerMessage(
        organization_id=uuid4(),
        marketplace_account_id=uuid4(),
        marketplace="wildberries",
        external_id=external_id,
        type="review",
        status="ai_draft_ready",
        customer_text="Тест",
    )


def test_idempotency_key_is_stable_for_same_marketplace_message() -> None:
    message = make_message("feedback-123")
    first = ReplyExecutionService.build_idempotency_key(message)
    second = ReplyExecutionService.build_idempotency_key(message)
    assert first == second
    assert len(first) == 64


def test_idempotency_key_changes_for_different_external_message() -> None:
    first = make_message("feedback-123")
    second = CustomerMessage(
        organization_id=first.organization_id,
        marketplace_account_id=first.marketplace_account_id,
        marketplace=first.marketplace,
        external_id="feedback-456",
        type=first.type,
        status="ai_draft_ready",
        customer_text="Тест",
    )
    assert ReplyExecutionService.build_idempotency_key(first) != ReplyExecutionService.build_idempotency_key(second)
