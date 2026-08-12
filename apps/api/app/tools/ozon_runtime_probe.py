from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, cast

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.adapters.ozon import OzonAdapter
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

_WRITE_CONFIRMATION = "I_UNDERSTAND_OZON_WRITE"
_DEFAULT_OUTPUT = Path(".handoff/ozon-runtime-verification.json")
_MAX_ALLOWED_PAGES = 5


@dataclass(frozen=True)
class OzonProbeConfig:
    api_key: str
    client_id: str
    mode: ProbeMode = "read-only"
    max_pages: int = 2
    review_id: str | None = None
    question_id: str | None = None
    question_sku: int | None = None
    reply_text: str | None = None
    confirmation: str | None = None

    def validate(self) -> None:
        if not self.api_key.strip():
            raise ValueError("OZON_API_KEY is required")
        if not self.client_id.strip():
            raise ValueError("OZON_CLIENT_ID is required")
        if self.max_pages < 1 or self.max_pages > _MAX_ALLOWED_PAGES:
            raise ValueError(f"max_pages must be between 1 and {_MAX_ALLOWED_PAGES}")
        if self.mode == "read-only":
            return
        if self.confirmation != _WRITE_CONFIRMATION:
            raise ValueError("write mode requires the exact confirmation phrase")
        if not (self.reply_text or "").strip():
            raise ValueError("write mode requires OZON_REPLY_TEXT")
        if self.mode == "write-review" and not (self.review_id or "").strip():
            raise ValueError("write-review mode requires OZON_REVIEW_ID")
        if self.mode == "write-question":
            if not (self.question_id or "").strip():
                raise ValueError("write-question mode requires OZON_QUESTION_ID")
            if type(self.question_sku) is not int or self.question_sku <= 0:
                raise ValueError("write-question mode requires a positive OZON_QUESTION_SKU")


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


def _failure_step(name: str, result: AdapterResult, *, write_started: bool) -> ProbeStep:
    return ProbeStep(
        name=name,
        status=classify_result(result, write_started=write_started),
        error_code=result.error_code or "marketplace_error",
        retry_after_seconds=result.retry_after_seconds,
    )


def _normalized_sample_is_valid(adapter: MarketplaceAdapter, stream: str, item: dict[str, object]) -> bool:
    normalized = adapter.normalize_review(item) if stream == "reviews" else adapter.normalize_question(item)
    return (
        bool(str(normalized.get("external_id") or "").strip())
        and isinstance(normalized.get("customer_text"), str)
        and isinstance(normalized.get("product"), dict)
    )


async def _probe_stream(
    *,
    adapter: MarketplaceAdapter,
    config: OzonProbeConfig,
    stream: Literal["reviews", "questions"],
) -> _StreamProbeResult:
    cursor: str | None = None
    seen_cursors: set[str] = set()
    pages_checked = 0
    items_seen = 0
    while pages_checked < config.max_pages:
        result = (
            await adapter.fetch_reviews(config.api_key, cursor=cursor, seller_id=config.client_id)
            if stream == "reviews"
            else await adapter.fetch_questions(config.api_key, cursor=cursor, seller_id=config.client_id)
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


def _answered_value(result: AdapterResult) -> bool | None:
    payload = result.data
    if not isinstance(payload, dict):
        return None
    value = cast(dict[str, object], payload).get("answered")
    return value if isinstance(value, bool) else None


async def _probe_write(*, adapter: MarketplaceAdapter, config: OzonProbeConfig) -> _WriteProbeResult:
    is_review = config.mode == "write-review"
    external_id = config.review_id if is_review else config.question_id
    if external_id is None or config.reply_text is None:
        raise ValueError("write configuration is incomplete")
    context: ProviderMessageContext | None = None
    if not is_review:
        if config.question_sku is None:
            raise ValueError("write-question configuration is incomplete")
        context = {"ozon_sku": config.question_sku}
    message_type = MessageType.REVIEW.value if is_review else MessageType.QUESTION.value
    preflight = await adapter.has_existing_reply(
        config.api_key,
        message_type,
        external_id,
        seller_id=config.client_id,
        context=context,
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
            config.api_key,
            external_id,
            config.reply_text,
            seller_id=config.client_id,
        )
        if is_review
        else await adapter.send_question_reply(
            config.api_key,
            external_id,
            config.reply_text,
            seller_id=config.client_id,
            context=context,
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
        config.api_key,
        message_type,
        external_id,
        seller_id=config.client_id,
        context=context,
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


def _report(
    *,
    config: OzonProbeConfig,
    status: FinalStatus,
    started_at: datetime,
    git_sha: str,
    app_version: str,
    scopes: list[str],
    steps: list[ProbeStep],
    write_attempted: bool = False,
    write_confirmed: bool | None = None,
) -> RuntimeProbeReport:
    target = config.review_id if config.mode == "write-review" else config.question_id
    return build_report(
        provider="ozon",
        mode=config.mode,
        status=status,
        started_at=started_at,
        finished_at=datetime.now(UTC),
        git_sha=git_sha,
        app_version=app_version,
        credential=config.api_key,
        account_id=config.client_id,
        page_budget=config.max_pages,
        pages_checked=sum(step.pages_checked or 0 for step in steps),
        scopes=scopes,
        steps=steps,
        write_target=target,
        write_attempted=write_attempted,
        write_confirmed=write_confirmed,
    )


async def run_probe(
    adapter: MarketplaceAdapter,
    config: OzonProbeConfig,
    *,
    git_sha: str | None = None,
    app_version: str | None = None,
) -> RuntimeProbeReport:
    started_at = datetime.now(UTC)
    config.validate()
    resolved_git_sha = validate_git_sha(git_sha or os.environ.get("MPREPLY_GIT_SHA", ""))
    resolved_app_version = app_version or Settings().app_version
    validation = await adapter.validate_credentials(config.api_key, seller_id=config.client_id)
    scopes = safe_scopes(validation)
    if not validation.ok:
        step = _failure_step("validate_credentials", validation, write_started=False)
        return _report(
            config=config,
            status=step.status,
            started_at=started_at,
            git_sha=resolved_git_sha,
            app_version=resolved_app_version,
            scopes=scopes,
            steps=[step],
        )
    read_reviews = "fetch_reviews" in scopes
    read_questions = "fetch_questions" in scopes
    if not (read_reviews or read_questions):
        return _report(
            config=config,
            status="BLOCKED",
            started_at=started_at,
            git_sha=resolved_git_sha,
            app_version=resolved_app_version,
            scopes=scopes,
            steps=[ProbeStep(name="validate_scopes", status="BLOCKED", error_code="insufficient_scope")],
        )
    required_scope = "send_review_reply" if config.mode == "write-review" else "send_question_reply"
    if config.mode != "read-only" and required_scope not in scopes:
        return _report(
            config=config,
            status="BLOCKED",
            started_at=started_at,
            git_sha=resolved_git_sha,
            app_version=resolved_app_version,
            scopes=scopes,
            steps=[ProbeStep(name="validate_scopes", status="BLOCKED", error_code="insufficient_scope")],
        )
    steps = [ProbeStep(name="validate_credentials", status="PASS")]
    status: FinalStatus = "PASS"
    if read_reviews:
        reviews = await _probe_stream(adapter=adapter, config=config, stream="reviews")
        steps.append(reviews.step)
        if not reviews.ok:
            status = reviews.step.status
    if status == "PASS" and read_questions:
        questions = await _probe_stream(adapter=adapter, config=config, stream="questions")
        steps.append(questions.step)
        if not questions.ok:
            status = questions.step.status
    write_attempted = False
    write_confirmed: bool | None = None
    if status == "PASS" and config.mode != "read-only":
        write_result = await _probe_write(adapter=adapter, config=config)
        status = write_result.status
        steps.extend(write_result.steps)
        write_attempted = write_result.attempted
        write_confirmed = write_result.confirmed
    return _report(
        config=config,
        status=status,
        started_at=started_at,
        git_sha=resolved_git_sha,
        app_version=resolved_app_version,
        scopes=scopes,
        steps=steps,
        write_attempted=write_attempted,
        write_confirmed=write_confirmed,
    )


def _parse_mode(value: str) -> ProbeMode:
    if value not in {"read-only", "write-review", "write-question"}:
        raise argparse.ArgumentTypeError("mode must be read-only, write-review, or write-question")
    return cast(ProbeMode, value)


def _parse_optional_positive_int(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError("OZON_QUESTION_SKU must be a positive integer") from exc
    return parsed


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safely verify the Ozon runtime contract")
    parser.add_argument("--mode", type=_parse_mode, default="read-only")
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--output", type=Path, default=_DEFAULT_OUTPUT)
    parser.add_argument("--confirmation", default=None)
    return parser


def _config_from_environment(*, mode: ProbeMode, max_pages: int, confirmation: str | None) -> OzonProbeConfig:
    return OzonProbeConfig(
        api_key=os.environ.get("OZON_API_KEY", ""),
        client_id=os.environ.get("OZON_CLIENT_ID", ""),
        mode=mode,
        max_pages=max_pages,
        review_id=os.environ.get("OZON_REVIEW_ID"),
        question_id=os.environ.get("OZON_QUESTION_ID"),
        question_sku=_parse_optional_positive_int(os.environ.get("OZON_QUESTION_SKU")),
        reply_text=os.environ.get("OZON_REPLY_TEXT"),
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
        report = await run_probe(OzonAdapter(timeout_seconds=15.0), config)
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return exit_code("BLOCKED")
    write_runtime_probe_report(
        output,
        report,
        forbidden_values=(
            config.api_key,
            config.client_id,
            config.review_id or "",
            config.question_id or "",
            str(config.question_sku or ""),
            config.reply_text or "",
        ),
    )
    print(f"Ozon runtime probe: {report.status}")
    print(f"Evidence: {output}")
    return exit_code(report.status)


def main() -> None:
    raise SystemExit(asyncio.run(_async_main()))


if __name__ == "__main__":
    main()
