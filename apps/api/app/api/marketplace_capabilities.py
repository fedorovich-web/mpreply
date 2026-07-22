from fastapi import APIRouter

from app.adapters.capabilities import list_marketplace_capabilities
from app.schemas.marketplace_capability import MarketplaceCapabilityResponse

router = APIRouter(prefix="/api/marketplace-capabilities", tags=["marketplace-capabilities"])


@router.get("", response_model=list[MarketplaceCapabilityResponse])
async def get_marketplace_capabilities() -> list[MarketplaceCapabilityResponse]:
    return [
        MarketplaceCapabilityResponse(
            marketplace=capability.marketplace,
            integration_status=capability.integration_status,
            operations=list(capability.operations),
            message_types=list(capability.message_types),
            polling_enabled=capability.polling_enabled,
            scheduler_enabled=capability.scheduler_enabled,
            pagination_strategy=capability.pagination_strategy,
            notes=capability.notes,
        )
        for capability in list_marketplace_capabilities()
    ]
