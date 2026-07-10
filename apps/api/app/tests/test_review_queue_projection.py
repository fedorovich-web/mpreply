from app.models.reply import Reply
from app.services.manual_reply_service import ManualReplyService


def test_review_queue_safety_summary_uses_persisted_metadata() -> None:
    reply = Reply(
        metadata_json={
            "safety_decision": "manual_review",
            "safety_flags": ["negative_review", "needs_manual_review"],
            "safety_reasons": ["Low confidence"],
        }
    )

    decision, flags, reasons = ManualReplyService.safety_summary(reply)

    assert decision == "manual_review"
    assert flags == ["negative_review", "needs_manual_review"]
    assert reasons == ["Low confidence"]


def test_review_queue_safety_summary_filters_invalid_metadata_types() -> None:
    reply = Reply(
        metadata_json={
            "safety_decision": 123,
            "safety_flags": ["valid", 7, None],
            "safety_reasons": "not-a-list",
        }
    )

    decision, flags, reasons = ManualReplyService.safety_summary(reply)

    assert decision == "manual_review"
    assert flags == ["valid"]
    assert reasons == []
