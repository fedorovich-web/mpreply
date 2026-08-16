from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.admin import require_superadmin
from app.models.user import User
from app.schemas.llm_admin import (
    OpenRouterCatalogResponse,
    OpenRouterConfigurationResponse,
    OpenRouterConfigurationUpdateRequest,
    OpenRouterKeyValidateRequest,
)
from app.services.llm_configuration_service import LLMConfigurationService

router = APIRouter(prefix="/api/admin/llm/openrouter", tags=["admin-llm"])


@router.get("", response_model=OpenRouterConfigurationResponse)
async def get_openrouter_configuration(
    _current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterConfigurationResponse:
    return await LLMConfigurationService(session).get_safe_configuration()


@router.post("/validate", response_model=OpenRouterCatalogResponse)
async def validate_openrouter_key(
    payload: OpenRouterKeyValidateRequest,
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterCatalogResponse:
    response = await LLMConfigurationService(session).validate_candidate(
        actor=current_user,
        api_key=payload.api_key.get_secret_value(),
    )
    await session.commit()
    return response


@router.post("/models/refresh", response_model=OpenRouterCatalogResponse)
async def refresh_openrouter_models(
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterCatalogResponse:
    response = await LLMConfigurationService(session).refresh_models(actor=current_user)
    await session.commit()
    return response


@router.put("", response_model=OpenRouterConfigurationResponse)
async def save_openrouter_configuration(
    payload: OpenRouterConfigurationUpdateRequest,
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterConfigurationResponse:
    response = await LLMConfigurationService(session).save_configuration(
        actor=current_user,
        payload=payload,
    )
    await session.commit()
    return response


@router.post("/disable", response_model=OpenRouterConfigurationResponse)
async def disable_openrouter(
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterConfigurationResponse:
    response = await LLMConfigurationService(session).disable(actor=current_user)
    await session.commit()
    return response


@router.delete("/key", response_model=OpenRouterConfigurationResponse)
async def remove_openrouter_key(
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterConfigurationResponse:
    response = await LLMConfigurationService(session).remove_local_key(actor=current_user)
    await session.commit()
    return response
