from app.adapters.base import MarketplaceAdapter
from app.adapters.capabilities import get_marketplace_capability
from app.adapters.wildberries import WildberriesAdapter
from app.core.errors import forbidden
from app.models.enums import Marketplace


def get_marketplace_adapter(marketplace: Marketplace | str) -> MarketplaceAdapter:
    capability = get_marketplace_capability(marketplace)
    if not capability.connection_enabled:
        raise forbidden("Marketplace adapter is not enabled yet")
    if capability.marketplace is Marketplace.WILDBERRIES:
        return WildberriesAdapter()
    raise forbidden("Marketplace adapter is not enabled yet")
