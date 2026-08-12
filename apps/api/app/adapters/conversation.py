from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol, runtime_checkable

from app.adapters.base import AdapterResult


@dataclass(frozen=True)
class AvitoChat:
    id: str
    created_unix: int
    updated_unix: int
    chat_type: str | None
    item_id: int | None
    item_title: str | None
    item_url: str | None
    customer_id: int | None
    customer_name: str | None


@dataclass(frozen=True)
class AvitoMessage:
    id: str
    author_id: int
    created_unix: int
    direction: Literal["in", "out"]
    is_read: bool
    read_unix: int | None
    kind: str
    text: str | None


@runtime_checkable
class ConversationAdapter(Protocol):
    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult: ...

    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult: ...

    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult: ...

    async def has_existing_chat_reply(
        self, credential: str, user_id: str, *, chat_id: str, inbound_created_unix: int
    ) -> AdapterResult: ...

    async def send_chat_message(
        self, credential: str, user_id: str, *, chat_id: str, text: str
    ) -> AdapterResult: ...
