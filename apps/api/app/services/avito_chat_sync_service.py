from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import MarketplaceErrorCode
from app.adapters.conversation import ConversationAdapter, ConversationMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.avito_chat_ingest_service import (
    AvitoChatIngestService,
    InvalidAvitoChatTurn,
)
from app.services.marketplace_ingest_service import IngestStats, MarketplaceIngestService
from app.services.marketplace_sync_state_service import MarketplaceSyncStateService

_CHECKPOINT_KEY = "avito_chat_sync"
_CHECKPOINT_VERSION = 1
_MAX_CHATS_PER_RUN = 25
_MAX_MESSAGE_PAGES = 11
_MAX_CHAT_PAGES = 11
_MAX_CURSOR_OFFSET = 1_000


@dataclass(frozen=True, slots=True)
class AvitoChatSyncResult:
    state: MarketplaceSyncState
    completed: bool
    has_more: bool
    stats: IngestStats
    skipped_chats: int = 0
    error_code: MarketplaceErrorCode | None = None
    retry_after_seconds: int | None = None


@dataclass(slots=True)
class _Checkpoint:
    cursor: str | None
    skipped_versions: dict[str, int]


@dataclass(frozen=True, slots=True)
class _MessagesFetch:
    ok: bool
    items: tuple[ConversationMessage, ...] = ()
    error_code: MarketplaceErrorCode | None = None
    retry_after_seconds: int | None = None


class AvitoChatSyncService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        adapter: ConversationAdapter,
        states: MarketplaceSyncStateService,
        ingest: MarketplaceIngestService,
        projector: AvitoChatIngestService | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.adapter = adapter
        self.states = states
        self.ingest = ingest
        self.projector = projector or AvitoChatIngestService()
        self.clock = clock or _utc_now

    async def sync_batch(
        self,
        *,
        account: MarketplaceAccount,
        credential: str,
        state: MarketplaceSyncState,
        owner: str,
        lease_for: timedelta,
        max_chats: int = _MAX_CHATS_PER_RUN,
    ) -> AvitoChatSyncResult:
        if type(max_chats) is not int or not 1 <= max_chats <= _MAX_CHATS_PER_RUN:
            raise ValueError("Avito chat batch size is outside safe bounds")
        if account.seller_id is None:
            return self._failure(state, "marketplace_validation_error")
        try:
            checkpoint = _load_checkpoint(state.metadata_json or {})
        except ValueError:
            return self._failure(state, "malformed_payload")

        stats = IngestStats()
        skipped = 0
        processed = 0
        chat_pages = 0
        while processed < max_chats:
            chat_pages += 1
            if chat_pages > _MAX_CHAT_PAGES:
                return self._failure(state, "malformed_payload", stats, skipped)
            chats_result = await self.adapter.fetch_chats(
                credential,
                account.seller_id,
                checkpoint.cursor,
            )
            if not chats_result.ok or chats_result.data is None:
                return AvitoChatSyncResult(
                    state=state,
                    completed=False,
                    has_more=True,
                    stats=stats,
                    skipped_chats=skipped,
                    error_code=chats_result.error_code or "malformed_payload",
                    retry_after_seconds=chats_result.retry_after_seconds,
                )
            chat_page = chats_result.data
            if not chat_page.items:
                state = await self._store_checkpoint(
                    state,
                    owner,
                    _Checkpoint(cursor=None, skipped_versions={}),
                    lease_for,
                )
                return AvitoChatSyncResult(
                    state=state,
                    completed=True,
                    has_more=False,
                    stats=stats,
                    skipped_chats=skipped,
                )

            provider_list_changed = False
            for chat in chat_page.items:
                known_version = checkpoint.skipped_versions.get(chat.external_id)
                if known_version == chat.updated_unix:
                    skipped += 1
                    continue
                checkpoint.skipped_versions.pop(chat.external_id, None)
                messages_result = await self._fetch_all_messages(
                    credential,
                    account.seller_id,
                    chat.external_id,
                )
                if not messages_result.ok:
                    return AvitoChatSyncResult(
                        state=state,
                        completed=False,
                        has_more=True,
                        stats=stats,
                        skipped_chats=skipped,
                        error_code=messages_result.error_code or "malformed_payload",
                        retry_after_seconds=messages_result.retry_after_seconds,
                    )
                try:
                    projection = self.projector.project(chat, messages_result.items)
                except InvalidAvitoChatTurn:
                    return self._failure(state, "malformed_payload", stats, skipped)

                if projection.can_mark_read:
                    checkpoint.cursor = None
                else:
                    checkpoint.skipped_versions[chat.external_id] = chat.updated_unix
                completed_at = self._now()
                async with self.session.begin():
                    page_stats = await self.ingest.ingest_page(
                        account,
                        projection.page,
                        completed_at,
                    )
                    state = await self.states.complete_page(
                        state_id=state.id,
                        owner=owner,
                        current_cursor=state.cursor,
                        next_cursor=state.cursor,
                        metadata=_store_checkpoint(
                            state.metadata_json or {},
                            checkpoint,
                        ),
                        now=completed_at,
                        lease_for=lease_for,
                    )
                stats = _add_stats(stats, page_stats)
                processed += 1

                if not projection.can_mark_read:
                    skipped += 1
                    if processed >= max_chats:
                        break
                    continue

                marked = await self.adapter.mark_chat_read(
                    credential,
                    account.seller_id,
                    chat.external_id,
                )
                if not marked.ok:
                    return AvitoChatSyncResult(
                        state=state,
                        completed=False,
                        has_more=True,
                        stats=stats,
                        skipped_chats=skipped,
                        error_code=marked.error_code or "malformed_payload",
                        retry_after_seconds=marked.retry_after_seconds,
                    )
                checkpoint.cursor = None
                checkpoint.skipped_versions.pop(chat.external_id, None)
                state = await self._store_checkpoint(
                    state,
                    owner,
                    checkpoint,
                    lease_for,
                )
                provider_list_changed = True
                chat_pages = 0
                break

            if processed >= max_chats:
                return AvitoChatSyncResult(
                    state=state,
                    completed=False,
                    has_more=True,
                    stats=stats,
                    skipped_chats=skipped,
                )
            if provider_list_changed:
                continue
            if chat_page.next_cursor is None:
                state = await self._store_checkpoint(
                    state,
                    owner,
                    _Checkpoint(cursor=None, skipped_versions={}),
                    lease_for,
                )
                return AvitoChatSyncResult(
                    state=state,
                    completed=True,
                    has_more=False,
                    stats=stats,
                    skipped_chats=skipped,
                )
            checkpoint.cursor = chat_page.next_cursor
            state = await self._store_checkpoint(
                state,
                owner,
                checkpoint,
                lease_for,
            )

        return AvitoChatSyncResult(
            state=state,
            completed=False,
            has_more=True,
            stats=stats,
            skipped_chats=skipped,
        )

    async def _fetch_all_messages(
        self,
        credential: str,
        seller_id: str,
        chat_id: str,
    ) -> _MessagesFetch:
        cursor: str | None = None
        seen: set[str | None] = set()
        messages: list[ConversationMessage] = []
        for _ in range(_MAX_MESSAGE_PAGES):
            if cursor in seen:
                return _MessagesFetch(False, error_code="malformed_payload")
            seen.add(cursor)
            result = await self.adapter.fetch_chat_messages(
                credential,
                seller_id,
                chat_id,
                cursor,
            )
            if not result.ok or result.data is None:
                return _MessagesFetch(
                    False,
                    error_code=result.error_code or "malformed_payload",
                    retry_after_seconds=result.retry_after_seconds,
                )
            messages.extend(result.data.items)
            cursor = result.data.next_cursor
            if cursor is None:
                return _MessagesFetch(True, items=tuple(messages))
        return _MessagesFetch(False, error_code="malformed_payload")

    async def _store_checkpoint(
        self,
        state: MarketplaceSyncState,
        owner: str,
        checkpoint: _Checkpoint,
        lease_for: timedelta,
    ) -> MarketplaceSyncState:
        now = self._now()
        async with self.session.begin():
            return await self.states.complete_page(
                state_id=state.id,
                owner=owner,
                current_cursor=state.cursor,
                next_cursor=state.cursor,
                metadata=_store_checkpoint(state.metadata_json or {}, checkpoint),
                now=now,
                lease_for=lease_for,
            )

    def _now(self) -> datetime:
        current = self.clock()
        if current.tzinfo is None or current.utcoffset() is None:
            raise ValueError("Avito chat sync clock must be timezone-aware")
        return current

    @staticmethod
    def _failure(
        state: MarketplaceSyncState,
        error_code: MarketplaceErrorCode,
        stats: IngestStats = IngestStats(),
        skipped: int = 0,
    ) -> AvitoChatSyncResult:
        return AvitoChatSyncResult(
            state=state,
            completed=False,
            has_more=True,
            stats=stats,
            skipped_chats=skipped,
            error_code=error_code,
        )


def _load_checkpoint(metadata: dict[str, object]) -> _Checkpoint:
    value = metadata.get(_CHECKPOINT_KEY)
    if value is None:
        return _Checkpoint(cursor=None, skipped_versions={})
    if not isinstance(value, dict):
        raise ValueError("Avito chat checkpoint is invalid")
    raw = cast(dict[str, object], value)
    if set(raw) != {"version", "cursor", "skipped_versions"}:
        raise ValueError("Avito chat checkpoint shape is invalid")
    cursor = raw["cursor"]
    skipped = raw["skipped_versions"]
    if type(raw["version"]) is not int or raw["version"] != _CHECKPOINT_VERSION:
        raise ValueError("Avito chat checkpoint values are invalid")
    if not _valid_cursor(cursor):
        raise ValueError("Avito chat checkpoint values are invalid")
    if not isinstance(skipped, dict):
        raise ValueError("Avito skipped chat versions are invalid")
    skipped_mapping = cast(dict[object, object], skipped)
    if len(skipped_mapping) > _MAX_CURSOR_OFFSET or not all(
        isinstance(chat_id, str)
        and chat_id
        and chat_id == chat_id.strip()
        and len(chat_id) <= 255
        and "\x00" not in chat_id
        and type(updated) is int
        and updated >= 0
        for chat_id, updated in skipped_mapping.items()
    ):
        raise ValueError("Avito skipped chat versions are invalid")
    return _Checkpoint(
        cursor=cast(str | None, cursor),
        skipped_versions={cast(str, chat_id): cast(int, updated) for chat_id, updated in skipped_mapping.items()},
    )


def _store_checkpoint(
    metadata: dict[str, object],
    checkpoint: _Checkpoint,
) -> dict[str, object]:
    result = dict(metadata)
    if checkpoint.cursor is None and not checkpoint.skipped_versions:
        result.pop(_CHECKPOINT_KEY, None)
        return result
    result[_CHECKPOINT_KEY] = {
        "version": _CHECKPOINT_VERSION,
        "cursor": checkpoint.cursor,
        "skipped_versions": dict(checkpoint.skipped_versions),
    }
    return result


def _valid_cursor(value: object) -> bool:
    if value is None:
        return True
    if not isinstance(value, str) or not value.isascii() or not value.isdecimal():
        return False
    offset = int(value)
    return 0 <= offset <= _MAX_CURSOR_OFFSET and str(offset) == value and offset % 100 == 0


def _add_stats(left: IngestStats, right: IngestStats) -> IngestStats:
    return IngestStats(
        created_messages=left.created_messages + right.created_messages,
        updated_messages=left.updated_messages + right.updated_messages,
        created_products=left.created_products + right.created_products,
        updated_products=left.updated_products + right.updated_products,
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)
