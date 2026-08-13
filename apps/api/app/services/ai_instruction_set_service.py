from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_strategy import ResponseTone
from app.core.errors import conflict, forbidden, not_found
from app.models.ai_instruction_set import AIInstructionSet
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import OrganizationUser
from app.models.user import User
from app.schemas.ai_instruction_set import (
    AIInstructionSetCreateRequest,
    AIInstructionSetResponse,
    AIInstructionSetUpdateRequest,
    InstructionSetStatus,
    InstructionTone,
)
from app.services.audit_service import AuditService
from app.services.seller_settings_service import SellerPromptSettings

_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_WRITE_ROLES = {"owner", "admin"}


class AIInstructionSetService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def ensure_default(
        self,
        *,
        organization_id: UUID,
        actor_user_id: UUID | None = None,
    ) -> AIInstructionSet:
        result = await self.session.execute(
            select(AIInstructionSet).where(
                AIInstructionSet.organization_id == organization_id,
                AIInstructionSet.status == "active",
                AIInstructionSet.is_default.is_(True),
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing
        instruction_set = AIInstructionSet(
            organization_id=organization_id,
            name="Основной набор",
            response_tone="neutral",
            brand_rules=None,
            reply_signature=None,
            prohibited_phrases_json=[],
            status="active",
            is_default=True,
            created_by=actor_user_id,
            updated_by=actor_user_id,
        )
        self.session.add(instruction_set)
        await self.session.flush()
        await self.audit.write(
            action="ai_instruction_set.created",
            entity_type="ai_instruction_set",
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_id=str(instruction_set.id),
            metadata={"default": True},
        )
        return instruction_set

    async def list_for_actor(self, *, organization_id: UUID, actor: User) -> list[AIInstructionSet]:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_READ_ROLES)
        result = await self.session.execute(
            select(AIInstructionSet)
            .where(AIInstructionSet.organization_id == organization_id)
            .order_by(AIInstructionSet.is_default.desc(), AIInstructionSet.status.asc(), AIInstructionSet.name.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        organization_id: UUID,
        actor: User,
        payload: AIInstructionSetCreateRequest,
    ) -> AIInstructionSet:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_WRITE_ROLES)
        instruction_set = AIInstructionSet(
            organization_id=organization_id,
            name=payload.name,
            response_tone=payload.response_tone,
            brand_rules=payload.brand_rules,
            reply_signature=payload.reply_signature,
            prohibited_phrases_json=payload.prohibited_phrases or [],
            status="active",
            is_default=False,
            created_by=actor.id,
            updated_by=actor.id,
        )
        self.session.add(instruction_set)
        await self.session.flush()
        await self.audit.write(
            action="ai_instruction_set.created",
            entity_type="ai_instruction_set",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(instruction_set.id),
            metadata={"name": instruction_set.name},
        )
        return instruction_set

    async def update(
        self,
        *,
        organization_id: UUID,
        instruction_set_id: UUID,
        actor: User,
        payload: AIInstructionSetUpdateRequest,
    ) -> AIInstructionSet:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_WRITE_ROLES)
        result = await self.session.execute(
            select(AIInstructionSet)
            .where(AIInstructionSet.id == instruction_set_id, AIInstructionSet.organization_id == organization_id)
            .with_for_update()
        )
        instruction_set = result.scalar_one_or_none()
        if instruction_set is None:
            raise not_found("AI instruction set not found")

        changes = payload.model_dump(exclude_unset=True)
        if changes.get("status") == "archived":
            if instruction_set.is_default:
                raise conflict("The default AI instruction set cannot be archived")
            assigned = await self.session.execute(
                select(MarketplaceAccount.id)
                .where(MarketplaceAccount.ai_instruction_set_id == instruction_set.id)
                .limit(1)
            )
            if assigned.scalar_one_or_none() is not None:
                raise conflict("An assigned AI instruction set cannot be archived")

        mapping = {
            "name": "name",
            "response_tone": "response_tone",
            "brand_rules": "brand_rules",
            "reply_signature": "reply_signature",
            "prohibited_phrases": "prohibited_phrases_json",
            "status": "status",
        }
        changed_fields: list[str] = []
        for input_name, model_name in mapping.items():
            if input_name not in changes:
                continue
            value = changes[input_name]
            if input_name == "prohibited_phrases" and value is None:
                value = []
            setattr(instruction_set, model_name, value)
            changed_fields.append(input_name)
        if changed_fields:
            instruction_set.updated_by = actor.id
            await self.session.flush()
            await self.audit.write(
                action="ai_instruction_set.updated",
                entity_type="ai_instruction_set",
                organization_id=organization_id,
                actor_user_id=actor.id,
                entity_id=str(instruction_set.id),
                metadata={"changed_fields": changed_fields},
            )
        return instruction_set

    async def make_default(
        self,
        *,
        organization_id: UUID,
        instruction_set_id: UUID,
        actor: User,
    ) -> AIInstructionSet:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_WRITE_ROLES)
        result = await self.session.execute(
            select(AIInstructionSet)
            .where(AIInstructionSet.organization_id == organization_id)
            .order_by(AIInstructionSet.id)
            .with_for_update()
        )
        instruction_sets = list(result.scalars().all())
        target = next((item for item in instruction_sets if item.id == instruction_set_id), None)
        if target is None:
            raise not_found("AI instruction set not found")
        if target.status != "active":
            raise conflict("Only an active AI instruction set can be the default")
        if target.is_default:
            return target
        for item in instruction_sets:
            item.is_default = False
        await self.session.flush()
        target.is_default = True
        target.updated_by = actor.id
        await self.session.flush()
        await self.audit.write(
            action="ai_instruction_set.default_changed",
            entity_type="ai_instruction_set",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(target.id),
            metadata={},
        )
        return target

    async def assign_to_account(
        self,
        *,
        account_id: UUID,
        instruction_set_id: UUID | None,
        actor: User,
    ) -> MarketplaceAccount:
        account_result = await self.session.execute(
            select(MarketplaceAccount).where(MarketplaceAccount.id == account_id).with_for_update()
        )
        account = account_result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        await self._require_role(organization_id=account.organization_id, user_id=actor.id, allowed_roles=_WRITE_ROLES)
        if instruction_set_id is not None:
            set_result = await self.session.execute(
                select(AIInstructionSet).where(
                    AIInstructionSet.id == instruction_set_id,
                    AIInstructionSet.organization_id == account.organization_id,
                    AIInstructionSet.status == "active",
                )
            )
            if set_result.scalar_one_or_none() is None:
                raise not_found("Active AI instruction set not found")
        account.ai_instruction_set_id = instruction_set_id
        await self.session.flush()
        await self.audit.write(
            action="marketplace_account.instruction_set_assigned",
            entity_type="marketplace_account",
            organization_id=account.organization_id,
            actor_user_id=actor.id,
            entity_id=str(account.id),
            metadata={"instruction_set_id": str(instruction_set_id) if instruction_set_id else None},
        )
        return account

    async def resolve_for_account(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
    ) -> SellerPromptSettings:
        if marketplace_account_id is not None:
            account_result = await self.session.execute(
                select(MarketplaceAccount).where(MarketplaceAccount.id == marketplace_account_id)
            )
            account = account_result.scalar_one_or_none()
            if account is None or account.organization_id != organization_id:
                raise not_found("Marketplace account not found")
            if account.ai_instruction_set_id is not None:
                assigned_result = await self.session.execute(
                    select(AIInstructionSet).where(
                        AIInstructionSet.id == account.ai_instruction_set_id,
                        AIInstructionSet.organization_id == organization_id,
                        AIInstructionSet.status == "active",
                    )
                )
                assigned = assigned_result.scalar_one_or_none()
                if assigned is not None:
                    return self._to_prompt_settings(assigned)

        default_result = await self.session.execute(
            select(AIInstructionSet).where(
                AIInstructionSet.organization_id == organization_id,
                AIInstructionSet.status == "active",
                AIInstructionSet.is_default.is_(True),
            )
        )
        default = default_result.scalar_one_or_none()
        if default is None:
            raise conflict("No active default AI instruction set is configured")
        return self._to_prompt_settings(default)

    @staticmethod
    def _to_prompt_settings(instruction_set: AIInstructionSet) -> SellerPromptSettings:
        return SellerPromptSettings(
            response_tone=cast(ResponseTone, instruction_set.response_tone),
            brand_rules=instruction_set.brand_rules,
            reply_signature=instruction_set.reply_signature,
            prohibited_phrases=tuple(str(value) for value in (instruction_set.prohibited_phrases_json or [])),
        )

    @staticmethod
    def to_response(instruction_set: AIInstructionSet) -> AIInstructionSetResponse:
        return AIInstructionSetResponse(
            id=instruction_set.id,
            organization_id=instruction_set.organization_id,
            name=instruction_set.name,
            response_tone=cast(InstructionTone, instruction_set.response_tone),
            brand_rules=instruction_set.brand_rules,
            reply_signature=instruction_set.reply_signature,
            prohibited_phrases=[str(value) for value in (instruction_set.prohibited_phrases_json or [])],
            status=cast(InstructionSetStatus, instruction_set.status),
            is_default=instruction_set.is_default,
            created_by=instruction_set.created_by,
            updated_by=instruction_set.updated_by,
            created_at=instruction_set.created_at,
            updated_at=instruction_set.updated_at,
        )

    async def _require_role(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        allowed_roles: set[str],
    ) -> OrganizationUser:
        result = await self.session.execute(
            select(OrganizationUser).where(
                OrganizationUser.organization_id == organization_id,
                OrganizationUser.user_id == user_id,
                OrganizationUser.status == "active",
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise not_found("Organization membership not found")
        if membership.role not in allowed_roles:
            raise forbidden("You do not have permission to perform this action")
        return membership
