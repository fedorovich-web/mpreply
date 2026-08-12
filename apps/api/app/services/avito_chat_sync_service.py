from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult
from app.adapters.conversation import AvitoChat, AvitoMessage, ConversationAdapter
from app.models.enums import MarketplaceSyncStateStatus
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.avito_chat_ingest_service import AvitoChatIngestResult, AvitoChatIngestService

_CHECKPOINT_KEY = "avito_chat_sync"
_CHECKPOINT_SCHEMA_VERSION = 1
_PAGE_LIMIT = 100
_MAX_OFFSET = 1000
_MAX_MESSAGE_PAGES = 11
_MAX_MANUAL_CHATS = 25
_PROVIDER_CALLS_PER_CHAT = _MAX_MESSAGE_PAGES + 1
_MAX_CHAT_PAGE_CALLS = 11
_RETRYABLE_ERRORS = {"network_timeout", "network_error", "rate_limited", "marketplace_unavailable"}
_PAUSING_ERRORS = {"sync_page_limit_exceeded", "sync_pagination_checkpoint_invalid"}


@dataclass(frozen=True)
class AvitoChatSyncResult:
    status: Literal["success", "failed", "paused"]
    created: int = 0
    updated: int = 0
    skipped: int = 0
    has_more: bool = False
    error_code: str | None = None
    retryable: bool = False


@dataclass
class _Checkpoint:
    chat_offset: int
    skipped_chat_versions: dict[str, int]


class AvitoChatSyncService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        adapter: ConversationAdapter,
        ingest: AvitoChatIngestService | None = None,
    ) -> None:
        self.session = session
        self.adapter = adapter
        self.ingest = ingest or AvitoChatIngestService(session)

    async def sync_batch(
        self,
        *,
        account: MarketplaceAccount,
        credential: str,
        state: MarketplaceSyncState,
        max_chats: int,
    ) -> AvitoChatSyncResult:
        if type(max_chats) is not int or not 1 <= max_chats <= _MAX_MANUAL_CHATS:
            return AvitoChatSyncResult(
                status="failed", error_code="invalid_sync_batch_limit", retryable=False
            )
        if account.seller_id is None:
            return AvitoChatSyncResult(
                status="failed", error_code="invalid_account_identifier", retryable=False
            )
        try:
            checkpoint = _load_checkpoint(state.metadata_json or {})
        except ValueError:
            _pause_state(state)
            return AvitoChatSyncResult(
                status="paused",
                error_code="sync_pagination_checkpoint_invalid",
                retryable=False,
            )

        _store_checkpoint(state, checkpoint)
        created = 0
        updated = 0
        skipped = 0
        processed = 0
        provider_calls_left = _MAX_CHAT_PAGE_CALLS + max_chats * _PROVIDER_CALLS_PER_CHAT

        while processed < max_chats:
            if provider_calls_left <= 0:
                return _error_result(state, "sync_page_limit_exceeded")
            provider_calls_left -= 1
            chats_result = await self.adapter.fetch_chats(
                credential,
                account.seller_id,
                unread_only=True,
                limit=_PAGE_LIMIT,
                offset=checkpoint.chat_offset,
            )
            if not chats_result.ok:
                return _error_result(state, chats_result.error_code)
            chats = _chat_list(chats_result.data)
            if chats is None:
                return _error_result(state, "malformed_payload")
            if not chats:
                _clear_checkpoint(state)
                commit_error = await self._commit()
                return commit_error or AvitoChatSyncResult(
                    status="success", created=created, updated=updated, skipped=skipped
                )

            read_mutation = False
            for chat in chats:
                known_version = checkpoint.skipped_chat_versions.get(chat.id)
                if known_version == chat.updated_unix:
                    skipped += 1
                    continue
                if known_version is not None:
                    checkpoint.skipped_chat_versions.pop(chat.id, None)

                messages, failure, used_calls = await self._fetch_messages(
                    credential=credential,
                    user_id=account.seller_id,
                    chat_id=chat.id,
                    provider_calls_left=provider_calls_left,
                )
                provider_calls_left -= used_calls
                if failure is not None:
                    return _error_result(state, failure.error_code)
                assert messages is not None
                try:
                    ingest_result = await self.ingest.ingest_turn(
                        account=account,
                        chat=chat,
                        messages=messages,
                    )
                except Exception:
                    await self.session.rollback()
                    return AvitoChatSyncResult(
                        status="failed",
                        created=created,
                        updated=updated,
                        skipped=skipped,
                        has_more=True,
                        error_code="sync_ingest_failed",
                        retryable=True,
                    )

                processed += 1
                if not ingest_result.can_mark_read:
                    checkpoint.skipped_chat_versions[chat.id] = chat.updated_unix
                    skipped += 1
                    _store_checkpoint(state, checkpoint)
                    commit_error = await self._commit()
                    if commit_error is not None:
                        return _with_counts(commit_error, created, updated, skipped)
                    if processed >= max_chats:
                        return AvitoChatSyncResult(
                            status="success",
                            created=created,
                            updated=updated,
                            skipped=skipped,
                            has_more=True,
                        )
                    continue

                _store_checkpoint(state, checkpoint)
                commit_error = await self._commit()
                if commit_error is not None:
                    return _with_counts(commit_error, created, updated, skipped)
                provider_calls_left -= 1
                if provider_calls_left < 0:
                    return _error_result(state, "sync_page_limit_exceeded")
                read_result = await self.adapter.mark_chat_read(
                    credential, account.seller_id, chat.id
                )
                if not read_result.ok:
                    return AvitoChatSyncResult(
                        status="failed",
                        created=created + _created(ingest_result),
                        updated=updated + _updated(ingest_result),
                        skipped=skipped,
                        has_more=True,
                        error_code=read_result.error_code or "marketplace_error",
                        retryable=(read_result.error_code in _RETRYABLE_ERRORS),
                    )

                created += _created(ingest_result)
                updated += _updated(ingest_result)
                checkpoint.chat_offset = 0
                checkpoint.skipped_chat_versions.pop(chat.id, None)
                _store_checkpoint(state, checkpoint)
                commit_error = await self._commit()
                if commit_error is not None:
                    return _with_counts(commit_error, created, updated, skipped)
                read_mutation = True
                break

            if processed >= max_chats:
                return AvitoChatSyncResult(
                    status="success",
                    created=created,
                    updated=updated,
                    skipped=skipped,
                    has_more=True,
                )
            if read_mutation:
                continue
            if len(chats) < _PAGE_LIMIT:
                _clear_checkpoint(state)
                commit_error = await self._commit()
                return commit_error or AvitoChatSyncResult(
                    status="success", created=created, updated=updated, skipped=skipped
                )
            if checkpoint.chat_offset >= _MAX_OFFSET:
                return _error_result(state, "sync_page_limit_exceeded")
            checkpoint.chat_offset += _PAGE_LIMIT
            _store_checkpoint(state, checkpoint)
            commit_error = await self._commit()
            if commit_error is not None:
                return _with_counts(commit_error, created, updated, skipped)

        return AvitoChatSyncResult(
            status="success",
            created=created,
            updated=updated,
            skipped=skipped,
            has_more=True,
        )

    async def _fetch_messages(
        self,
        *,
        credential: str,
        user_id: str,
        chat_id: str,
        provider_calls_left: int,
    ) -> tuple[list[AvitoMessage] | None, AdapterResult | None, int]:
        messages: list[AvitoMessage] = []
        calls = 0
        for offset in range(0, _MAX_OFFSET + 1, _PAGE_LIMIT):
            if calls >= provider_calls_left:
                return None, AdapterResult(
                    ok=False,
                    error_code="sync_page_limit_exceeded",
                    error_message_safe="Avito chat synchronization exceeded the safe call limit",
                ), calls
            result = await self.adapter.fetch_chat_messages(
                credential,
                user_id,
                chat_id,
                limit=_PAGE_LIMIT,
                offset=offset,
            )
            calls += 1
            if not result.ok:
                return None, result, calls
            page = _message_list(result.data)
            if page is None:
                return None, AdapterResult(
                    ok=False,
                    error_code="malformed_payload",
                    error_message_safe="Avito Messenger response is malformed",
                ), calls
            messages.extend(page)
            if len(page) < _PAGE_LIMIT:
                return messages, None, calls
        return None, AdapterResult(
            ok=False,
            error_code="sync_page_limit_exceeded",
            error_message_safe="Avito message pagination exceeded the safe page limit",
        ), calls

    async def _commit(self) -> AvitoChatSyncResult | None:
        try:
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            return AvitoChatSyncResult(
                status="failed",
                error_code="sync_commit_failed",
                retryable=True,
                has_more=True,
            )
        return None


def _load_checkpoint(metadata: dict[str, object]) -> _Checkpoint:
    raw = metadata.get(_CHECKPOINT_KEY)
    if raw is None:
        return _Checkpoint(chat_offset=0, skipped_chat_versions={})
    if not isinstance(raw, dict):
        raise ValueError("Invalid Avito chat sync checkpoint")
    data = cast(dict[str, object], raw)
    if set(data) != {"schema_version", "chat_offset", "skipped_chat_versions"}:
        raise ValueError("Invalid Avito chat sync checkpoint")
    schema_version = data["schema_version"]
    chat_offset = data["chat_offset"]
    skipped_raw = data["skipped_chat_versions"]
    if (
        type(schema_version) is not int
        or schema_version != _CHECKPOINT_SCHEMA_VERSION
        or type(chat_offset) is not int
        or chat_offset < 0
        or chat_offset > _MAX_OFFSET
        or not isinstance(skipped_raw, dict)
    ):
        raise ValueError("Invalid Avito chat sync checkpoint")
    skipped_mapping = cast(dict[object, object], skipped_raw)
    if not all(
        isinstance(chat_id, str)
        and bool(chat_id.strip())
        and type(version) is int
        and version >= 0
        for chat_id, version in skipped_mapping.items()
    ):
        raise ValueError("Invalid Avito chat sync checkpoint")
    return _Checkpoint(
        chat_offset=chat_offset,
        skipped_chat_versions={cast(str, key): cast(int, value) for key, value in skipped_mapping.items()},
    )


def _store_checkpoint(state: MarketplaceSyncState, checkpoint: _Checkpoint) -> None:
    state.metadata_json = {
        **(state.metadata_json or {}),
        _CHECKPOINT_KEY: {
            "schema_version": _CHECKPOINT_SCHEMA_VERSION,
            "chat_offset": checkpoint.chat_offset,
            "skipped_chat_versions": dict(checkpoint.skipped_chat_versions),
        },
    }


def _clear_checkpoint(state: MarketplaceSyncState) -> None:
    metadata = dict(state.metadata_json or {})
    metadata.pop(_CHECKPOINT_KEY, None)
    state.metadata_json = metadata


def _pause_state(state: MarketplaceSyncState) -> None:
    state.status = MarketplaceSyncStateStatus.PAUSED.value
    state.next_run_at = None
    state.lease_token = None
    state.lease_expires_at = None


def _error_result(state: MarketplaceSyncState, error_code: str | None) -> AvitoChatSyncResult:
    normalized = error_code or "marketplace_error"
    status: Literal["failed", "paused"] = "paused" if normalized in _PAUSING_ERRORS else "failed"
    if status == "paused":
        _pause_state(state)
    return AvitoChatSyncResult(
        status=status,
        error_code=normalized,
        retryable=normalized in _RETRYABLE_ERRORS,
    )


def _with_counts(
    result: AvitoChatSyncResult, created: int, updated: int, skipped: int
) -> AvitoChatSyncResult:
    return AvitoChatSyncResult(
        status=result.status,
        created=created,
        updated=updated,
        skipped=skipped,
        has_more=result.has_more,
        error_code=result.error_code,
        retryable=result.retryable,
    )


def _created(result: AvitoChatIngestResult) -> int:
    return 1 if result.outcome == "created" else 0


def _updated(result: AvitoChatIngestResult) -> int:
    return 1 if result.outcome in {"updated", "manual_review"} else 0


def _chat_list(value: object | None) -> list[AvitoChat] | None:
    if not isinstance(value, list):
        return None
    values = cast(list[object], value)
    if not all(isinstance(item, AvitoChat) for item in values):
        return None
    return cast(list[AvitoChat], values)


def _message_list(value: object | None) -> list[AvitoMessage] | None:
    if not isinstance(value, list):
        return None
    values = cast(list[object], value)
    if not all(isinstance(item, AvitoMessage) for item in values):
        return None
    return cast(list[AvitoMessage], values)
