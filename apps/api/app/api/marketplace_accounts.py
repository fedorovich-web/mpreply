from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.marketplace_account import (
    MarketplaceAccountActionResponse,
    MarketplaceAccountCreateRequest,
    MarketplaceAccountResponse,
    MarketplaceAccountRotateCredentialsRequest,
    MarketplaceAccountUpdateRequest,
    MarketplaceAccountValidateResponse,
)
from app.schemas.sync import MarketplaceSyncResponse
from app.services.marketplace_account_service import MarketplaceAccountService
from app.services.sync_service import MarketplaceSyncService

router = APIRouter(prefix="/api/marketplace-accounts", tags=["marketplace-accounts"])


@router.post("", response_model=MarketplaceAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_marketplace_account(
    payload: MarketplaceAccountCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAccountResponse:
    service = MarketplaceAccountService(session)
    account = await service.create_account(
        actor=current_user,
        organization_id=payload.organization_id,
        marketplace=payload.marketplace,
        display_name=payload.display_name,
        raw_credentials=payload.credentials,
        seller_id=payload.seller_id,
        default_response_mode=payload.default_response_mode,
    )
    await session.commit()
    return service.to_response(account)


@router.get("", response_model=list[MarketplaceAccountResponse])
async def list_marketplace_accounts(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[MarketplaceAccountResponse]:
    service = MarketplaceAccountService(session)
    accounts = await service.list_accounts(actor=current_user, organization_id=organization_id)
    return [service.to_response(account) for account in accounts]


@router.get("/{account_id}", response_model=MarketplaceAccountResponse)
async def get_marketplace_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAccountResponse:
    service = MarketplaceAccountService(session)
    account = await service.get_account(actor=current_user, account_id=account_id)
    return service.to_response(account)


@router.patch("/{account_id}", response_model=MarketplaceAccountResponse)
async def update_marketplace_account(
    account_id: UUID,
    payload: MarketplaceAccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAccountResponse:
    service = MarketplaceAccountService(session)
    account = await service.update_account(
        actor=current_user,
        account_id=account_id,
        display_name=payload.display_name,
        seller_id=payload.seller_id,
        default_response_mode=payload.default_response_mode,
        status=payload.status,
    )
    await session.commit()
    return service.to_response(account)


@router.post("/{account_id}/validate", response_model=MarketplaceAccountValidateResponse)
async def validate_marketplace_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAccountValidateResponse:
    service = MarketplaceAccountService(session)
    account, result = await service.validate_credentials(actor=current_user, account_id=account_id)
    await session.commit()
    scopes_value = (account.scopes_json or {}).get("scopes")
    scopes = [scope for scope in scopes_value if isinstance(scope, str)] if isinstance(scopes_value, list) else []
    return MarketplaceAccountValidateResponse(
        id=account.id,
        status=account.status,
        credentials_status=account.credentials_status,
        scopes=scopes,
        checked_at=datetime.now(UTC),
        error_code=result.error_code,
        error_message_safe=result.error_message_safe,
    )


@router.post("/{account_id}/rotate-credentials", response_model=MarketplaceAccountActionResponse)
async def rotate_marketplace_credentials(
    account_id: UUID,
    payload: MarketplaceAccountRotateCredentialsRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAccountActionResponse:
    service = MarketplaceAccountService(session)
    account = await service.rotate_credentials(
        actor=current_user,
        account_id=account_id,
        raw_credentials=payload.credentials,
    )
    await session.commit()
    response = service.to_response(account)
    return MarketplaceAccountActionResponse(
        id=account.id,
        status=account.status,
        credentials_status=account.credentials_status,
        credentials_masked=response.credentials_masked,
        message="Credentials rotated. Validate the connection before using this account.",
    )


@router.post("/{account_id}/revoke-credentials", response_model=MarketplaceAccountActionResponse)
async def revoke_marketplace_credentials(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAccountActionResponse:
    service = MarketplaceAccountService(session)
    account = await service.revoke_credentials(actor=current_user, account_id=account_id)
    await session.commit()
    response = service.to_response(account)
    return MarketplaceAccountActionResponse(
        id=account.id,
        status=account.status,
        credentials_status=account.credentials_status,
        credentials_masked=response.credentials_masked,
        message="Credentials revoked. This marketplace account is disabled.",
    )


@router.post("/{account_id}/sync", response_model=MarketplaceSyncResponse, status_code=status.HTTP_202_ACCEPTED)
async def request_marketplace_sync(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceSyncResponse:
    service = MarketplaceSyncService(session)
    account, stats, error_code, error_message_safe = await service.sync_account(
        actor=current_user,
        account_id=account_id,
    )
    await session.commit()
    return MarketplaceSyncResponse(
        account_id=account.id,
        marketplace=account.marketplace,
        status="failed" if error_code else "success",
        imported_reviews=stats.imported_reviews,
        imported_questions=stats.imported_questions,
        updated_reviews=stats.updated_reviews,
        updated_questions=stats.updated_questions,
        imported_chats=stats.imported_chats,
        updated_chats=stats.updated_chats,
        skipped=stats.skipped,
        error_code=error_code,
        error_message_safe=error_message_safe,
    )
