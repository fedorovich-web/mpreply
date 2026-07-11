from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.reply import ManualReplyCreateRequest, ManualReplyUpdateRequest


def test_manual_reply_create_accepts_ai_draft_source() -> None:
    payload = ManualReplyCreateRequest(message_id=uuid4(), ai_draft_id=uuid4())
    assert payload.ai_draft_id is not None
    assert payload.reply_text is None


def test_manual_reply_create_accepts_manual_text_source() -> None:
    payload = ManualReplyCreateRequest(message_id=uuid4(), reply_text="Спасибо за вопрос.")
    assert payload.reply_text == "Спасибо за вопрос."


def test_manual_reply_create_rejects_missing_source() -> None:
    with pytest.raises(ValidationError):
        ManualReplyCreateRequest(message_id=uuid4())


def test_manual_reply_update_requires_positive_revision() -> None:
    with pytest.raises(ValidationError):
        ManualReplyUpdateRequest(reply_text="Обновлённый ответ", expected_revision=0)
