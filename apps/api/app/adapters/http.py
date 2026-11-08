from __future__ import annotations

import asyncio
import math
import os
import random
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Literal
from urllib.parse import urlsplit

import httpx

ReadMethod = Literal["GET", "POST"]
Sleep = Callable[[float], Awaitable[None]]
RequestParams = Mapping[str, str | int | bool]
MAX_PROVIDER_RETRY_AFTER_SECONDS = 86_400

_TRANSIENT_HTTP_STATUSES = frozenset({429, 500, 502, 503, 504})
_DEFAULT_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=5.0)
_DEFAULT_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=20.0)
_YANDEX_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=0)


def sanitize_proxy_env() -> None:
    for var in ("NO_PROXY", "no_proxy"):
        val = os.environ.get(var)
        if val and "[::1]" in val:
            os.environ[var] = val.replace(",[::1]", "").replace("[::1],", "").replace("[::1]", "")


class InvalidProviderPath(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ReadRetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 2.0
    max_retry_after_seconds: int = 30
    jitter: bool = False

    def __post_init__(self) -> None:
        if not 1 <= self.max_attempts <= 5:
            raise ValueError("max_attempts must be between 1 and 5")
        if not 0 <= self.base_delay_seconds <= self.max_delay_seconds <= 30:
            raise ValueError("retry delays must be ordered and between 0 and 30 seconds")
        if not 0 <= self.max_retry_after_seconds <= 300:
            raise ValueError("max_retry_after_seconds must be between 0 and 300")

    def compute_backoff(self, attempt: int) -> float:
        limit = min(self.base_delay_seconds * (2 ** (attempt - 1)), self.max_delay_seconds)
        if self.jitter:
            return random.uniform(0.0, limit)
        return limit


@dataclass(frozen=True, slots=True)
class MarketplaceHttpClients:
    wildberries: httpx.AsyncClient
    ozon: httpx.AsyncClient
    yandex_market: httpx.AsyncClient
    avito: httpx.AsyncClient

    @classmethod
    def create(cls, *, transport: httpx.AsyncBaseTransport | None = None) -> MarketplaceHttpClients:
        return cls(
            wildberries=_create_client(
                "https://feedbacks-api.wildberries.ru",
                transport=transport,
            ),
            ozon=_create_client(
                "https://api-seller.ozon.ru",
                transport=transport,
            ),
            yandex_market=_create_client(
                "https://api.partner.market.yandex.ru",
                transport=transport,
                limits=_YANDEX_LIMITS,
            ),
            avito=_create_client(
                "https://api.avito.ru",
                transport=transport,
            ),
        )

    def all(self) -> tuple[httpx.AsyncClient, ...]:
        return (self.wildberries, self.ozon, self.yandex_market, self.avito)

    async def aclose(self) -> None:
        await asyncio.gather(*(client.aclose() for client in self.all()))


def _create_client(
    base_url: str,
    *,
    transport: httpx.AsyncBaseTransport | None,
    limits: httpx.Limits = _DEFAULT_LIMITS,
) -> httpx.AsyncClient:
    sanitize_proxy_env()
    return httpx.AsyncClient(
        base_url=base_url,
        timeout=_DEFAULT_TIMEOUT,
        limits=limits,
        follow_redirects=False,
        transport=transport,
        headers={"Accept": "application/json", "User-Agent": "MPReply marketplace integration"},
    )


def ensure_relative_provider_path(path: str) -> str:
    parsed = urlsplit(path)
    if (
        not path.startswith("/")
        or path.startswith("//")
        or parsed.scheme
        or parsed.netloc
        or parsed.query
        or parsed.fragment
        or "\\" in path
        or any(ord(character) < 32 for character in path)
    ):
        raise InvalidProviderPath("provider request path must be a relative absolute-path reference")
    return path


def parse_retry_after(
    value: str | None,
    *,
    now: datetime,
    maximum_seconds: int,
) -> int | None:
    if value is None or not 0 <= maximum_seconds <= 86_400:
        return None
    normalized = value.strip()
    if normalized.isascii() and normalized.isdecimal():
        digits = normalized.lstrip("0") or "0"
        if len(digits) > len(str(maximum_seconds)):
            return None
        seconds = int(digits)
    else:
        try:
            retry_at = parsedate_to_datetime(normalized)
        except (TypeError, ValueError, OverflowError):
            return None
        if retry_at.tzinfo is None:
            retry_at = retry_at.replace(tzinfo=UTC)
        seconds = max(0, math.ceil((retry_at.astimezone(UTC) - now.astimezone(UTC)).total_seconds()))
    return seconds if seconds <= maximum_seconds else None


async def request_read_with_retry(
    client: httpx.AsyncClient,
    method: ReadMethod,
    path: str,
    *,
    headers: Mapping[str, str] | None = None,
    params: RequestParams | None = None,
    json: object | None = None,
    policy: ReadRetryPolicy = ReadRetryPolicy(),
    sleep: Sleep = asyncio.sleep,
    rate_limit_delay: Callable[[httpx.Response], int | None] | None = None,
) -> httpx.Response:
    request_path = ensure_relative_provider_path(path)
    for attempt in range(1, policy.max_attempts + 1):
        try:
            response = await client.request(
                method,
                request_path,
                headers=headers,
                params=params,
                json=json,
            )
        except (httpx.TimeoutException, httpx.RequestError):
            if attempt == policy.max_attempts:
                raise
        else:
            if response.status_code not in _TRANSIENT_HTTP_STATUSES or attempt == policy.max_attempts:
                return response
            if response.status_code == 429 and rate_limit_delay is not None:
                delay = rate_limit_delay(response)
                if delay is not None:
                    if delay > policy.max_retry_after_seconds:
                        return response
                    await sleep(float(delay))
                    continue
            retry_after = parse_retry_after(
                response.headers.get("Retry-After"),
                now=datetime.now(UTC),
                maximum_seconds=MAX_PROVIDER_RETRY_AFTER_SECONDS,
            )
            if retry_after is not None:
                if retry_after > policy.max_retry_after_seconds:
                    return response
                await sleep(float(retry_after))
                continue
        await sleep(policy.compute_backoff(attempt))
    raise RuntimeError("bounded retry loop exhausted without returning")
