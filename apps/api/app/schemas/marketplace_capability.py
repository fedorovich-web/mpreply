from typing import Literal

from pydantic import BaseModel

from app.adapters.base import MarketplaceOperation
from app.models.enums import Marketplace, MessageType


class MarketplaceCapabilityResponse(BaseModel):
    marketplace: Marketplace
    integration_status: Literal["enabled", "planned"]
    operations: list[MarketplaceOperation]
    message_types: list[MessageType]
    polling_enabled: bool
    scheduler_enabled: bool
    pagination_strategy: Literal["offset", "page_token", "none", "unknown"]
    notes: str
