from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from time import monotonic
from typing import Literal, cast

import httpx

from app.adapters.base import AdapterResult

_TOKEN_URL = "https://api.avito.ru/token/"
_MAX_TOKEN_LIFETIME_SECONDS = 604800


@dataclass(frozen=True)
class AvitoResolvedCredential:
    access_token: str
    authentication: Literal["client_credentials", "access_token"]


@dataclass(frozen=True)
class _ClientCredentials:
    client_id: str
    client_secret: str


@dataclass(frozen=True)
class _CachedToken:
    resolved: AvitoResolvedCredential
    expires_at: float


class AvitoCredentialResolver:
    def __init__(
        self,
        *,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
        monotonic: Callable[[], float] = monotonic,
        early_expiry_seconds: int = 60,
        max_cache_entries: int = 128,
    ) -> None:
        if early_expiry_seconds < 0:
            raise ValueError("early_expiry_seconds must be non-negative")
        if max_cache_entries < 1:
            raise ValueError("max_cache_entries must be positive")
        self._timeout = httpx.Timeout(timeout_seconds)
        self._transport = transport
        self._monotonic = monotonic
        self._early_expiry_seconds = early_expiry_seconds
        self._max_cache_entries = max_cache_entries
        self._cache: dict[str, _CachedToken] = {}

    async def resolve(self, raw: str) -> AvitoResolvedCredential | AdapterResult:
        parsed = _parse_client_credentials(raw)
        if isinstance(parsed, AdapterResult):
            return parsed
        if parsed is None:
            access_token = _normalize_access_token(raw)
            if access_token is None:
                return _invalid_credentials()
            return AvitoResolvedCredential(access_token=access_token, authentication="access_token")

        cache_key = _cache_key(parsed)
        now = self._monotonic()
        cached = self._cache.get(cache_key)
        if cached is not None and cached.expires_at > now:
            return cached.resolved
        self._cache.pop(cache_key, None)

        acquired = await self._acquire(parsed)
        if isinstance(acquired, AdapterResult):
            return acquired
        resolved, expires_in = acquired
        expires_at = now + max(expires_in - self._early_expiry_seconds, 0)
        if expires_at > now:
            self._insert(cache_key, _CachedToken(resolved=resolved, expires_at=expires_at))
        return resolved

    def invalidate(self, raw: str) -> None:
        parsed = _parse_client_credentials(raw)
        if isinstance(parsed, _ClientCredentials):
            self._cache.pop(_cache_key(parsed), None)

    async def _acquire(
        self,
        credential: _ClientCredentials,
    ) -> tuple[AvitoResolvedCredential, int] | AdapterResult:
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    _TOKEN_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": credential.client_id,
                        "client_secret": credential.client_secret,
                    },
                    headers={"Accept": "application/json"},
                )
        except httpx.TimeoutException:
            return _error("network_timeout", "Avito authentication timed out")
        except httpx.RequestError:
            return _error("network_error", "Avito authentication network error")

        if not response.is_success:
            return _map_token_error(response.status_code)
        try:
            payload: object = response.json()
        except ValueError:
            return _malformed_token_response()
        mapping = cast(Mapping[str, object], payload) if isinstance(payload, Mapping) else None
        if mapping is None:
            return _malformed_token_response()
        access_token_value = mapping.get("access_token")
        token_type_value = mapping.get("token_type")
        expires_in_value = mapping.get("expires_in")
        access_token = access_token_value.strip() if isinstance(access_token_value, str) else ""
        if (
            not access_token
            or not isinstance(token_type_value, str)
            or token_type_value.strip().lower() != "bearer"
            or isinstance(expires_in_value, bool)
            or not isinstance(expires_in_value, int)
            or not 1 <= expires_in_value <= _MAX_TOKEN_LIFETIME_SECONDS
        ):
            return _malformed_token_response()
        return (
            AvitoResolvedCredential(access_token=access_token, authentication="client_credentials"),
            expires_in_value,
        )

    def _insert(self, key: str, value: _CachedToken) -> None:
        if key not in self._cache and len(self._cache) >= self._max_cache_entries:
            earliest_key = min(self._cache, key=lambda candidate: self._cache[candidate].expires_at)
            self._cache.pop(earliest_key, None)
        self._cache[key] = value


def _parse_client_credentials(raw: str) -> _ClientCredentials | AdapterResult | None:
    normalized = raw.strip()
    if not normalized.startswith("{"):
        return None
    try:
        payload: object = json.loads(normalized)
    except json.JSONDecodeError:
        return _invalid_credentials()
    mapping = cast(Mapping[str, object], payload) if isinstance(payload, Mapping) else None
    if mapping is None or set(mapping) != {"client_id", "client_secret"}:
        return _invalid_credentials()
    client_id_value = mapping.get("client_id")
    client_secret_value = mapping.get("client_secret")
    if not isinstance(client_id_value, str) or not isinstance(client_secret_value, str):
        return _invalid_credentials()
    client_id = client_id_value.strip()
    client_secret = client_secret_value.strip()
    if not client_id or not client_secret:
        return _invalid_credentials()
    return _ClientCredentials(client_id=client_id, client_secret=client_secret)


def _normalize_access_token(raw: str) -> str | None:
    normalized = raw.strip()
    if normalized.lower().startswith("bearer "):
        normalized = normalized[7:].strip()
    return normalized or None


def _cache_key(credential: _ClientCredentials) -> str:
    material = f"{credential.client_id}\0{credential.client_secret}".encode()
    return hashlib.sha256(material).hexdigest()


def _map_token_error(status_code: int) -> AdapterResult:
    if status_code in {400, 401, 403}:
        return _invalid_credentials()
    if status_code == 429:
        return _error("rate_limited", "Avito authentication rate limit exceeded")
    if 500 <= status_code <= 599:
        return _error("marketplace_unavailable", "Avito authentication is temporarily unavailable")
    return _error("marketplace_error", "Avito authentication request was rejected")


def _invalid_credentials() -> AdapterResult:
    return _error("invalid_credentials", "Avito credentials are invalid")


def _malformed_token_response() -> AdapterResult:
    return _error("malformed_payload", "Avito authentication returned a malformed response")


def _error(code: str, message: str) -> AdapterResult:
    return AdapterResult(ok=False, error_code=code, error_message_safe=message)
