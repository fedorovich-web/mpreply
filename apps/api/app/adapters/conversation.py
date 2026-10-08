from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.adapters.base import (
    AdapterResult,
    CredentialAdapter,
    ExistingReplyResult,
    MarketplacePage,
    NormalizedProduct,
    ProviderMessageContext,
    ProviderWriteReceipt,
)


@dataclass(frozen=True, slots=True)
class ConversationParticipant:
    external_id: str
    name: str | None


@dataclass(frozen=True, slots=True)
class ConversationThread:
    external_id: str
    created_unix: int
    updated_unix: int
    participants: tuple[ConversationParticipant, ...]
    product: NormalizedProduct | None
    metadata: dict[str, object]


@dataclass(frozen=True, slots=True)
class ConversationMessage:
    external_id: str
    author_id: str
    created_unix: int
    direction: str
    is_read: bool
    kind: str
    text: str | None


@runtime_checkable
class ConversationAdapter(CredentialAdapter, Protocol):
    async def fetch_chats(
        self,
        credential: str,
        seller_id: str,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[ConversationThread]]: ...

    async def fetch_chat_messages(
        self,
        credential: str,
        seller_id: str,
        chat_id: str,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[ConversationMessage]]: ...

    async def find_existing_chat_reply(
        self,
        credential: str,
        seller_id: str,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]: ...

    async def send_chat_message(
        self,
        credential: str,
        seller_id: str,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]: ...

    async def mark_chat_read(
        self,
        credential: str,
        seller_id: str,
        chat_id: str,
    ) -> AdapterResult[None]: ...
