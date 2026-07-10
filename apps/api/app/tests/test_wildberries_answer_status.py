from app.adapters.wildberries import WildberriesAdapter


def test_detects_existing_question_answer() -> None:
    adapter = WildberriesAdapter()
    payload = {"data": {"id": "question-1", "answer": {"text": "Уже отвечено"}}}
    assert adapter.is_already_answered(payload) is True


def test_detects_unanswered_question() -> None:
    adapter = WildberriesAdapter()
    payload = {"data": {"id": "question-1", "answer": None}}
    assert adapter.is_already_answered(payload) is False


def test_detects_is_answered_flag() -> None:
    adapter = WildberriesAdapter()
    payload = {"data": {"id": "feedback-1", "isAnswered": True}}
    assert adapter.is_already_answered(payload) is True
