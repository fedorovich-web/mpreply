from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, cast

from app.adapters.avito import AvitoAdapter
from app.adapters.base import AdapterResult
from app.adapters.conversation import AvitoChat, AvitoMessage
from app.core.config import Settings
from app.tools.marketplace_runtime_probe import (
    FinalStatus,
    ProbeStep,
    RuntimeProbeReport,
    build_report,
    classify_result,
    exit_code,
    safe_scopes,
    validate_git_sha,
    write_report_atomic,
)

ProbeMode = Literal["read-only", "write-chat-message", "write-mark-read"]

_CHAT_WRITE_CONFIRMATION = "I_UNDERSTAND_AVITO_CHAT_WRITE"
_MARK_READ_CONFIRMATION = "I_UNDERSTAND_AVITO_MARK_READ"
_DEFAULT_OUTPUT = Path(".handoff/avito-runtime-verification.json")
_PAGE_SIZE = 100
_MAX_ALLOWED_PAGES = 5


@dataclass(frozen=True)
class AvitoProbeConfig:
    access_token: str
    user_id: str
    mode: ProbeMode = "read-only"
    max_pages: int = 2
    chat_id: str | None = None
    inbound_created_unix: int | None = None
    message_text: str | None = None
    confirmation: str | None = None

    def validate(self) -> None:
        if not self.access_token.strip():
            raise ValueError("AVITO_ACCESS_TOKEN is required")
        normalized_user_id = self.user_id.strip()
        if (
            not normalized_user_id
            or not normalized_user_id.isascii()
            or not normalized_user_id.isdecimal()
            or int(normalized_user_id) <= 0
        ):
            raise ValueError("AVITO_USER_ID must be a positive decimal integer")
        if self.max_pages < 1 or self.max_pages > _MAX_ALLOWED_PAGES:
            raise ValueError(f"max_pages must be between 1 and {_MAX_ALLOWED_PAGES}")
        if self.mode == "read-only":
            return
        if not (self.chat_id or "").strip():
            raise ValueError("write mode requires AVITO_CHAT_ID")
        if self.mode == "write-chat-message":
            if self.confirmation != _CHAT_WRITE_CONFIRMATION:
                raise ValueError("write-chat-message mode requires its exact confirmation phrase")
            if type(self.inbound_created_unix) is not int or self.inbound_created_unix < 0:
                raise ValueError("write-chat-message mode requires AVITO_INBOUND_CREATED_UNIX")
            if not (self.message_text or "").strip():
                raise ValueError("write-chat-message mode requires AVITO_MESSAGE_TEXT")
        elif self.confirmation != _MARK_READ_CONFIRMATION:
            raise ValueError("write-mark-read mode requires its exact confirmation phrase")


@dataclass(frozen=True)
class _ReadProbeResult:
    status: FinalStatus
    steps: list[ProbeStep]


@dataclass(frozen=True)
class _WriteProbeResult:
    status: FinalStatus
    steps: list[ProbeStep]
    attempted: bool
    confirmed: bool | None


def _failure_step(name: str, result: AdapterResult, *, write_started: bool) -> ProbeStep:
    return ProbeStep(
        name=name,
        status=classify_result(result, write_started=write_started),
        error_code=result.error_code or "marketplace_error",
        retry_after_seconds=result.retry_after_seconds,
    )


def _answered_value(result: AdapterResult) -> bool | None:
    payload = result.data
    if not isinstance(payload, dict):
        return None
    value = cast(dict[str, object], payload).get("answered")
    return value if isinstance(value, bool) else None


async def _probe_messages(
    *,
    adapter: AvitoAdapter,
    config: AvitoProbeConfig,
    chat: AvitoChat,
) -> tuple[ProbeStep | None, int, int]:
    pages_checked = 0
    messages_seen = 0
    for page_index in range(config.max_pages):
        result = await adapter.fetch_chat_messages(
            config.access_token,
            config.user_id,
            chat.id,
            limit=_PAGE_SIZE,
            offset=page_index * _PAGE_SIZE,
        )
        if not result.ok:
            step = _failure_step("fetch_chat_messages", result, write_started=False)
            return step, pages_checked, messages_seen
        messages = cast(list[AvitoMessage], result.data)
        pages_checked += 1
        messages_seen += len(messages)
        if len(messages) < _PAGE_SIZE:
            break
    return None, pages_checked, messages_seen


async def _probe_reads(*, adapter: AvitoAdapter, config: AvitoProbeConfig) -> _ReadProbeResult:
    chat_pages = 0
    chats_seen = 0
    message_pages = 0
    messages_seen = 0
    for page_index in range(config.max_pages):
        result = await adapter.fetch_chats(
            config.access_token,
            config.user_id,
            unread_only=False,
            limit=_PAGE_SIZE,
            offset=page_index * _PAGE_SIZE,
        )
        if not result.ok:
            return _ReadProbeResult(
                status=classify_result(result, write_started=False),
                steps=[_failure_step("fetch_chats", result, write_started=False)],
            )
        chats = cast(list[AvitoChat], result.data)
        chat_pages += 1
        chats_seen += len(chats)
        for chat in chats:
            failure, checked, seen = await _probe_messages(adapter=adapter, config=config, chat=chat)
            message_pages += checked
            messages_seen += seen
            if failure is not None:
                return _ReadProbeResult(
                    status=failure.status,
                    steps=[
                        ProbeStep(
                            name="fetch_chats",
                            status="PASS",
                            pages_checked=chat_pages,
                            items_seen=chats_seen,
                        ),
                        ProbeStep(
                            name="fetch_chat_messages",
                            status=failure.status,
                            error_code=failure.error_code,
                            retry_after_seconds=failure.retry_after_seconds,
                            pages_checked=message_pages,
                            items_seen=messages_seen,
                        ),
                    ],
                )
        if len(chats) < _PAGE_SIZE:
            break
    steps = [
        ProbeStep(
            name="fetch_chats",
            status="PASS",
            pages_checked=chat_pages,
            items_seen=chats_seen,
        )
    ]
    if chats_seen:
        steps.append(
            ProbeStep(
                name="fetch_chat_messages",
                status="PASS",
                pages_checked=message_pages,
                items_seen=messages_seen,
            )
        )
    return _ReadProbeResult(status="PASS", steps=steps)


async def _probe_chat_write(*, adapter: AvitoAdapter, config: AvitoProbeConfig) -> _WriteProbeResult:
    if config.chat_id is None or config.inbound_created_unix is None or config.message_text is None:
        raise ValueError("chat write configuration is incomplete")
    preflight = await adapter.has_existing_chat_reply(
        config.access_token,
        config.user_id,
        chat_id=config.chat_id,
        inbound_created_unix=config.inbound_created_unix,
    )
    if not preflight.ok:
        status = classify_result(preflight, write_started=False)
        return _WriteProbeResult(
            status=status,
            steps=[_failure_step("write_preflight", preflight, write_started=False)],
            attempted=False,
            confirmed=None,
        )
    answered_before = _answered_value(preflight)
    if answered_before is True:
        return _WriteProbeResult(
            status="BLOCKED",
            steps=[ProbeStep(name="write_preflight", status="BLOCKED", error_code="reply_already_exists")],
            attempted=False,
            confirmed=None,
        )
    if answered_before is None:
        return _WriteProbeResult(
            status="FAIL",
            steps=[ProbeStep(name="write_preflight", status="FAIL", error_code="malformed_preflight")],
            attempted=False,
            confirmed=None,
        )
    send_result = await adapter.send_chat_message(
        config.access_token,
        config.user_id,
        chat_id=config.chat_id,
        text=config.message_text,
    )
    if not send_result.ok:
        status = classify_result(send_result, write_started=True)
        return _WriteProbeResult(
            status=status,
            steps=[_failure_step("write_send", send_result, write_started=True)],
            attempted=True,
            confirmed=None,
        )
    send_step = ProbeStep(name="write_send", status="PASS")
    postflight = await adapter.has_existing_chat_reply(
        config.access_token,
        config.user_id,
        chat_id=config.chat_id,
        inbound_created_unix=config.inbound_created_unix,
    )
    if not postflight.ok:
        return _WriteProbeResult(
            status="AMBIGUOUS",
            steps=[
                send_step,
                ProbeStep(
                    name="write_postflight",
                    status="AMBIGUOUS",
                    error_code=postflight.error_code or "marketplace_error",
                    retry_after_seconds=postflight.retry_after_seconds,
                ),
            ],
            attempted=True,
            confirmed=None,
        )
    visible = _answered_value(postflight)
    if visible is not True:
        return _WriteProbeResult(
            status="AMBIGUOUS",
            steps=[
                send_step,
                ProbeStep(
                    name="write_postflight",
                    status="AMBIGUOUS",
                    error_code="reply_not_visible" if visible is False else "malformed_postflight",
                ),
            ],
            attempted=True,
            confirmed=False if visible is False else None,
        )
    return _WriteProbeResult(
        status="PASS",
        steps=[send_step, ProbeStep(name="write_postflight", status="PASS")],
        attempted=True,
        confirmed=True,
    )


async def _probe_mark_read(*, adapter: AvitoAdapter, config: AvitoProbeConfig) -> _WriteProbeResult:
    if config.chat_id is None:
        raise ValueError("mark-read configuration is incomplete")
    result = await adapter.mark_chat_read(config.access_token, config.user_id, config.chat_id)
    if not result.ok:
        status = classify_result(result, write_started=True)
        return _WriteProbeResult(
            status=status,
            steps=[_failure_step("write_mark_read", result, write_started=True)],
            attempted=True,
            confirmed=None,
        )
    return _WriteProbeResult(
        status="PASS",
        steps=[ProbeStep(name="write_mark_read", status="PASS")],
        attempted=True,
        confirmed=True,
    )


async def run_probe(
    adapter: AvitoAdapter,
    config: AvitoProbeConfig,
    *,
    git_sha: str | None = None,
    app_version: str | None = None,
) -> RuntimeProbeReport:
    started_at = datetime.now(UTC)
    config.validate()
    resolved_git_sha = validate_git_sha(git_sha or os.environ.get("MPREPLY_GIT_SHA", ""))
    resolved_app_version = app_version or Settings().app_version
    steps: list[ProbeStep] = []
    status: FinalStatus = "PASS"
    validation = await adapter.validate_credentials(config.access_token, seller_id=config.user_id)
    scopes = safe_scopes(validation)
    if not validation.ok:
        status = classify_result(validation, write_started=False)
        steps.append(_failure_step("validate_credentials", validation, write_started=False))
    elif "fetch_chats" not in scopes:
        status = "BLOCKED"
        steps.append(ProbeStep(name="validate_scopes", status="BLOCKED", error_code="insufficient_scope"))
    else:
        steps.append(ProbeStep(name="validate_credentials", status="PASS"))
    if status == "PASS":
        reads = await _probe_reads(adapter=adapter, config=config)
        status = reads.status
        steps.extend(reads.steps)
    write_attempted = False
    write_confirmed: bool | None = None
    if status == "PASS" and config.mode == "write-chat-message":
        write_result = await _probe_chat_write(adapter=adapter, config=config)
        status = write_result.status
        steps.extend(write_result.steps)
        write_attempted = write_result.attempted
        write_confirmed = write_result.confirmed
    elif status == "PASS" and config.mode == "write-mark-read":
        write_result = await _probe_mark_read(adapter=adapter, config=config)
        status = write_result.status
        steps.extend(write_result.steps)
        write_attempted = write_result.attempted
        write_confirmed = write_result.confirmed
    return build_report(
        provider="avito",
        mode=config.mode,
        status=status,
        started_at=started_at,
        finished_at=datetime.now(UTC),
        git_sha=resolved_git_sha,
        app_version=resolved_app_version,
        credential=config.access_token,
        account_id=config.user_id,
        page_budget=config.max_pages,
        pages_checked=sum(step.pages_checked or 0 for step in steps),
        scopes=scopes,
        steps=steps,
        write_target=config.chat_id,
        write_attempted=write_attempted,
        write_confirmed=write_confirmed,
    )


def _parse_mode(value: str) -> ProbeMode:
    if value not in {"read-only", "write-chat-message", "write-mark-read"}:
        raise argparse.ArgumentTypeError("mode must be read-only, write-chat-message, or write-mark-read")
    return cast(ProbeMode, value)


def _parse_optional_unix(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError("AVITO_INBOUND_CREATED_UNIX must be an integer") from exc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safely verify the Avito Messenger runtime contract")
    parser.add_argument("--mode", type=_parse_mode, default="read-only")
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--output", type=Path, default=_DEFAULT_OUTPUT)
    parser.add_argument("--confirmation", default=None)
    return parser


def _config_from_environment(*, mode: ProbeMode, max_pages: int, confirmation: str | None) -> AvitoProbeConfig:
    return AvitoProbeConfig(
        access_token=os.environ.get("AVITO_ACCESS_TOKEN", ""),
        user_id=os.environ.get("AVITO_USER_ID", ""),
        mode=mode,
        max_pages=max_pages,
        chat_id=os.environ.get("AVITO_CHAT_ID"),
        inbound_created_unix=_parse_optional_unix(os.environ.get("AVITO_INBOUND_CREATED_UNIX")),
        message_text=os.environ.get("AVITO_MESSAGE_TEXT"),
        confirmation=confirmation,
    )


def write_runtime_probe_report(
    path: Path,
    report: RuntimeProbeReport,
    *,
    forbidden_values: tuple[str, ...] = (),
) -> None:
    write_report_atomic(path, report, forbidden_values=forbidden_values)


async def _async_main() -> int:
    parser = _build_parser()
    namespace = parser.parse_args()
    mode = cast(ProbeMode, namespace.mode)
    max_pages = cast(int, namespace.max_pages)
    output = cast(Path, namespace.output)
    confirmation = cast(str | None, namespace.confirmation)
    try:
        config = _config_from_environment(mode=mode, max_pages=max_pages, confirmation=confirmation)
        report = await run_probe(AvitoAdapter(timeout_seconds=15.0), config)
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return exit_code("BLOCKED")
    write_runtime_probe_report(
        output,
        report,
        forbidden_values=(
            config.access_token,
            config.user_id,
            config.chat_id or "",
            str(config.inbound_created_unix or ""),
            config.message_text or "",
        ),
    )
    print(f"Avito runtime probe: {report.status}")
    print(f"Evidence: {output}")
    return exit_code(report.status)


def main() -> None:
    raise SystemExit(asyncio.run(_async_main()))


if __name__ == "__main__":
    main()
