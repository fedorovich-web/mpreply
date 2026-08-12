from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import httpx
import pytest

from app.adapters.ozon import QUESTION_METHODS, REVIEW_METHODS, OzonAdapter
from app.tools.ozon_runtime_probe import OzonProbeConfig, run_probe, write_runtime_probe_report

_GIT_SHA = "c" * 40


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


def _roles_response(methods: Sequence[str]) -> httpx.Response:
    return httpx.Response(
        200,
        json={"expires_at": "2026-12-01T00:00:00Z", "roles": [{"methods": list(methods)}]},
    )


def _review_page() -> httpx.Response:
    return httpx.Response(200, json={"reviews": [], "has_next": False, "last_id": ""})


def _question_page() -> httpx.Response:
    return httpx.Response(200, json={"questions": [], "has_next": False, "last_id": ""})


def _review_config(
    *,
    confirmation: str = "I_UNDERSTAND_OZON_WRITE",
    review_id: str = "review-77",
    reply_text: str = "Synthetic reply",
) -> OzonProbeConfig:
    return OzonProbeConfig(
        api_key="synthetic-api-key",
        client_id="client-123",
        mode="write-review",
        max_pages=1,
        review_id=review_id,
        reply_text=reply_text,
        confirmation=confirmation,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("methods", "expected_paths"),
    [
        (sorted(REVIEW_METHODS), {"/v1/roles", "/v2/review/list"}),
        (sorted(QUESTION_METHODS), {"/v1/roles", "/v1/question/list"}),
        (
            sorted(REVIEW_METHODS | QUESTION_METHODS),
            {"/v1/roles", "/v2/review/list", "/v1/question/list"},
        ),
    ],
)
async def test_read_only_calls_only_complete_authorized_streams(
    methods: list[str], expected_paths: set[str]
) -> None:
    responses = [_roles_response(methods)]
    if REVIEW_METHODS.issubset(methods):
        responses.append(_review_page())
    if QUESTION_METHODS.issubset(methods):
        responses.append(_question_page())
    recorder = RequestRecorder(responses)
    config = OzonProbeConfig(
        api_key="synthetic-api-key",
        client_id="client-123",
        mode="read-only",
        max_pages=1,
    )

    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "PASS"
    assert report.pages_checked == len(expected_paths) - 1
    assert {request.url.path for request in recorder.requests} == expected_paths


@pytest.mark.asyncio
async def test_review_write_preflights_mutates_once_and_reconciles() -> None:
    recorder = RequestRecorder(
        [
            _roles_response(sorted(REVIEW_METHODS)),
            _review_page(),
            httpx.Response(200, json={"comments": []}),
            httpx.Response(200, json={"comment_id": "comment-77"}),
            httpx.Response(
                200,
                json={"comments": [{"is_owner": True, "is_published": True, "is_rejected": False}]},
            ),
        ]
    )

    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.url.path == "/v1/review/comment/create"]
    assert report.status == "PASS"
    assert report.write_attempted is True
    assert report.write_confirmed is True
    assert len(mutations) == 1


@pytest.mark.asyncio
async def test_question_write_uses_sku_for_preflight_and_single_mutation() -> None:
    recorder = RequestRecorder(
        [
            _roles_response(sorted(QUESTION_METHODS)),
            _question_page(),
            httpx.Response(200, json={"answers": [], "last_id": ""}),
            httpx.Response(200, json={"answer_id": "answer-77"}),
            httpx.Response(200, json={"answers": [{"id": "answer-77"}], "last_id": ""}),
        ]
    )
    config = OzonProbeConfig(
        api_key="synthetic-api-key",
        client_id="client-123",
        mode="write-question",
        max_pages=1,
        question_id="question-77",
        question_sku=123456,
        reply_text="Synthetic reply",
        confirmation="I_UNDERSTAND_OZON_WRITE",
    )

    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    write_paths = [request.url.path for request in recorder.requests]
    assert report.status == "PASS"
    assert write_paths.count("/v1/question/answer/create") == 1
    for request in recorder.requests:
        if request.url.path in {"/v1/question/answer/list", "/v1/question/answer/create"}:
            assert '"sku":123456' in request.content.decode()


@pytest.mark.parametrize("question_sku", [None, 0, -1])
def test_question_write_rejects_missing_or_non_positive_sku_before_http(
    question_sku: int | None,
) -> None:
    config = OzonProbeConfig(
        api_key="synthetic-api-key",
        client_id="client-123",
        mode="write-question",
        question_id="question-77",
        question_sku=question_sku,
        reply_text="Synthetic reply",
        confirmation="I_UNDERSTAND_OZON_WRITE",
    )

    with pytest.raises(ValueError, match="SKU"):
        config.validate()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "send_response",
    [
        httpx.Response(429, json={"error": "synthetic"}),
        httpx.Response(500, json={"error": "synthetic"}),
        httpx.Response(503, json={"error": "synthetic"}),
        httpx.Response(200, json={}),
        httpx.ReadTimeout("synthetic timeout"),
    ],
)
async def test_post_send_uncertainty_is_ambiguous_without_retry(
    send_response: httpx.Response | Exception,
) -> None:
    recorder = RequestRecorder(
        [
            _roles_response(sorted(REVIEW_METHODS)),
            _review_page(),
            httpx.Response(200, json={"comments": []}),
            send_response,
        ]
    )

    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.url.path == "/v1/review/comment/create"]
    assert report.status == "AMBIGUOUS"
    assert report.write_attempted is True
    assert report.write_confirmed is None
    assert len(mutations) == 1


@pytest.mark.asyncio
async def test_failed_postflight_after_mutation_is_ambiguous() -> None:
    recorder = RequestRecorder(
        [
            _roles_response(sorted(REVIEW_METHODS)),
            _review_page(),
            httpx.Response(200, json={"comments": []}),
            httpx.Response(200, json={"comment_id": "comment-77"}),
            httpx.Response(503, json={"error": "synthetic"}),
        ]
    )

    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "AMBIGUOUS"
    assert sum(request.url.path == "/v1/review/comment/create" for request in recorder.requests) == 1


@pytest.mark.asyncio
async def test_existing_reply_blocks_write() -> None:
    recorder = RequestRecorder(
        [
            _roles_response(sorted(REVIEW_METHODS)),
            _review_page(),
            httpx.Response(
                200,
                json={"comments": [{"is_owner": True, "is_published": True, "is_rejected": False}]},
            ),
        ]
    )

    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        _review_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "BLOCKED"
    assert report.write_attempted is False
    assert all(request.url.path != "/v1/review/comment/create" for request in recorder.requests)


@pytest.mark.parametrize("max_pages", [0, 6])
def test_page_budget_rejects_values_outside_safe_bounds(max_pages: int) -> None:
    config = OzonProbeConfig(api_key="synthetic-api-key", client_id="client-123", max_pages=max_pages)

    with pytest.raises(ValueError, match="max_pages"):
        config.validate()


def test_write_requires_exact_confirmation() -> None:
    config = _review_config(confirmation="wrong")

    with pytest.raises(ValueError, match="confirmation"):
        config.validate()


@pytest.mark.asyncio
async def test_write_evidence_excludes_credentials_identifiers_and_reply(tmp_path: Path) -> None:
    recorder = RequestRecorder(
        [
            _roles_response(sorted(REVIEW_METHODS)),
            _review_page(),
            httpx.Response(200, json={"comments": []}),
            httpx.Response(200, json={"comment_id": "comment-77"}),
            httpx.Response(
                200,
                json={"comments": [{"is_owner": True, "is_published": True, "is_rejected": False}]},
            ),
        ]
    )
    config = _review_config(review_id="review-987654", reply_text="Sensitive synthetic reply")
    report = await run_probe(
        OzonAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )
    output = tmp_path / "ozon.json"

    write_runtime_probe_report(
        output,
        report,
        forbidden_values=(config.api_key, config.client_id, config.review_id or "", config.reply_text or ""),
    )
    serialized = output.read_text(encoding="utf-8")

    assert config.api_key not in serialized
    assert config.client_id not in serialized
    assert (config.review_id or "missing") not in serialized
    assert (config.reply_text or "missing") not in serialized
