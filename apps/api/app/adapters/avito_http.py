from __future__ import annotations

from datetime import UTC, datetime

import httpx

from app.adapters.avito_auth import AvitoCredentialResolver, AvitoResolvedCredential
from app.adapters.base import AdapterResult
from app.adapters.http import (
    InvalidProviderPath,
    ReadRetryPolicy,
    ensure_relative_provider_path,
    parse_retry_after,
    request_read_with_retry,
)


class AvitoApiClient:
    """Authenticated requests to Avito's fixed API origin, without write retries."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        credential_resolver: AvitoCredentialResolver,
        read_retry_policy: ReadRetryPolicy = ReadRetryPolicy(),
    ) -> None:
        self._client = client
        self._resolver = credential_resolver
        self._read_retry_policy = read_retry_policy

    async def read(
        self,
        raw_credential: str,
        path: str,
        *,
        params: dict[str, str | int],
    ) -> AdapterResult[object]:
        if not self._valid_path(path):
            return self._invalid_path()
        resolved = await self._resolver.resolve(raw_credential)
        if not resolved.ok or resolved.data is None:
            return self.copy_failure(resolved)
        try:
            response = await self._read_with_token(resolved.data, path, params)
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Avito read timed out")
        except httpx.RequestError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Avito network request failed")
        if response.status_code == 401:
            await self._resolver.invalidate(raw_credential)
            refreshed = await self._resolver.resolve(raw_credential)
            if not refreshed.ok or refreshed.data is None:
                return self.copy_failure(refreshed)
            try:
                response = await self._read_with_token(refreshed.data, path, params)
            except httpx.TimeoutException:
                return AdapterResult(False, error_code="network_timeout", error_message_safe="Avito read timed out")
            except httpx.RequestError:
                return AdapterResult(False, error_code="network_error", error_message_safe="Avito network request failed")
        return self._response_result(response)

    async def _read_with_token(
        self,
        resolved: AvitoResolvedCredential,
        path: str,
        params: dict[str, str | int],
    ) -> httpx.Response:
        return await request_read_with_retry(
            self._client,
            "GET",
            path,
            headers=self._headers(resolved.access_token),
            params=params,
            policy=self._read_retry_policy,
        )

    async def write(
        self,
        raw_credential: str,
        path: str,
        *,
        body: dict[str, object] | None,
    ) -> AdapterResult[object]:
        if not self._valid_path(path):
            return self._invalid_path()
        resolved = await self._resolver.resolve(raw_credential)
        if not resolved.ok or resolved.data is None:
            return self.copy_failure(resolved)
        try:
            response = await self._client.post(
                path,
                headers=self._headers(resolved.data.access_token),
                json=body,
            )
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Avito write timed out")
        except httpx.RequestError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Avito network request failed")
        return self._response_result(response)

    def _response_result(self, response: httpx.Response) -> AdapterResult[object]:
        if not response.is_success:
            return self._map_error(response)
        try:
            payload: object = response.json()
        except ValueError:
            return AdapterResult(False, error_code="malformed_payload", error_message_safe="Avito returned invalid JSON")
        return AdapterResult(ok=True, data=payload)

    def _map_error(self, response: httpx.Response) -> AdapterResult[object]:
        retry_after = (
            parse_retry_after(
                response.headers.get("Retry-After"),
                now=datetime.now(UTC),
                maximum_seconds=self._read_retry_policy.max_retry_after_seconds,
            )
            if response.status_code == 429
            else None
        )
        if response.status_code == 401:
            code, message = "invalid_credentials", "Avito credentials are invalid"
        elif response.status_code in {402, 403}:
            code, message = "insufficient_scope", "Avito account lacks API access"
        elif response.status_code == 404:
            code, message = "marketplace_not_found", "Avito resource was not found"
        elif response.status_code == 429:
            code, message = "rate_limited", "Avito rate limit was exceeded"
        elif 500 <= response.status_code <= 599:
            code, message = "marketplace_unavailable", "Avito is temporarily unavailable"
        else:
            code, message = "marketplace_validation_error", "Avito rejected the request"
        return AdapterResult(False, error_code=code, error_message_safe=message, retry_after_seconds=retry_after)

    @staticmethod
    def _valid_path(path: str) -> bool:
        try:
            ensure_relative_provider_path(path)
        except InvalidProviderPath:
            return False
        return True

    @staticmethod
    def _invalid_path() -> AdapterResult[object]:
        return AdapterResult(False, error_code="marketplace_validation_error", error_message_safe="Avito request path is invalid")

    @staticmethod
    def _headers(access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}"}

    @staticmethod
    def copy_failure(result: AdapterResult) -> AdapterResult[object]:
        return AdapterResult(
            False,
            error_code=result.error_code,
            error_message_safe=result.error_message_safe,
            retry_after_seconds=result.retry_after_seconds,
        )
