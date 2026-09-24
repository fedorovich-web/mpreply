from __future__ import annotations

from typing import cast

import httpx

from app.adapters.avito import AvitoAdapter
from app.adapters.avito_auth import AvitoCredentialResolver
from app.adapters.avito_http import AvitoApiClient
from app.adapters.avito_reviews import AvitoReviewAdapter
from app.adapters.base import AdapterResult, CredentialValidation
from app.adapters.http import ReadRetryPolicy
from app.models.enums import Marketplace


class AvitoCredentialAdapter:
    marketplace = Marketplace.AVITO

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        credential_resolver: AvitoCredentialResolver | None = None,
        read_retry_policy: ReadRetryPolicy = ReadRetryPolicy(),
    ) -> None:
        resolver = credential_resolver or AvitoCredentialResolver(client)
        self._resolver = resolver
        self._chats = AvitoAdapter(client, credential_resolver=resolver, read_retry_policy=read_retry_policy)
        self._reviews = AvitoReviewAdapter(client, credential_resolver=resolver, read_retry_policy=read_retry_policy)

    async def validate_credentials(self, credential: str, seller_id: str | None) -> AdapterResult[CredentialValidation]:
        token = await self._resolver.resolve(credential)
        if not token.ok or token.data is None:
            return cast(AdapterResult[CredentialValidation], AvitoApiClient.copy_failure(token))

        chats = await self._chats.validate_credentials(credential, seller_id)
        reviews = await self._reviews.validate_credentials(credential, seller_id)
        scopes = (
            *(("chats:read", "chats:write") if chats.ok else ()),
            *(("reviews:read", "reviews:write") if reviews.ok else ()),
        )
        if not scopes:
            failure = reviews if reviews.error_code == "insufficient_scope" else chats if chats.error_code == "insufficient_scope" else reviews
            return AdapterResult(
                False,
                error_code=failure.error_code or "marketplace_validation_error",
                error_message_safe="Avito chat and ratings reads are unavailable",
                retry_after_seconds=failure.retry_after_seconds,
            )
        return AdapterResult(
            ok=True,
            data=CredentialValidation(scopes=scopes, account_reference=seller_id, write_verification="not_probed"),
        )
