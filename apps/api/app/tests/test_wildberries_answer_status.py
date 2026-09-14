from collections.abc import AsyncIterator

import httpx
import pytest

from app.adapters.wildberries import WildberriesAdapter


@pytest.fixture
async def wildberries_adapter() -> AsyncIterator[WildberriesAdapter]:
    async with httpx.AsyncClient() as client:
        yield WildberriesAdapter(client)


@pytest.mark.asyncio
async def test_detects_existing_question_answer(wildberries_adapter: WildberriesAdapter) -> None:
    adapter = wildberries_adapter
    payload = {"data": {"id": "question-1", "answer": {"text": "Уже отвечено"}}}
    assert adapter.is_already_answered(payload) is True


@pytest.mark.asyncio
async def test_detects_unanswered_question(wildberries_adapter: WildberriesAdapter) -> None:
    adapter = wildberries_adapter
    payload = {"data": {"id": "question-1", "answer": None}}
    assert adapter.is_already_answered(payload) is False


@pytest.mark.asyncio
async def test_detects_is_answered_flag(wildberries_adapter: WildberriesAdapter) -> None:
    adapter = wildberries_adapter
    payload = {"data": {"id": "feedback-1", "isAnswered": True}}
    assert adapter.is_already_answered(payload) is True
