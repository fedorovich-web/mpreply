from __future__ import annotations

from fastapi import Request

from app.adapters.registry import MarketplaceAdapterRegistry


def get_marketplace_registry(request: Request) -> MarketplaceAdapterRegistry:
    registry = getattr(request.app.state, "marketplace_registry", None)
    if not isinstance(registry, MarketplaceAdapterRegistry):
        raise RuntimeError("marketplace adapter registry is not initialized")
    return registry
