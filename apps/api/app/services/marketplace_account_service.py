from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, CredentialValidation
from app.adapters.registry import MarketplaceAdapterRegistry, UnsupportedCapabilityError
from app.core.config import get_settings
from app.core.errors import bad_request, conflict, forbidden, not_found, payment_required
from app.core.security import CredentialService
from app.models.enums import Marketplace, ResponseMode
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import OrganizationUser
from app.models.user import User
from app.schemas.marketplace_account import MarketplaceAccountResponse
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService

_ALLOWED_MANAGE_ROLES = {"owner", "admin"}
_ALLOWED_READ_ROLES = {"owner", "admin", "manager", "viewer"}


class MarketplaceAccountService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.organization_service = OrganizationService(session)
        self.plan_limits = PlanLimitService(session)
        settings = get_settings()
        self.credentials = CredentialService(settings.credentials_encryption_key.get_secret_value())

    async def create_account(
        self,
        *,
        actor: User,
        organization_id: UUID,
        marketplace: Marketplace,
        display_name: str,
        raw_credentials: str,
        seller_id: str | None,
        default_response_mode: ResponseMode,
    ) -> MarketplaceAccount:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_MANAGE_ROLES,
        )
        limit_decision = await self.plan_limits.evaluate_metric(
            organization_id=organization_id,
            metric="marketplace_accounts",
        )
        if not limit_decision.allowed:
            raise payment_required("Marketplace account limit is exhausted for the current plan")
        encrypted = self.credentials.encrypt(raw_credentials)
        fingerprint = self.credentials.fingerprint(raw_credentials)
        account = MarketplaceAccount(
            organization_id=organization_id,
            marketplace=marketplace.value,
            display_name=display_name.strip(),
            seller_id=seller_id.strip() if seller_id else None,
            status="pending_validation",
            credentials_encrypted=encrypted,
            credentials_fingerprint=fingerprint,
            credentials_status="pending_validation",
            scopes_json={},
            default_response_mode=default_response_mode.value,
        )
        self.session.add(account)
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.credentials.created",
            entity_type="marketplace_account",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={
                "marketplace": marketplace.value,
                "credentials_masked": self.credentials.mask_fingerprint(fingerprint),
            },
        )
        return account

    async def list_accounts(self, *, actor: User, organization_id: UUID) -> list[MarketplaceAccount]:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_READ_ROLES,
        )
        result = await self.session.execute(
            select(MarketplaceAccount).where(MarketplaceAccount.organization_id == organization_id).order_by(MarketplaceAccount.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_account(self, *, actor: User, account_id: UUID) -> MarketplaceAccount:
        result = await self.session.execute(
            select(MarketplaceAccount)
            .join(
                OrganizationUser,
                OrganizationUser.organization_id == MarketplaceAccount.organization_id,
            )
            .where(
                MarketplaceAccount.id == account_id,
                OrganizationUser.user_id == actor.id,
                OrganizationUser.status == "active",
                OrganizationUser.role.in_(_ALLOWED_READ_ROLES),
            )
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        return account

    async def update_account(
        self,
        *,
        actor: User,
        account_id: UUID,
        display_name: str | None = None,
        seller_id: str | None = None,
        default_response_mode: ResponseMode | None = None,
        status: str | None = None,
    ) -> MarketplaceAccount:
        account = await self.get_account(actor=actor, account_id=account_id)
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_MANAGE_ROLES,
        )
        if display_name is not None:
            account.display_name = display_name.strip()
        if seller_id is not None:
            account.seller_id = seller_id.strip() or None
        if default_response_mode is not None:
            account.default_response_mode = default_response_mode.value
        if status is not None:
            if status not in {"active", "disabled", "pending_validation"}:
                raise bad_request("Unsupported marketplace account status")
            account.status = status
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.updated",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={
                "fields_changed": [
                    k
                    for k, v in {
                        "display_name": display_name,
                        "seller_id": seller_id,
                        "default_response_mode": default_response_mode.value if default_response_mode else None,
                        "status": status,
                    }.items()
                    if v is not None
                ]
            },
        )
        return account

    async def rotate_credentials(self, *, actor: User, account_id: UUID, raw_credentials: str) -> MarketplaceAccount:
        account = await self.get_account(actor=actor, account_id=account_id)
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_MANAGE_ROLES,
        )
        fingerprint = self.credentials.fingerprint(raw_credentials)
        account.credentials_encrypted = self.credentials.encrypt(raw_credentials)
        account.credentials_fingerprint = fingerprint
        account.credentials_last_rotated_at = datetime.now(UTC)
        account.credentials_status = "pending_validation"
        account.status = "pending_validation"
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.credentials.rotated",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={"credentials_masked": self.credentials.mask_fingerprint(fingerprint)},
        )
        return account

    async def revoke_credentials(self, *, actor: User, account_id: UUID) -> MarketplaceAccount:
        account = await self.get_account(actor=actor, account_id=account_id)
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_MANAGE_ROLES,
        )
        account.credentials_status = "revoked"
        account.status = "disabled"
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.credentials.revoked",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={"marketplace": account.marketplace},
        )
        return account

    async def validate_credentials(
        self,
        *,
        actor: User,
        account_id: UUID,
        registry: MarketplaceAdapterRegistry,
    ) -> tuple[MarketplaceAccount, AdapterResult[CredentialValidation]]:
        account = await self.get_account(actor=actor, account_id=account_id)
        await self.organization_service.require_membership_role(
            organization_id=account.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_MANAGE_ROLES,
        )
        try:
            marketplace = Marketplace(account.marketplace)
            adapter = registry.credentials(marketplace)
        except (ValueError, UnsupportedCapabilityError):
            raise forbidden("Marketplace adapter is not enabled yet") from None
        credential = self.credentials.decrypt(account.credentials_encrypted)
        expected_fingerprint = account.credentials_fingerprint
        expected_organization_id = account.organization_id
        expected_account_id = account.id
        seller_id = account.seller_id
        await self.audit.write(
            action="marketplace_account.credentials.used_for_validation",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={"marketplace": account.marketplace},
        )
        # Persist the authorization/audit boundary before the provider call. This
        # also guarantees that no database transaction is held open during I/O.
        await self.session.commit()
        result = await adapter.validate_credentials(credential, seller_id)
        current_result = await self.session.execute(
            select(MarketplaceAccount)
            .join(
                OrganizationUser,
                OrganizationUser.organization_id == MarketplaceAccount.organization_id,
            )
            .where(
                MarketplaceAccount.id == expected_account_id,
                MarketplaceAccount.organization_id == expected_organization_id,
                MarketplaceAccount.credentials_fingerprint == expected_fingerprint,
                MarketplaceAccount.seller_id == seller_id,
                MarketplaceAccount.credentials_status != "revoked",
                OrganizationUser.user_id == actor.id,
                OrganizationUser.status == "active",
                OrganizationUser.role.in_(_ALLOWED_MANAGE_ROLES),
            )
            .with_for_update(of=MarketplaceAccount)
        )
        account = current_result.scalar_one_or_none()
        if account is None:
            raise conflict("Marketplace credentials changed during validation")
        now = datetime.now(UTC)
        validation = result.data if result.ok else None
        if result.ok and validation is None:
            result = AdapterResult[CredentialValidation](
                False,
                error_code="malformed_payload",
                error_message_safe="Marketplace credential validation could not be proven",
            )

        if validation is not None:
            account.status = "active"
            account.credentials_status = "valid"
            account.scopes_json = {
                "scopes": list(validation.scopes),
                "checked_at": now.isoformat(),
            }
            event_status = "success"
            error_code = None
            error_message_safe = None
            action = "marketplace_account.credentials.validated"
        else:
            account.credentials_status = result.error_code or "invalid"
            account.status = "error"
            account.last_error_sync_at = now
            account.error_count = int(account.error_count or 0) + 1
            event_status = "failed"
            error_code = result.error_code
            error_message_safe = result.error_message_safe
            action = "marketplace_account.credentials.validation_failed"

        await self._write_integration_event(
            account=account,
            event_type="credentials.validate",
            status=event_status,
            error_code=error_code,
            error_message_safe=error_message_safe,
        )
        await self.audit.write(
            action=action,
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={
                "marketplace": account.marketplace,
                "status": account.credentials_status,
                "error_code": error_code,
            },
        )
        await self.session.flush()
        return account, result

    def to_response(self, account: MarketplaceAccount) -> MarketplaceAccountResponse:
        return MarketplaceAccountResponse(
            id=account.id,
            organization_id=account.organization_id,
            marketplace=account.marketplace,
            display_name=account.display_name,
            seller_id=account.seller_id,
            status=account.status,
            credentials_masked=self.credentials.mask_fingerprint(account.credentials_fingerprint),
            credentials_status=account.credentials_status,
            scopes_json=account.scopes_json or {},
            default_response_mode=account.default_response_mode,
            last_success_sync_at=account.last_success_sync_at,
            last_error_sync_at=account.last_error_sync_at,
            error_count=account.error_count,
            created_at=account.created_at,
            updated_at=account.updated_at,
        )

    async def _write_integration_event(
        self,
        *,
        account: MarketplaceAccount,
        event_type: str,
        status: str,
        error_code: str | None = None,
        error_message_safe: str | None = None,
    ) -> IntegrationEvent:
        event = IntegrationEvent(
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            marketplace=account.marketplace,
            event_type=event_type,
            status=status,
            error_code=error_code,
            error_message_safe=error_message_safe,
            metadata_json={"credentials_status": account.credentials_status},
        )
        self.session.add(event)
        await self.session.flush()
        return event
