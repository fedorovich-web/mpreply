from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from time import monotonic
from typing import cast

import httpx

from app.adapters.base import AdapterResult, MarketplaceErrorCode

_MAX_CREDENTIAL_JSON_BYTES = 16_384
_MAX_CREDENTIAL_PART_LENGTH = 4_096
_MAX_TOKEN_LENGTH = 8_192
_MAX_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60


class InvalidAvitoCredential(ValueError):
    def __init__(self) -> None:
        super().__init__("Avito client credentials are invalid")


@dataclass(frozen=True, slots=True)
class AvitoClientCredentials:
    version: int
    client_id: str
    client_secret: str

    @classmethod
    def parse(cls, raw: str) -> AvitoClientCredentials:
        try:
            raw_size = len(raw.encode("utf-8"))
        except UnicodeEncodeError as exc:
            raise InvalidAvitoCredential from exc
        if raw_size > _MAX_CREDENTIAL_JSON_BYTES:
            raise InvalidAvitoCredential
        try:
            payload: object = json.loads(raw, object_pairs_hook=_unique_object)
        except (json.JSONDecodeError, UnicodeError) as exc:
            raise InvalidAvitoCredential from exc
        if not isinstance(payload, dict):
            raise InvalidAvitoCredential
        data = cast(dict[str, object], payload)
        if set(data) != {"version", "client_id", "client_secret"} or type(data.get("version")) is not int or data.get("version") != 1:
            raise InvalidAvitoCredential
        client_id = cls._part(data.get("client_id"))
        client_secret = cls._part(data.get("client_secret"))
        if client_id is None or client_secret is None:
            raise InvalidAvitoCredential
        return cls(version=1, client_id=client_id, client_secret=client_secret)

    @staticmethod
    def _part(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        if value and value == value.strip() and len(value) <= _MAX_CREDENTIAL_PART_LENGTH and all(ord(character) >= 32 for character in value):
            return value
        return None


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise InvalidAvitoCredential
        result[key] = value
    return result


@dataclass(frozen=True, slots=True)
class AvitoResolvedCredential:
    access_token: str
    expires_at_monotonic: float


class AvitoCredentialResolver:
    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        clock: Callable[[], float] = monotonic,
        expiry_skew_seconds: int = 60,
        max_cache_entries: int = 128,
        max_inflight: int = 32,
    ) -> None:
        if not 0 <= expiry_skew_seconds <= 300:
            raise ValueError("Avito token expiry skew must be between 0 and 300 seconds")
        if not 1 <= max_cache_entries <= 1_024 or not 1 <= max_inflight <= 128:
            raise ValueError("Avito token cache bounds are invalid")
        self._client = client
        self._clock = clock
        self._expiry_skew_seconds = expiry_skew_seconds
        self._max_cache_entries = max_cache_entries
        self._max_inflight = max_inflight
        self._cache: dict[str, AvitoResolvedCredential] = {}
        self._inflight: dict[str, asyncio.Task[AdapterResult[AvitoResolvedCredential]]] = {}
        self._cleanup_tasks: set[asyncio.Task[None]] = set()
        self._guard = asyncio.Lock()

    async def resolve(self, raw: str) -> AdapterResult[AvitoResolvedCredential]:
        try:
            credentials = AvitoClientCredentials.parse(raw)
        except InvalidAvitoCredential:
            return self._error("invalid_credentials", "Avito client credentials are invalid")
        fingerprint = self._fingerprint(credentials)
        async with self._guard:
            cached = self._cache.get(fingerprint)
            if cached is not None and cached.expires_at_monotonic > self._clock():
                return AdapterResult(ok=True, data=cached)
            self._cache.pop(fingerprint, None)
            task = self._inflight.get(fingerprint)
            if task is None:
                if len(self._inflight) >= self._max_inflight:
                    return self._error(
                        "rate_limited",
                        "Avito credential refresh concurrency limit was reached",
                    )
                task = asyncio.create_task(self._acquire(credentials))
                self._inflight[fingerprint] = task
                task.add_done_callback(
                    lambda completed, key=fingerprint: self._schedule_inflight_cleanup(
                        key,
                        completed,
                    )
                )
        try:
            result = await asyncio.shield(task)
        finally:
            async with self._guard:
                if self._inflight.get(fingerprint) is task and task.done():
                    self._inflight.pop(fingerprint, None)
        if result.ok and result.data is not None:
            async with self._guard:
                self._insert(fingerprint, result.data)
        return result

    async def invalidate(self, raw: str) -> None:
        try:
            credentials = AvitoClientCredentials.parse(raw)
        except InvalidAvitoCredential:
            return
        async with self._guard:
            self._cache.pop(self._fingerprint(credentials), None)

    async def _acquire(
        self,
        credentials: AvitoClientCredentials,
    ) -> AdapterResult[AvitoResolvedCredential]:
        try:
            response = await self._client.post(
                "/token/",
                data={
                    "grant_type": "client_credentials",
                    "client_id": credentials.client_id,
                    "client_secret": credentials.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        except httpx.TimeoutException:
            return self._error("network_timeout", "Avito authentication timed out")
        except httpx.RequestError:
            return self._error("network_error", "Avito authentication network request failed")
        if not response.is_success:
            return self._map_error(response.status_code)
        try:
            payload: object = response.json()
        except ValueError:
            return self._error("malformed_payload", "Avito authentication response is invalid")
        if not isinstance(payload, dict):
            return self._error("malformed_payload", "Avito authentication response is invalid")
        data = cast(dict[str, object], payload)
        token = data.get("access_token")
        token_type = data.get("token_type")
        expires_in = data.get("expires_in")
        if (
            not isinstance(token, str)
            or not token
            or token != token.strip()
            or len(token) > _MAX_TOKEN_LENGTH
            or not isinstance(token_type, str)
            or token_type.lower() != "bearer"
            or isinstance(expires_in, bool)
            or not isinstance(expires_in, int)
            or not 1 <= expires_in <= _MAX_TOKEN_LIFETIME_SECONDS
        ):
            return self._error("malformed_payload", "Avito authentication response is invalid")
        usable_lifetime = expires_in - self._expiry_skew_seconds
        if usable_lifetime <= 0:
            return self._error("malformed_payload", "Avito authentication token lifetime is too short")
        return AdapterResult(
            ok=True,
            data=AvitoResolvedCredential(
                access_token=token,
                expires_at_monotonic=self._clock() + usable_lifetime,
            ),
        )

    def _schedule_inflight_cleanup(
        self,
        fingerprint: str,
        task: asyncio.Task[AdapterResult[AvitoResolvedCredential]],
    ) -> None:
        cleanup = asyncio.create_task(self._remove_inflight(fingerprint, task))
        self._cleanup_tasks.add(cleanup)
        cleanup.add_done_callback(self._cleanup_tasks.discard)

    async def _remove_inflight(
        self,
        fingerprint: str,
        task: asyncio.Task[AdapterResult[AvitoResolvedCredential]],
    ) -> None:
        async with self._guard:
            if self._inflight.get(fingerprint) is task:
                self._inflight.pop(fingerprint, None)

    def _insert(self, fingerprint: str, value: AvitoResolvedCredential) -> None:
        if fingerprint not in self._cache and len(self._cache) >= self._max_cache_entries:
            oldest = min(
                self._cache,
                key=lambda candidate: self._cache[candidate].expires_at_monotonic,
            )
            self._cache.pop(oldest, None)
        self._cache[fingerprint] = value

    @staticmethod
    def _fingerprint(credentials: AvitoClientCredentials) -> str:
        material = f"{credentials.client_id}\x00{credentials.client_secret}".encode()
        return hashlib.sha256(material).hexdigest()

    @classmethod
    def _map_error(cls, status_code: int) -> AdapterResult[AvitoResolvedCredential]:
        if status_code in {400, 401}:
            return cls._error("invalid_credentials", "Avito client credentials are invalid")
        if status_code in {402, 403}:
            return cls._error("insufficient_scope", "Avito credentials lack Messenger access")
        if status_code == 429:
            return cls._error("rate_limited", "Avito authentication rate limit was exceeded")
        if 500 <= status_code <= 599:
            return cls._error("marketplace_unavailable", "Avito authentication is temporarily unavailable")
        return cls._error("marketplace_validation_error", "Avito rejected the authentication request")

    @staticmethod
    def _error(
        code: MarketplaceErrorCode,
        message: str,
    ) -> AdapterResult[AvitoResolvedCredential]:
        return AdapterResult(False, error_code=code, error_message_safe=message)
