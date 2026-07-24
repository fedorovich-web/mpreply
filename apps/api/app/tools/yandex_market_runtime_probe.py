from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, cast

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.enums import MessageType

ProbeMode = Literal["read-only", "write-review", "write-question"]
ProbeStatus = Literal["pass", "fail", "skipped", "pending"]

_WRITE_CONFIRMATION = "I_UNDERSTAND_YANDEX_MARKET_WRITE"
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


@dataclass(frozen=True)
class ProbeStep:
    name: str
    status: ProbeStatus
    error_code: str | None = None
    message: str | None = None
    pages_checked: int | None = None
    items_seen: int | None = None
    has_more: bool | None = None
    normalized_sample: bool | None = None


@dataclass(frozen=True)
class RuntimeProbeReport:
    schema_version: int
    generated_at: str
    marketplace: str
    mode: ProbeMode
    overall_status: ProbeStatus
    business_id_masked: str
    credential_fingerprint: str
    scopes: list[str]
    steps: list[ProbeStep]
    write_probe_performed: bool
    write_probe_visible_after_send: bool | None

    def to_json_dict(self) -> dict[str, object]:
        payload = asdict(self)
        return cast(dict[str, object], payload)


@dataclass(frozen=True)
class _StreamProbeResult:
    step: ProbeStep
    raw_ok: bool


def _is_positive_integer(value: str | None) -> bool:
    return bool(value and value.strip().isdecimal() and int(value) > 0)


def _mask_business_id(value: str) -> str:
    normalized = value.strip()
    return f"masked:{len(normalized)}digits"


def _credential_fingerprint(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"sha256:{digest[:12]}"


def _safe_scopes(result: AdapterResult) -> list[str]:
    payload = result.data
    if not isinstance(payload, dict):
        return []
    data = cast(dict[str, object], payload)
    raw_scopes = data.get("scopes")
    if not isinstance(raw_scopes, list):
        return []
    scopes = cast(list[object], raw_scopes)
    return sorted({str(scope).strip().upper() for scope in scopes if str(scope).strip()})


def _result_failure_step(name: str, result: AdapterResult) -> ProbeStep:
    return ProbeStep(
        name=name,
        status="fail",
        error_code=result.error_code or "marketplace_error",
        message=result.error_message_safe or "Marketplace request failed",
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
    normalized_sample = False
    has_more = False

    while pages_checked < max_pages:
        result = (
            await adapter.fetch_reviews(credential, cursor=cursor, seller_id=business_id)
            if stream == "reviews"
            else await adapter.fetch_questions(credential, cursor=cursor, seller_id=business_id)
        )
        if not result.ok:
            return _StreamProbeResult(_result_failure_step(f"fetch_{stream}", result), False)

        items = adapter.extract_reviews(result.data) if stream == "reviews" else adapter.extract_questions(result.data)
        pages_checked += 1
        items_seen += len(items)
        if not normalized_sample and items:
            normalized_sample = _normalized_sample_is_valid(adapter, stream, items[0])

        next_cursor = result.next_cursor
        if not next_cursor:
            has_more = False
            break
        if next_cursor == cursor or next_cursor in seen_cursors:
            return _StreamProbeResult(
                ProbeStep(
                    name=f"fetch_{stream}",
                    status="fail",
                    error_code="cursor_cycle",
                    message="Provider pagination returned a repeated cursor",
                    pages_checked=pages_checked,
                    items_seen=items_seen,
                    has_more=True,
                    normalized_sample=normalized_sample,
                ),
                False,
            )
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        has_more = True

    return _StreamProbeResult(
        ProbeStep(
            name=f"fetch_{stream}",
            status="pass",
            pages_checked=pages_checked,
            items_seen=items_seen,
            has_more=has_more,
            normalized_sample=normalized_sample if items_seen else None,
        ),
        True,
    )


async def _probe_write(
    *,
    adapter: MarketplaceAdapter,
    config: ProbeConfig,
) -> tuple[list[ProbeStep], bool | None]:
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
        return [_result_failure_step("write_preflight", preflight)], None

    answered_before = _answered_value(preflight)
    if answered_before:
        return [ProbeStep(name="write_preflight", status="skipped", message="A seller reply already exists")], True

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
        return [_result_failure_step("write_send", send_result)], False

    postflight = await adapter.has_existing_reply(
        config.credential,
        message_type,
        external_id,
        seller_id=config.business_id,
    )
    if not postflight.ok:
        return [
            ProbeStep(name="write_send", status="pass", message="Provider accepted the write request"),
            _result_failure_step("write_postflight", postflight),
        ], None

    visible = _answered_value(postflight)
    return [
        ProbeStep(name="write_send", status="pass", message="Provider accepted the write request"),
        ProbeStep(
            name="write_postflight",
            status="pass" if visible else "pending",
            message=(
                "The seller reply is visible through the provider read API"
                if visible
                else "The write was accepted but is not visible yet; moderation or propagation may still be pending"
            ),
        ),
    ], visible


def _answered_value(result: AdapterResult) -> bool:
    payload = result.data
    if not isinstance(payload, dict):
        return False
    data = cast(dict[str, object], payload)
    return data.get("answered") is True


async def run_probe(adapter: MarketplaceAdapter, config: ProbeConfig) -> RuntimeProbeReport:
    config.validate()
    steps: list[ProbeStep] = []

    validation = await adapter.validate_credentials(config.credential, seller_id=config.business_id)
    scopes = _safe_scopes(validation)
    if not validation.ok:
        steps.append(_result_failure_step("validate_credentials", validation))
        return _build_report(config=config, scopes=scopes, steps=steps, write_visible=None)

    steps.append(ProbeStep(name="validate_credentials", status="pass"))

    reviews = await _probe_stream(
        adapter=adapter,
        credential=config.credential,
        business_id=config.business_id,
        stream="reviews",
        max_pages=config.max_pages,
    )
    steps.append(reviews.step)

    questions = await _probe_stream(
        adapter=adapter,
        credential=config.credential,
        business_id=config.business_id,
        stream="questions",
        max_pages=config.max_pages,
    )
    steps.append(questions.step)

    write_visible: bool | None = None
    if reviews.raw_ok and questions.raw_ok and config.mode != "read-only":
        write_steps, write_visible = await _probe_write(adapter=adapter, config=config)
        steps.extend(write_steps)

    return _build_report(config=config, scopes=scopes, steps=steps, write_visible=write_visible)


def _build_report(
    *,
    config: ProbeConfig,
    scopes: list[str],
    steps: list[ProbeStep],
    write_visible: bool | None,
) -> RuntimeProbeReport:
    statuses = {step.status for step in steps}
    overall_status: ProbeStatus
    if "fail" in statuses:
        overall_status = "fail"
    elif "pending" in statuses:
        overall_status = "pending"
    elif statuses == {"skipped"}:
        overall_status = "skipped"
    else:
        overall_status = "pass"

    return RuntimeProbeReport(
        schema_version=1,
        generated_at=datetime.now(UTC).isoformat(),
        marketplace="yandex_market",
        mode=config.mode,
        overall_status=overall_status,
        business_id_masked=_mask_business_id(config.business_id),
        credential_fingerprint=_credential_fingerprint(config.credential),
        scopes=scopes,
        steps=steps,
        write_probe_performed=config.mode != "read-only",
        write_probe_visible_after_send=write_visible,
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


def write_runtime_probe_report(path: Path, report: RuntimeProbeReport) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(
        json.dumps(report.to_json_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _safe_error_report(*, mode: ProbeMode, message: str) -> dict[str, object]:
    return {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "marketplace": "yandex_market",
        "mode": mode,
        "overall_status": "fail",
        "error": message,
    }


async def _async_main() -> int:
    parser = _build_parser()
    namespace = parser.parse_args()
    mode = cast(ProbeMode, namespace.mode)
    max_pages = cast(int, namespace.max_pages)
    output = cast(Path, namespace.output)
    confirmation = cast(str | None, namespace.confirmation)

    config = _config_from_environment(mode=mode, max_pages=max_pages, confirmation=confirmation)
    try:
        config.validate()
        report = await run_probe(YandexMarketAdapter(timeout_seconds=15.0), config)
    except ValueError as exc:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(_safe_error_report(mode=mode, message=str(exc)), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 5

    write_runtime_probe_report(output, report)
    print(f"Yandex Market runtime probe: {report.overall_status}")
    print(f"Evidence: {output}")
    return 0 if report.overall_status in {"pass", "pending", "skipped"} else 2


def main() -> None:
    raise SystemExit(asyncio.run(_async_main()))


if __name__ == "__main__":
    main()
