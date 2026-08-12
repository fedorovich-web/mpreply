from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import pytest

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.tools.yandex_market_runtime_probe import ProbeConfig, run_probe, write_runtime_probe_report


class FakeRuntimeAdapter(MarketplaceAdapter):
    marketplace = "yandex_market"

    def __init__(
        self,
        *,
        review_pages: list[AdapterResult] | None = None,
        question_pages: list[AdapterResult] | None = None,
        preflight_results: list[AdapterResult] | None = None,
        send_result: AdapterResult | None = None,
    ) -> None:
        self.review_pages = list(review_pages or [AdapterResult(ok=True, data={"result": {"feedbacks": []}})])
        self.question_pages = list(question_pages or [AdapterResult(ok=True, data={"result": {"questions": []}})])
        self.preflight_results = list(preflight_results or [AdapterResult(ok=True, data={"answered": False})])
        self.send_result = send_result or AdapterResult(ok=True, data={"accepted": True})
        self.review_calls: list[str | None] = []
        self.question_calls: list[str | None] = []
        self.sent: list[tuple[str, str, str]] = []

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        assert credential
        assert seller_id
        return AdapterResult(ok=True, data={"scopes": ["COMMUNICATION"], "business_id": int(seller_id)})

    async def fetch_reviews(
        self,
        credential: str,
        cursor: str | None = None,
        seller_id: str | None = None,
    ) -> AdapterResult:
        assert credential and seller_id
        self.review_calls.append(cursor)
        return self.review_pages.pop(0)

    async def fetch_questions(
        self,
        credential: str,
        cursor: str | None = None,
        seller_id: str | None = None,
    ) -> AdapterResult:
        assert credential and seller_id
        self.question_calls.append(cursor)
        return self.question_pages.pop(0)

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return self._items(payload, "feedbacks")

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return self._items(payload, "questions")

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        return {
            "external_id": str(raw.get("id") or ""),
            "customer_text": str(raw.get("text") or ""),
            "product": {},
        }

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        return {
            "external_id": str(raw.get("id") or ""),
            "customer_text": str(raw.get("text") or ""),
            "product": {},
        }

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        assert credential and seller_id
        self.sent.append(("review", external_id, reply_text))
        return self.send_result

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        assert credential and seller_id
        self.sent.append(("question", external_id, reply_text))
        return self.send_result

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        assert credential and message_type and external_id and seller_id
        return self.preflight_results.pop(0)

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        del status_code, payload
        return AdapterResult(ok=False, error_code="marketplace_error")

    @staticmethod
    def _items(payload: object | None, key: str) -> list[dict[str, object]]:
        if not isinstance(payload, dict):
            return []
        result = cast(dict[str, object], payload).get("result")
        if not isinstance(result, dict):
            return []
        value = cast(dict[str, object], result).get(key)
        if not isinstance(value, list):
            return []
        return [cast(dict[str, object], item) for item in cast(list[object], value) if isinstance(item, dict)]


def page(key: str, items: list[dict[str, object]], next_cursor: str | None = None) -> AdapterResult:
    return AdapterResult(ok=True, data={"result": {key: items}}, next_cursor=next_cursor)


@pytest.mark.asyncio
async def test_read_only_probe_checks_bounded_pagination_and_never_serializes_secrets(tmp_path: Path) -> None:
    adapter = FakeRuntimeAdapter(
        review_pages=[
            page("feedbacks", [{"id": 1, "text": "review"}], "secret-review-cursor"),
            page("feedbacks", [{"id": 2, "text": "review-2"}]),
        ],
        question_pages=[page("questions", [{"id": 3, "text": "question"}])],
    )
    config = ProbeConfig(credential="very-secret-api-key", business_id="123456", max_pages=2)

    report = await run_probe(adapter, config)
    output = tmp_path / "runtime.json"
    write_runtime_probe_report(output, report)
    serialized = output.read_text(encoding="utf-8")

    assert report.overall_status == "pass"
    assert report.business_id_masked == "masked:6digits"
    assert report.credential_fingerprint.startswith("sha256:")
    assert adapter.review_calls == [None, "secret-review-cursor"]
    assert adapter.question_calls == [None]
    assert "very-secret-api-key" not in serialized
    assert "secret-review-cursor" not in serialized
    assert "123456" not in serialized
    parsed_raw: object = json.loads(serialized)
    assert isinstance(parsed_raw, dict)
    parsed = cast(dict[str, object], parsed_raw)
    assert parsed["scopes"] == ["COMMUNICATION"]
    steps_raw = parsed["steps"]
    assert isinstance(steps_raw, list)
    steps = cast(list[object], steps_raw)
    second_step_raw = steps[1]
    assert isinstance(second_step_raw, dict)
    second_step = cast(dict[str, object], second_step_raw)
    assert second_step["pages_checked"] == 2
    assert second_step["items_seen"] == 2


@pytest.mark.asyncio
async def test_probe_fails_closed_on_cursor_cycle() -> None:
    adapter = FakeRuntimeAdapter(
        review_pages=[
            page("feedbacks", [], "same-cursor"),
            page("feedbacks", [], "same-cursor"),
        ]
    )

    report = await run_probe(
        adapter,
        ProbeConfig(credential="key", business_id="123", max_pages=3),
    )

    assert report.overall_status == "fail"
    review_step = next(step for step in report.steps if step.name == "fetch_reviews")
    assert review_step.error_code == "cursor_cycle"


def test_write_mode_requires_explicit_confirmation_and_target() -> None:
    invalid = ProbeConfig(
        credential="key",
        business_id="123",
        mode="write-review",
        review_id="55",
        reply_text="runtime probe",
        confirmation="wrong",
    )

    with pytest.raises(ValueError, match="confirmation"):
        invalid.validate()


@pytest.mark.asyncio
async def test_write_probe_skips_when_reply_already_exists() -> None:
    adapter = FakeRuntimeAdapter(preflight_results=[AdapterResult(ok=True, data={"answered": True})])
    config = ProbeConfig(
        credential="key",
        business_id="123",
        mode="write-question",
        question_id="77",
        reply_text="runtime probe",
        confirmation="I_UNDERSTAND_YANDEX_MARKET_WRITE",
    )

    report = await run_probe(adapter, config)

    assert report.overall_status == "pass"
    assert report.write_probe_performed is True
    assert report.write_probe_visible_after_send is True
    assert adapter.sent == []
    assert report.steps[-1].status == "skipped"


@pytest.mark.asyncio
async def test_write_probe_accepts_pending_moderation_without_duplicate_send() -> None:
    adapter = FakeRuntimeAdapter(
        preflight_results=[
            AdapterResult(ok=True, data={"answered": False}),
            AdapterResult(ok=True, data={"answered": False}),
        ]
    )
    config = ProbeConfig(
        credential="key",
        business_id="123",
        mode="write-review",
        review_id="88",
        reply_text="runtime probe",
        confirmation="I_UNDERSTAND_YANDEX_MARKET_WRITE",
    )

    report = await run_probe(adapter, config)

    assert report.overall_status == "pending"
    assert report.write_probe_visible_after_send is False
    assert adapter.sent == [("review", "88", "runtime probe")]
    assert report.steps[-1].status == "pending"


@pytest.mark.asyncio
async def test_write_probe_is_not_attempted_when_read_contract_fails() -> None:
    adapter = FakeRuntimeAdapter(
        review_pages=[
            AdapterResult(
                ok=False,
                error_code="rate_limited",
                error_message_safe="Yandex Market resource limit exceeded",
            )
        ]
    )
    config = ProbeConfig(
        credential="key",
        business_id="123",
        mode="write-review",
        review_id="88",
        reply_text="runtime probe",
        confirmation="I_UNDERSTAND_YANDEX_MARKET_WRITE",
    )

    report = await run_probe(adapter, config)

    assert report.overall_status == "fail"
    assert adapter.sent == []
    assert all(not step.name.startswith("write_") for step in report.steps)
