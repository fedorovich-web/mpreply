from __future__ import annotations

from uuid import uuid4

from app.adapters.capabilities import OZON_CAPABILITY, MarketplaceStream, streams_for_scopes
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount


def _account(scopes: list[object]) -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.OZON.value,
        display_name="Synthetic Ozon",
        seller_id="100200",
        status="active",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        credentials_status="valid",
        scopes_json={"scopes": scopes},
    )


def test_ozon_sync_initializes_only_streams_with_complete_validated_read_scope() -> None:
    review_account = _account(["reviews:read", "reviews:write"])
    malformed_account = _account(["reviews:read", 42])
    review_only = streams_for_scopes(
        OZON_CAPABILITY.streams,
        review_account.scopes_json,
    )
    malformed = streams_for_scopes(
        OZON_CAPABILITY.streams,
        malformed_account.scopes_json,
    )

    assert review_only == frozenset({MarketplaceStream.REVIEWS})
    assert malformed == frozenset()
