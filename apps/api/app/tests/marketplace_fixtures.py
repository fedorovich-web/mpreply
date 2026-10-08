from __future__ import annotations

from collections import deque
from collections.abc import Sequence

import httpx

TransportOutcome = httpx.Response | Exception


class SequenceTransport:
    def __init__(self, outcomes: Sequence[TransportOutcome]) -> None:
        self._outcomes = deque(outcomes)
        self.requests: list[httpx.Request] = []

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if not self._outcomes:
            raise AssertionError("unexpected marketplace HTTP request")
        outcome = self._outcomes.popleft()
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    def mock(self) -> httpx.MockTransport:
        return httpx.MockTransport(self)

    def assert_exhausted(self) -> None:
        if self._outcomes:
            raise AssertionError(f"{len(self._outcomes)} marketplace HTTP outcomes were not consumed")


def response(
    status_code: int,
    *,
    json: object | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    if json is None:
        return httpx.Response(status_code, headers=headers)
    return httpx.Response(status_code, headers=headers, json=json)
