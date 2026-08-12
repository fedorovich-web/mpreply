from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import httpx
import pytest

from app.adapters.wildberries import WildberriesAdapter
from app.tools.wildberries_runtime_probe import WildberriesProbeConfig, run_probe, write_runtime_probe_report

_GIT_SHA = "b" * 40


class RequestRecorder:
    def __init__(self, responses: Sequence[httpx.Response | Exception]) -> None:
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if not self._responses:
            raise AssertionError("unexpected HTTP request")
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def _read_responses() -> list[httpx.Response]:
    return [
        httpx.Response(200, json={"data": {}}),
        httpx.Response(200, json={"data": {"feedbacks": []}}),
        httpx.Response(200, json={"data": {"questions": []}}),
    ]


def _review_config(
    *,
    confirmation: str = "I_UNDERSTAND_WILDBERRIES_WRITE",
    review_id: str = "review-77",
    reply_text: str = "Synthetic reply",
) -> WildberriesProbeConfig:
    return WildberriesProbeConfig(
        credential="synthetic-wb-key",
        mode="write-review",
        max_pages=1,
        review_id=review_id,
        reply_text=reply_text,
        confirmation=confirmation,
    )


@pytest.mark.asyncio
async def test_read_only_is_bounded_and_never_mutates() -> None:
    recorder = RequestRecorder(_read_responses())
    config = WildberriesProbeConfig(credential="synthetic-wb-key", mode="read-only", max_pages=1)

    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "PASS"
    assert report.provider == "wildberries"
    assert report.pages_checked == 2
    assert {request.method for request in recorder.requests} == {"GET"}
    assert [request.url.path for request in recorder.requests] == [
        "/ping",
        "/api/v1/feedbacks",
        "/api/v1/questions",
    ]


@pytest.mark.asyncio
async def test_review_write_preflights_mutates_once_and_reconciles() -> None:
    recorder = RequestRecorder(
        [
            *_read_responses(),
            httpx.Response(200, json={"data": {"isAnswered": False}}),
            httpx.Response(204),
            httpx.Response(200, json={"data": {"isAnswered": True}}),
        ]
    )

    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.method in {"POST", "PATCH"}]
    assert report.status == "PASS"
    assert report.write_attempted is True
    assert report.write_confirmed is True
    assert len(mutations) == 1
    assert mutations[0].url.path == "/api/v1/feedbacks/answer"


@pytest.mark.asyncio
async def test_question_write_uses_patch_once() -> None:
    recorder = RequestRecorder(
        [
            *_read_responses(),
            httpx.Response(200, json={"data": {"answer": None}}),
            httpx.Response(200, json={"data": {}}),
            httpx.Response(200, json={"data": {"answer": {"text": "Synthetic reply"}}}),
        ]
    )
    config = WildberriesProbeConfig(
        credential="synthetic-wb-key",
        mode="write-question",
        max_pages=1,
        question_id="question-77",
        reply_text="Synthetic reply",
        confirmation="I_UNDERSTAND_WILDBERRIES_WRITE",
    )

    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.method in {"POST", "PATCH"}]
    assert report.status == "PASS"
    assert len(mutations) == 1
    assert mutations[0].method == "PATCH"
    assert mutations[0].url.path == "/api/v1/questions"


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [429, 500, 503])
async def test_post_send_http_failure_is_ambiguous_without_retry(status_code: int) -> None:
    recorder = RequestRecorder(
        [
            *_read_responses(),
            httpx.Response(200, json={"data": {"isAnswered": False}}),
            httpx.Response(status_code, json={"error": "synthetic"}),
        ]
    )

    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.method in {"POST", "PATCH"}]
    assert report.status == "AMBIGUOUS"
    assert report.write_attempted is True
    assert report.write_confirmed is None
    assert len(mutations) == 1


@pytest.mark.asyncio
async def test_post_send_timeout_is_ambiguous_without_retry() -> None:
    recorder = RequestRecorder(
        [
            *_read_responses(),
            httpx.Response(200, json={"data": {"isAnswered": False}}),
            httpx.ReadTimeout("synthetic timeout"),
        ]
    )

    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.method in {"POST", "PATCH"}]
    assert report.status == "AMBIGUOUS"
    assert len(mutations) == 1


@pytest.mark.asyncio
async def test_existing_reply_blocks_write() -> None:
    recorder = RequestRecorder(
        [
            *_read_responses(),
            httpx.Response(200, json={"data": {"isAnswered": True}}),
        ]
    )

    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "BLOCKED"
    assert report.write_attempted is False
    assert all(request.method == "GET" for request in recorder.requests)


@pytest.mark.parametrize("max_pages", [0, 6])
def test_page_budget_rejects_values_outside_safe_bounds(max_pages: int) -> None:
    config = WildberriesProbeConfig(credential="synthetic-wb-key", max_pages=max_pages)

    with pytest.raises(ValueError, match="max_pages"):
        config.validate()


def test_write_requires_exact_confirmation() -> None:
    config = _review_config(confirmation="wrong")

    with pytest.raises(ValueError, match="confirmation"):
        config.validate()


@pytest.mark.asyncio
async def test_write_evidence_excludes_key_target_and_reply(tmp_path: Path) -> None:
    recorder = RequestRecorder(
        [
            *_read_responses(),
            httpx.Response(200, json={"data": {"isAnswered": False}}),
            httpx.Response(204),
            httpx.Response(200, json={"data": {"isAnswered": True}}),
        ]
    )
    config = _review_config(review_id="review-987654", reply_text="Sensitive synthetic reply")
    report = await run_probe(
        WildberriesAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )
    output = tmp_path / "wildberries.json"

    write_runtime_probe_report(
        output,
        report,
        forbidden_values=(config.credential, config.review_id or "", config.reply_text or ""),
    )
    serialized = output.read_text(encoding="utf-8")

    assert config.credential not in serialized
    assert (config.review_id or "missing") not in serialized
    assert (config.reply_text or "missing") not in serialized
