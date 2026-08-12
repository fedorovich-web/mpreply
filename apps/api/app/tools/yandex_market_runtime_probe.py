from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, cast

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.yandex_market import YandexMarketAdapter
from app.core.config import Settings
from app.models.enums import MessageType
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

ProbeMode = Literal["read-only", "write-review", "write-question"]

_WRITE_CONFIRMATION = "I_UNDERSTAND_YANDEX_MARKET_WRITE"
_PROTECTED_QUESTION_ID = "27265525"
_DEFAULT_OUTPUT = Path(".handoff/yandex-market-runtime-verification.json")
_MAX_ALLOWED_PAGES = 5


@dataclass(frozen=True)
class ProbeConfig:
    credential: str
    business_id: str
    mode: ProbeMode = "read-only"
    max_pages: int = 2
    review_id: str | None = None
    question_id: str | None = None
    reply_text: str | None = None
    confirmation: str | None = None

    def validate(self) -> None:
        if not self.credential.strip():
            raise ValueError("YANDEX_MARKET_API_KEY is required")
        if not self.business_id.strip().isdecimal() or int(self.business_id) <= 0:
            raise ValueError("YANDEX_MARKET_BUSINESS_ID must be a positive integer")
        if self.max_pages < 1 or self.max_pages > _MAX_ALLOWED_PAGES:
            raise ValueError(f"max_pages must be between 1 and {_MAX_ALLOWED_PAGES}")
        if self.mode == "read-only":
            return
        if self.confirmation != _WRITE_CONFIRMATION:
            raise ValueError("write mode requires the exact confirmation phrase")
        if not (self.reply_text or "").strip():
            raise ValueError("write mode requires YANDEX_MARKET_REPLY_TEXT")
        if self.mode == "write-review" and not _is_positive_integer(self.review_id):
            raise ValueError("write-review mode requires a positive YANDEX_MARKET_REVIEW_ID")
        if self.mode == "write-question" and not _is_positive_integer(self.question_id):
            raise ValueError("write-question mode requires a positive YANDEX_MARKET_QUESTION_ID")
        if self.mode == "write-question" and self.question_id == _PROTECTED_QUESTION_ID:
            raise ValueError("protected Yandex Market question is permanently read-only")


@dataclass(frozen=True)
class _StreamProbeResult:
    step: ProbeStep
    ok: bool


@dataclass(frozen=True)
class _WriteProbeResult:
    status: FinalStatus
    steps: list[ProbeStep]
    attempted: bool
    confirmed: bool | None


def _is_positive_integer(value: str | None) -> bool:
    return bool(value and value.strip().isdecimal() and int(value) > 0)


def _failure_step(name: str, result: AdapterResult, *, write_started: bool) -> ProbeStep:
    return ProbeStep(
        name=name,
        status=classify_result(result, write_started=write_started),
        error_code=result.error_code or "marketplace_error",
        retry_after_seconds=result.retry_after_seconds,
    )


def _normalized_sample_is_valid(adapter: MarketplaceAdapter, stream: str, item: dict[str, object]) -> bool:
    normalized = adapter.normalize_review(item) if stream == "reviews" else adapter.normalize_question(item)
    external_id = normalized.get("external_id")
    customer_text = normalized.get("customer_text")
    product = normalized.get("product")
    return bool(str(external_id or "").strip()) and isinstance(customer_text, str) and isinstance(product, dict)


async def _probe_stream(
    *,
    adapter: MarketplaceAdapter,
    credential: str,
    business_id: str,
    stream: Literal["reviews", "questions"],
    max_pages: int,
) -> _StreamProbeResult:
    cursor: str | None = None
    seen_cursors: set[str] = set()
    pages_checked = 0
    items_seen = 0

    while pages_checked < max_pages:
        result = (
            await adapter.fetch_reviews(credential, cursor=cursor, seller_id=business_id)
            if stream == "reviews"
            else await adapter.fetch_questions(credential, cursor=cursor, seller_id=business_id)
        )
        if not result.ok:
            return _StreamProbeResult(_failure_step(f"fetch_{stream}", result, write_started=False), False)

        items = adapter.extract_reviews(result.data) if stream == "reviews" else adapter.extract_questions(result.data)
        pages_checked += 1
        items_seen += len(items)
        if items and not _normalized_sample_is_valid(adapter, stream, items[0]):
            return _StreamProbeResult(
                ProbeStep(
                    name=f"fetch_{stream}",
                    status="FAIL",
                    error_code="normalization_failed",
                    pages_checked=pages_checked,
                    items_seen=items_seen,
                ),
                False,
            )

        next_cursor = result.next_cursor
        if not next_cursor:
            break
        if next_cursor == cursor or next_cursor in seen_cursors:
            return _StreamProbeResult(
                ProbeStep(
                    name=f"fetch_{stream}",
                    status="FAIL",
                    error_code="cursor_cycle",
                    pages_checked=pages_checked,
                    items_seen=items_seen,
                ),
                False,
            )
        seen_cursors.add(next_cursor)
        cursor = next_cursor

    return _StreamProbeResult(
        ProbeStep(
            name=f"fetch_{stream}",
            status="PASS",
            pages_checked=pages_checked,
            items_seen=items_seen,
        ),
        True,
    )


async def _probe_write(*, adapter: MarketplaceAdapter, config: ProbeConfig) -> _WriteProbeResult:
    message_type = MessageType.REVIEW.value if config.mode == "write-review" else MessageType.QUESTION.value
    external_id = config.review_id if config.mode == "write-review" else config.question_id
    if external_id is None or config.reply_text is None:
        raise ValueError("write configuration is incomplete")

    preflight = await adapter.has_existing_reply(
        config.credential,
        message_type,
        external_id,
        seller_id=config.business_id,
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

    send_result = (
        await adapter.send_review_reply(
            config.credential,
            external_id,
            config.reply_text,
            seller_id=config.business_id,
        )
        if config.mode == "write-review"
        else await adapter.send_question_reply(
            config.credential,
            external_id,
            config.reply_text,
            seller_id=config.business_id,
        )
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
    postflight = await adapter.has_existing_reply(
        config.credential,
        message_type,
        external_id,
        seller_id=config.business_id,
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


def _answered_value(result: AdapterResult) -> bool | None:
    payload: object | None = result.data
    if not isinstance(payload, dict):
        return None
    data = cast(dict[str, object], payload)
    answered = data.get("answered")
    return answered if isinstance(answered, bool) else None


async def run_probe(
    adapter: MarketplaceAdapter,
    config: ProbeConfig,
    *,
    git_sha: str | None = None,
    app_version: str | None = None,
) -> RuntimeProbeReport:
    started_at = datetime.now(UTC)
    config.validate()
    resolved_git_sha = validate_git_sha(git_sha or os.environ.get("MPREPLY_GIT_SHA", ""))
    resolved_app_version = app_version or Settings().app_version
    steps: list[ProbeStep] = []
    scopes: list[str] = []
    status: FinalStatus = "PASS"
    write_attempted = False
    write_confirmed: bool | None = None

    validation = await adapter.validate_credentials(config.credential, seller_id=config.business_id)
    scopes = safe_scopes(validation)
    if not validation.ok:
        status = classify_result(validation, write_started=False)
        steps.append(_failure_step("validate_credentials", validation, write_started=False))
    else:
        steps.append(ProbeStep(name="validate_credentials", status="PASS"))

    if status == "PASS":
        reviews = await _probe_stream(
            adapter=adapter,
            credential=config.credential,
            business_id=config.business_id,
            stream="reviews",
            max_pages=config.max_pages,
        )
        steps.append(reviews.step)
        if not reviews.ok:
            status = reviews.step.status

    if status == "PASS":
        questions = await _probe_stream(
            adapter=adapter,
            credential=config.credential,
            business_id=config.business_id,
            stream="questions",
            max_pages=config.max_pages,
        )
        steps.append(questions.step)
        if not questions.ok:
            status = questions.step.status

    if status == "PASS" and config.mode != "read-only":
        write_result = await _probe_write(adapter=adapter, config=config)
        steps.extend(write_result.steps)
        status = write_result.status
        write_attempted = write_result.attempted
        write_confirmed = write_result.confirmed

    write_target = config.review_id if config.mode == "write-review" else config.question_id
    return build_report(
        provider="yandex_market",
        mode=config.mode,
        status=status,
        started_at=started_at,
        finished_at=datetime.now(UTC),
        git_sha=resolved_git_sha,
        app_version=resolved_app_version,
        credential=config.credential,
        account_id=config.business_id,
        page_budget=config.max_pages,
        pages_checked=sum(step.pages_checked or 0 for step in steps),
        scopes=scopes,
        steps=steps,
        write_target=write_target,
        write_attempted=write_attempted,
        write_confirmed=write_confirmed,
    )


def _parse_mode(value: str) -> ProbeMode:
    if value not in {"read-only", "write-review", "write-question"}:
        raise argparse.ArgumentTypeError("mode must be read-only, write-review, or write-question")
    return cast(ProbeMode, value)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safely verify the Yandex Market runtime contract")
    parser.add_argument("--mode", type=_parse_mode, default="read-only")
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--output", type=Path, default=_DEFAULT_OUTPUT)
    parser.add_argument("--confirmation", default=None)
    return parser


def _config_from_environment(*, mode: ProbeMode, max_pages: int, confirmation: str | None) -> ProbeConfig:
    return ProbeConfig(
        credential=os.environ.get("YANDEX_MARKET_API_KEY", ""),
        business_id=os.environ.get("YANDEX_MARKET_BUSINESS_ID", ""),
        mode=mode,
        max_pages=max_pages,
        review_id=os.environ.get("YANDEX_MARKET_REVIEW_ID"),
        question_id=os.environ.get("YANDEX_MARKET_QUESTION_ID"),
        reply_text=os.environ.get("YANDEX_MARKET_REPLY_TEXT"),
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

    config = _config_from_environment(mode=mode, max_pages=max_pages, confirmation=confirmation)
    try:
        report = await run_probe(YandexMarketAdapter(timeout_seconds=15.0), config)
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return exit_code("BLOCKED")

    forbidden_values = (
        config.credential,
        config.business_id,
        config.review_id or "",
        config.question_id or "",
        config.reply_text or "",
    )
    write_runtime_probe_report(output, report, forbidden_values=forbidden_values)
    print(f"Yandex Market runtime probe: {report.status}")
    print(f"Evidence: {output}")
    return exit_code(report.status)


def main() -> None:
    raise SystemExit(asyncio.run(_async_main()))


if __name__ == "__main__":
    main()
