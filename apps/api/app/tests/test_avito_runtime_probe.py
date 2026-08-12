from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import httpx
import pytest

from app.adapters.avito import AvitoAdapter
from app.tools.avito_runtime_probe import AvitoProbeConfig, run_probe, write_runtime_probe_report

_GIT_SHA = "d" * 40


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


def _chat(index: int = 1) -> dict[str, object]:
    return {
        "id": f"chat-{index}",
        "created": 1_700_000_000,
        "updated": 1_700_000_001,
        "users": [{"id": 123456}, {"id": 654321, "name": "Synthetic buyer"}],
    }


def _message(index: int, *, direction: str = "in", text: str = "Synthetic message") -> dict[str, object]:
    return {
        "id": f"message-{index}",
        "author_id": 654321 if direction == "in" else 123456,
        "created": 1_700_000_000 + index,
        "direction": direction,
        "is_read": False,
        "read": None,
        "type": "text",
        "content": {"text": text},
    }


def _send_config(
    *,
    confirmation: str = "I_UNDERSTAND_AVITO_CHAT_WRITE",
    chat_id: str = "chat-77",
    message_text: str = "Synthetic reply",
    inbound_created_unix: int | None = 1_700_000_000,
) -> AvitoProbeConfig:
    return AvitoProbeConfig(
        access_token="synthetic-token",
        user_id="123456",
        mode="write-chat-message",
        max_pages=1,
        chat_id=chat_id,
        inbound_created_unix=inbound_created_unix,
        message_text=message_text,
        confirmation=confirmation,
    )


@pytest.mark.asyncio
async def test_read_only_never_posts_or_marks_read() -> None:
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
        ]
    )
    config = AvitoProbeConfig(
        access_token="synthetic-token", user_id="123456", mode="read-only", max_pages=1
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "PASS"
    assert recorder.requests and {request.method for request in recorder.requests} == {"GET"}
    assert not any(request.url.path.endswith("/read") for request in recorder.requests)


@pytest.mark.asyncio
async def test_read_only_bounds_chat_and_message_offsets() -> None:
    first_message_page = [_message(index) for index in range(100)]
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": [_chat()]}),
            httpx.Response(200, json=first_message_page),
            httpx.Response(200, json=[]),
        ]
    )
    config = AvitoProbeConfig(
        access_token="synthetic-token", user_id="123456", mode="read-only", max_pages=2
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    message_offsets = [request.url.params["offset"] for request in recorder.requests if "/messages/" in request.url.path]
    assert report.status == "PASS"
    assert message_offsets == ["0", "100"]
    assert all(int(offset) <= 100 for offset in message_offsets)


@pytest.mark.asyncio
async def test_chat_send_preflights_mutates_once_then_reconciles() -> None:
    outbound = _message(1, direction="out", text="Synthetic reply")
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json=[]),
            httpx.Response(200, json=outbound),
            httpx.Response(200, json=[outbound]),
        ]
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        _send_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [
        request
        for request in recorder.requests
        if request.method == "POST" and request.url.path.endswith("/messages")
    ]
    assert report.status == "PASS"
    assert report.write_attempted is True
    assert report.write_confirmed is True
    assert len(mutations) == 1


def test_mark_read_requires_distinct_confirmation() -> None:
    config = AvitoProbeConfig(
        access_token="synthetic-token",
        user_id="123456",
        mode="write-mark-read",
        max_pages=1,
        chat_id="chat-77",
        confirmation="I_UNDERSTAND_AVITO_CHAT_WRITE",
    )

    with pytest.raises(ValueError, match="confirmation"):
        config.validate()


@pytest.mark.asyncio
async def test_mark_read_mutates_once_and_uses_strict_response_as_confirmation() -> None:
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    config = AvitoProbeConfig(
        access_token="synthetic-token",
        user_id="123456",
        mode="write-mark-read",
        max_pages=1,
        chat_id="chat-77",
        confirmation="I_UNDERSTAND_AVITO_MARK_READ",
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.method == "POST"]
    assert report.status == "PASS"
    assert report.write_confirmed is True
    assert len(mutations) == 1
    assert mutations[0].url.path.endswith("/read")


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
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json=[]),
            send_response,
        ]
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        _send_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    mutations = [request for request in recorder.requests if request.method == "POST"]
    assert report.status == "AMBIGUOUS"
    assert report.write_attempted is True
    assert report.write_confirmed is None
    assert len(mutations) == 1


@pytest.mark.asyncio
async def test_failed_reconciliation_after_send_is_ambiguous() -> None:
    outbound = _message(1, direction="out", text="Synthetic reply")
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json=[]),
            httpx.Response(200, json=outbound),
            httpx.Response(503, json={"error": "synthetic"}),
        ]
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        _send_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "AMBIGUOUS"
    assert sum(request.method == "POST" for request in recorder.requests) == 1


@pytest.mark.asyncio
async def test_existing_outbound_message_blocks_send() -> None:
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json=[_message(1, direction="out")]),
        ]
    )

    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        _send_config(),
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )

    assert report.status == "BLOCKED"
    assert report.write_attempted is False
    assert all(request.method == "GET" for request in recorder.requests)


@pytest.mark.parametrize("max_pages", [0, 6])
def test_page_budget_rejects_values_outside_safe_bounds(max_pages: int) -> None:
    config = AvitoProbeConfig(access_token="synthetic-token", user_id="123456", max_pages=max_pages)

    with pytest.raises(ValueError, match="max_pages"):
        config.validate()


def test_chat_send_requires_inbound_timestamp() -> None:
    config = _send_config(inbound_created_unix=None)

    with pytest.raises(ValueError, match="AVITO_INBOUND_CREATED_UNIX"):
        config.validate()


@pytest.mark.asyncio
async def test_evidence_excludes_token_user_chat_and_message(tmp_path: Path) -> None:
    outbound = _message(1, direction="out", text="Sensitive synthetic reply")
    recorder = RequestRecorder(
        [
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json={"chats": []}),
            httpx.Response(200, json=[]),
            httpx.Response(200, json=outbound),
            httpx.Response(200, json=[outbound]),
        ]
    )
    config = _send_config(chat_id="chat-987654", message_text="Sensitive synthetic reply")
    report = await run_probe(
        AvitoAdapter(transport=httpx.MockTransport(recorder)),
        config,
        git_sha=_GIT_SHA,
        app_version="0.1.103",
    )
    output = tmp_path / "avito.json"

    write_runtime_probe_report(
        output,
        report,
        forbidden_values=(config.access_token, config.user_id, config.chat_id or "", config.message_text or ""),
    )
    serialized = output.read_text(encoding="utf-8")

    assert config.access_token not in serialized
    assert config.user_id not in serialized
    assert (config.chat_id or "missing") not in serialized
    assert (config.message_text or "missing") not in serialized
