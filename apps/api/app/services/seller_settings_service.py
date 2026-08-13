from __future__ import annotations

from dataclasses import dataclass
from typing import cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_strategy import ResponseTone
from app.core.errors import forbidden, not_found
from app.models.organization import OrganizationUser
from app.models.seller_settings import SellerSettings
from app.models.user import User
from app.schemas.seller_settings import SellerSettingsUpdateRequest
from app.services.audit_service import AuditService

_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_WRITE_ROLES = {"owner", "admin"}


@dataclass(frozen=True)
class SellerPromptSettings:
    response_tone: ResponseTone = "neutral"
    brand_rules: str | None = None
    knowledge_base: str | None = None
    reply_signature: str | None = None
    prohibited_phrases: tuple[str, ...] = ()

    @property
    def has_customizations(self) -> bool:
        return any(
            (
                self.response_tone != "neutral",
                bool(self.brand_rules),
                bool(self.knowledge_base),
                bool(self.reply_signature),
                bool(self.prohibited_phrases),
            )
        )

    def resolve(
        self,
        *,
        tone_override: ResponseTone | None,
        brand_rules_override: str | None,
        knowledge_base_override: str | None,
    ) -> tuple[ResponseTone, str | None, str | None]:
        resolved_tone = tone_override or self.response_tone
        brand_sections: list[str] = []
        if self.brand_rules:
            brand_sections.append(self.brand_rules)
        if brand_rules_override:
            brand_sections.append(brand_rules_override.strip())
        if self.prohibited_phrases:
            brand_sections.append(
                "\u041d\u0435 используй фразы: " + "; ".join(self.prohibited_phrases) + "."
            )
        if self.reply_signature:
            brand_sections.append(f"Заверши ответ подписью: {self.reply_signature}")
        resolved_brand_rules = "\n".join(section for section in brand_sections if section) or None
        resolved_knowledge_base = (
            knowledge_base_override.strip()
            if knowledge_base_override is not None and knowledge_base_override.strip()
            else self.knowledge_base
        )
        return resolved_tone, resolved_brand_rules, resolved_knowledge_base

    def resolve_policy(
        self,
        *,
        tone_override: ResponseTone | None,
        brand_rules_override: str | None,
    ) -> tuple[ResponseTone, str | None]:
        resolved_tone, resolved_brand_rules, _ = self.resolve(
            tone_override=tone_override,
            brand_rules_override=brand_rules_override,
            knowledge_base_override=None,
        )
        return resolved_tone, resolved_brand_rules

    def policy_flags(self, draft_text: str) -> list[str]:
        normalized_draft = draft_text.casefold()
        for phrase in self.prohibited_phrases:
            normalized_phrase = phrase.strip().casefold()
            if normalized_phrase and normalized_phrase in normalized_draft:
                return ["seller_prohibited_phrase"]
        return []


class SellerSettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def ensure_defaults(
        self,
        *,
        organization_id: UUID,
        actor_user_id: UUID | None = None,
    ) -> SellerSettings:
        statement = (
            insert(SellerSettings)
            .values(
                organization_id=organization_id,
                response_tone="neutral",
                prohibited_phrases_json=[],
                created_by=actor_user_id,
                updated_by=actor_user_id,
            )
            .on_conflict_do_nothing(index_elements=["organization_id"])
        )
        await self.session.execute(statement)
        result = await self.session.execute(
            select(SellerSettings).where(SellerSettings.organization_id == organization_id)
        )
        return result.scalar_one()

    async def get_for_actor(self, *, organization_id: UUID, actor: User) -> SellerSettings:
        await self._require_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        return await self.ensure_defaults(organization_id=organization_id, actor_user_id=actor.id)

    async def update(
        self,
        *,
        organization_id: UUID,
        actor: User,
        payload: SellerSettingsUpdateRequest,
    ) -> SellerSettings:
        await self._require_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )
        settings = await self.ensure_defaults(organization_id=organization_id, actor_user_id=actor.id)
        changes = payload.model_dump(exclude_unset=True)
        changed_fields: list[str] = []

        field_mapping = {
            "response_tone": "response_tone",
            "brand_rules": "brand_rules",
            "knowledge_base": "knowledge_base",
            "reply_signature": "reply_signature",
            "prohibited_phrases": "prohibited_phrases_json",
        }
        for input_name, model_name in field_mapping.items():
            if input_name not in changes:
                continue
            value = changes[input_name]
            if input_name == "prohibited_phrases" and value is None:
                value = []
            setattr(settings, model_name, value)
            changed_fields.append(input_name)

        if changed_fields:
            settings.updated_by = actor.id
            await self.session.flush()
            await self.audit.write(
                action="seller_settings.updated",
                entity_type="seller_settings",
                organization_id=organization_id,
                actor_user_id=actor.id,
                entity_id=str(settings.id),
                metadata={"changed_fields": changed_fields},
            )
        return settings

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

    async def get_prompt_settings(self, *, organization_id: UUID) -> SellerPromptSettings:
        result = await self.session.execute(
            select(SellerSettings).where(SellerSettings.organization_id == organization_id)
        )
        settings = result.scalar_one_or_none()
        if settings is None:
            return SellerPromptSettings()
        return SellerPromptSettings(
            response_tone=cast(ResponseTone, settings.response_tone),
            brand_rules=settings.brand_rules,
            knowledge_base=settings.knowledge_base,
            reply_signature=settings.reply_signature,
            prohibited_phrases=tuple(str(value) for value in (settings.prohibited_phrases_json or [])),
        )
