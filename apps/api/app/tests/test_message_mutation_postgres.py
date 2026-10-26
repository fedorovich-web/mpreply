from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.customer_message import CustomerMessage
from app.services.message_service import MessageService
from app.tests.test_message_mutation_contract import seed_actor
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["postgres_credits"]


async def test_manual_status_waits_for_concurrent_send_and_preserves_its_state(
    postgres_credits: async_sessionmaker[AsyncSession],
) -> None:
    async with postgres_credits() as session:
        actor, message = await seed_actor(session)
        message_id = message.id
    reader_pid: asyncio.Queue[int] = asyncio.Queue()

    async def archive() -> None:
        async with postgres_credits() as reader:
            backend_pid = await reader.scalar(text("SELECT pg_backend_pid()"))
            assert isinstance(backend_pid, int)
            await reader_pid.put(backend_pid)
            await MessageService(reader).update_message(actor=actor, message_id=message_id, status="archived")
            await reader.commit()

    async with postgres_credits() as writer:
        await writer.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(status="sending"))
        edit = asyncio.create_task(archive())
        try:
            async with asyncio.timeout(5):
                backend_pid = await reader_pid.get()
                async with postgres_credits() as observer:
                    while await observer.scalar(
                        text("SELECT wait_event_type FROM pg_stat_activity WHERE pid = :pid"), {"pid": backend_pid},
                    ) != "Lock":
                        assert not edit.done()
                        await asyncio.sleep(0.01)
            await writer.commit()
            with pytest.raises(HTTPException) as rejected:
                await edit
            assert rejected.value.status_code == 409
        finally:
            await writer.rollback()
            if not edit.done():
                edit.cancel()
            await asyncio.gather(edit, return_exceptions=True)
    async with postgres_credits() as observed:
        assert await observed.scalar(select(CustomerMessage.status).where(CustomerMessage.id == message_id)) == "sending"
