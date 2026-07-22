from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.answer_credit_grant import AnswerCreditGrant
from app.models.answer_ledger_entry import AnswerLedgerEntry
from app.models.answer_package import AnswerPackage
from app.models.answer_reservation import AnswerReservation
from app.models.enums import (
    AnswerGrantSource,
    AnswerLedgerEntryType,
    AnswerPackageKind,
    AnswerReservationStatus,
)
from app.models.marketplace_account import MarketplaceAccount
from app.services.audit_service import AuditService


@dataclass(frozen=True)
class AnswerBalance:
    organization_id: UUID
    available: int
    reserved: int
    total: int
    trial_available: int
    paid_available: int
    trial_expires_at: datetime | None
    marketplace_limit: int | None


@dataclass(frozen=True)
class ReservationDecision:
    allowed: bool
    reservation: AnswerReservation | None
    reason: str | None = None


class AnswerEntitlementService:
    @staticmethod
    def ledger_deltas(entry_type: str, quantity: int) -> tuple[int, int]:
        if quantity <= 0:
            raise ValueError("Ledger quantity must be positive")
        mapping = {
            AnswerLedgerEntryType.GRANT.value: (quantity, quantity),
            AnswerLedgerEntryType.RESERVE.value: (0, -quantity),
            AnswerLedgerEntryType.RELEASE.value: (0, quantity),
            AnswerLedgerEntryType.DEBIT.value: (-quantity, 0),
            AnswerLedgerEntryType.REVERSAL.value: (quantity, quantity),
        }
        try:
            return mapping[entry_type]
        except KeyError as exc:
            raise ValueError(f"Unsupported answer ledger entry type: {entry_type}") from exc

    @staticmethod
    def validate_grant_contract(*, source_type: str, package_kind: str) -> None:
        valid_sources = {item.value for item in AnswerGrantSource}
        if source_type not in valid_sources:
            raise ValueError(f"Unsupported answer grant source: {source_type}")
        if source_type == AnswerGrantSource.TRIAL.value and package_kind != AnswerPackageKind.TRIAL.value:
            raise ValueError("Trial credits must use the trial package")
        if package_kind == AnswerPackageKind.TRIAL.value and source_type != AnswerGrantSource.TRIAL.value:
            raise ValueError("The trial package can only create trial credits")

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def ensure_trial_grant(
        self,
        *,
        organization_id: UUID,
        actor_user_id: UUID | None,
        now: datetime | None = None,
    ) -> AnswerCreditGrant:
        return await self.grant_package(
            organization_id=organization_id,
            package_code="trial-400",
            source_type=AnswerGrantSource.TRIAL.value,
            idempotency_key=f"trial:organization:{organization_id}",
            reference_type="organization",
            reference_id=str(organization_id),
            actor_user_id=actor_user_id,
            now=now,
            metadata={"trial_contract": "7_days_400_answers_2_marketplaces"},
        )

    async def grant_package(
        self,
        *,
        organization_id: UUID,
        package_code: str,
        source_type: str,
        idempotency_key: str,
        reference_type: str | None,
        reference_id: str | None,
        actor_user_id: UUID | None,
        quantity_override: int | None = None,
        now: datetime | None = None,
        metadata: dict[str, object] | None = None,
    ) -> AnswerCreditGrant:
        current = now or datetime.now(UTC)
        existing_result = await self.session.execute(
            select(AnswerCreditGrant).where(
                AnswerCreditGrant.organization_id == organization_id,
                AnswerCreditGrant.idempotency_key == idempotency_key,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            return existing

        package_result = await self.session.execute(
            select(AnswerPackage).where(
                AnswerPackage.code == package_code,
                AnswerPackage.is_active.is_(True),
            )
        )
        package = package_result.scalar_one_or_none()
        if package is None:
            raise RuntimeError(f"Answer package is not configured: {package_code}")
        self.validate_grant_contract(source_type=source_type, package_kind=package.kind)

        quantity = quantity_override if quantity_override is not None else package.answer_count
        if quantity is None or quantity <= 0:
            raise ValueError("A positive answer quantity is required for this package grant")
        expires_at = current + timedelta(days=package.validity_days) if package.validity_days is not None else None
        grant = AnswerCreditGrant(
            organization_id=organization_id,
            package_id=package.id,
            source_type=source_type,
            original_quantity=quantity,
            remaining_quantity=quantity,
            expires_at=expires_at,
            reference_type=reference_type,
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            granted_by_user_id=actor_user_id,
            metadata_json=metadata or {},
        )
        self.session.add(grant)
        await self.session.flush()
        balance_delta, available_delta = self.ledger_deltas(AnswerLedgerEntryType.GRANT.value, quantity)
        await self._append_ledger(
            organization_id=organization_id,
            grant_id=grant.id,
            reservation_id=None,
            reply_id=None,
            entry_type=AnswerLedgerEntryType.GRANT.value,
            balance_delta=balance_delta,
            available_delta=available_delta,
            idempotency_key=f"ledger:{idempotency_key}",
            actor_user_id=actor_user_id,
            reason=source_type,
            metadata={"package_code": package.code, **(metadata or {})},
        )
        await self.audit.write(
            action="answer_balance.granted",
            entity_type="answer_credit_grant",
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_id=str(grant.id),
            metadata={
                "package_code": package.code,
                "source_type": source_type,
                "quantity": quantity,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "reference_type": reference_type,
                "reference_id": reference_id,
            },
        )
        return grant

    async def get_balance(self, *, organization_id: UUID, now: datetime | None = None) -> AnswerBalance:
        current = now or datetime.now(UTC)
        eligible_grant = or_(AnswerCreditGrant.expires_at.is_(None), AnswerCreditGrant.expires_at > current)

        async def remaining_for(source_type: str | None = None) -> int:
            stmt = select(func.coalesce(func.sum(AnswerCreditGrant.remaining_quantity), 0)).where(
                AnswerCreditGrant.organization_id == organization_id,
                eligible_grant,
            )
            if source_type is not None:
                stmt = stmt.where(AnswerCreditGrant.source_type == source_type)
            result = await self.session.execute(stmt)
            return int(result.scalar_one())

        async def recoverable_for(source_type: str | None = None) -> int:
            stmt = (
                select(func.coalesce(func.sum(AnswerReservation.quantity), 0))
                .join(AnswerCreditGrant, AnswerCreditGrant.id == AnswerReservation.grant_id)
                .where(
                    AnswerReservation.organization_id == organization_id,
                    AnswerReservation.status == AnswerReservationStatus.ACTIVE.value,
                    AnswerReservation.expires_at <= current,
                    eligible_grant,
                )
            )
            if source_type is not None:
                stmt = stmt.where(AnswerCreditGrant.source_type == source_type)
            result = await self.session.execute(stmt)
            return int(result.scalar_one())

        trial_available = await remaining_for(AnswerGrantSource.TRIAL.value) + await recoverable_for(
            AnswerGrantSource.TRIAL.value
        )
        paid_available = await remaining_for(None) - await remaining_for(AnswerGrantSource.TRIAL.value)
        paid_available += await recoverable_for(None) - await recoverable_for(AnswerGrantSource.TRIAL.value)
        available = trial_available + paid_available

        active_reservation_result = await self.session.execute(
            select(func.coalesce(func.sum(AnswerReservation.quantity), 0)).where(
                AnswerReservation.organization_id == organization_id,
                AnswerReservation.status == AnswerReservationStatus.ACTIVE.value,
                AnswerReservation.expires_at > current,
            )
        )
        reserved = int(active_reservation_result.scalar_one())

        trial_expiry_result = await self.session.execute(
            select(func.max(AnswerCreditGrant.expires_at)).where(
                AnswerCreditGrant.organization_id == organization_id,
                AnswerCreditGrant.source_type == AnswerGrantSource.TRIAL.value,
                eligible_grant,
            )
        )
        trial_expires_at = trial_expiry_result.scalar_one_or_none()

        paid_grant_result = await self.session.execute(
            select(func.count(AnswerCreditGrant.id)).where(
                AnswerCreditGrant.organization_id == organization_id,
                AnswerCreditGrant.source_type != AnswerGrantSource.TRIAL.value,
                eligible_grant,
            )
        )
        has_paid_grant = int(paid_grant_result.scalar_one()) > 0
        marketplace_limit = (
            None
            if has_paid_grant
            else (await self._trial_marketplace_limit(organization_id=organization_id, now=current) or 0)
        )
        return AnswerBalance(
            organization_id=organization_id,
            available=available,
            reserved=reserved,
            total=available + reserved,
            trial_available=trial_available,
            paid_available=paid_available,
            trial_expires_at=trial_expires_at,
            marketplace_limit=marketplace_limit,
        )

    async def can_connect_marketplace(self, *, organization_id: UUID, now: datetime | None = None) -> bool:
        balance = await self.get_balance(organization_id=organization_id, now=now)
        if balance.marketplace_limit is None:
            return True
        count_result = await self.session.execute(
            select(func.count(MarketplaceAccount.id)).where(
                MarketplaceAccount.organization_id == organization_id,
                MarketplaceAccount.status != "revoked",
            )
        )
        return int(count_result.scalar_one()) < balance.marketplace_limit

    async def reserve_for_reply(
        self,
        *,
        organization_id: UUID,
        reply_id: UUID,
        actor_user_id: UUID | None,
        now: datetime | None = None,
    ) -> ReservationDecision:
        current = now or datetime.now(UTC)
        await self._release_expired_reservations(organization_id=organization_id, now=current)
        existing_result = await self.session.execute(
            select(AnswerReservation).where(AnswerReservation.reply_id == reply_id).with_for_update()
        )
        reservation = existing_result.scalar_one_or_none()
        if reservation is not None and reservation.status == AnswerReservationStatus.ACTIVE.value:
            return ReservationDecision(True, reservation)
        if reservation is not None and reservation.status == AnswerReservationStatus.SETTLED.value:
            return ReservationDecision(False, reservation, "answer_already_debited")

        grant_result = await self.session.execute(
            select(AnswerCreditGrant)
            .where(
                AnswerCreditGrant.organization_id == organization_id,
                AnswerCreditGrant.remaining_quantity > 0,
                or_(AnswerCreditGrant.expires_at.is_(None), AnswerCreditGrant.expires_at > current),
            )
            .order_by(AnswerCreditGrant.expires_at.asc().nulls_last(), AnswerCreditGrant.created_at.asc())
            .limit(1)
            .with_for_update()
        )
        grant = grant_result.scalar_one_or_none()
        if grant is None:
            return ReservationDecision(False, None, "answer_balance_exhausted")

        grant.remaining_quantity -= 1
        expires_at = current + timedelta(seconds=get_settings().answer_reservation_ttl_seconds)
        if reservation is None:
            reservation = AnswerReservation(
                organization_id=organization_id,
                reply_id=reply_id,
                grant_id=grant.id,
                quantity=1,
                status=AnswerReservationStatus.ACTIVE.value,
                revision=1,
                idempotency_key=f"answer:reply:{reply_id}",
                expires_at=expires_at,
                metadata_json={},
            )
            self.session.add(reservation)
        else:
            reservation.grant_id = grant.id
            reservation.status = AnswerReservationStatus.ACTIVE.value
            reservation.revision += 1
            reservation.expires_at = expires_at
            reservation.settled_at = None
            reservation.released_at = None
            reservation.release_reason = None
        await self.session.flush()
        balance_delta, available_delta = self.ledger_deltas(AnswerLedgerEntryType.RESERVE.value, 1)
        await self._append_ledger(
            organization_id=organization_id,
            grant_id=grant.id,
            reservation_id=reservation.id,
            reply_id=reply_id,
            entry_type=AnswerLedgerEntryType.RESERVE.value,
            balance_delta=balance_delta,
            available_delta=available_delta,
            idempotency_key=f"ledger:reserve:{reply_id}:{reservation.revision}",
            actor_user_id=actor_user_id,
            reason="reply_publish_reservation",
            metadata={"reservation_expires_at": expires_at.isoformat()},
        )
        await self.audit.write(
            action="answer_balance.reserved",
            entity_type="answer_reservation",
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_id=str(reservation.id),
            metadata={"reply_id": str(reply_id), "grant_id": str(grant.id), "revision": reservation.revision},
        )
        return ReservationDecision(True, reservation)

    async def settle_for_reply(
        self,
        *,
        organization_id: UUID,
        reply_id: UUID,
        actor_user_id: UUID | None,
        now: datetime | None = None,
    ) -> AnswerReservation | None:
        current = now or datetime.now(UTC)
        reservation = await self._reservation_for_update(reply_id)
        if reservation is None:
            return None
        if reservation.status == AnswerReservationStatus.SETTLED.value:
            return reservation
        if reservation.status != AnswerReservationStatus.ACTIVE.value:
            return None
        reservation.status = AnswerReservationStatus.SETTLED.value
        reservation.settled_at = current
        balance_delta, available_delta = self.ledger_deltas(
            AnswerLedgerEntryType.DEBIT.value, reservation.quantity
        )
        await self._append_ledger(
            organization_id=organization_id,
            grant_id=reservation.grant_id,
            reservation_id=reservation.id,
            reply_id=reply_id,
            entry_type=AnswerLedgerEntryType.DEBIT.value,
            balance_delta=balance_delta,
            available_delta=available_delta,
            idempotency_key=f"ledger:debit:{reply_id}",
            actor_user_id=actor_user_id,
            reason="marketplace_publish_succeeded",
            metadata={"reservation_revision": reservation.revision},
        )
        await self.audit.write(
            action="answer_balance.debited",
            entity_type="answer_reservation",
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_id=str(reservation.id),
            metadata={"reply_id": str(reply_id), "quantity": reservation.quantity},
        )
        return reservation

    async def release_for_reply(
        self,
        *,
        organization_id: UUID,
        reply_id: UUID,
        reason: str,
        actor_user_id: UUID | None,
        now: datetime | None = None,
    ) -> AnswerReservation | None:
        reservation = await self._reservation_for_update(reply_id)
        if reservation is None or reservation.status != AnswerReservationStatus.ACTIVE.value:
            return reservation
        await self._release_locked(
            reservation=reservation,
            organization_id=organization_id,
            reason=reason,
            actor_user_id=actor_user_id,
            now=now or datetime.now(UTC),
        )
        return reservation

    async def _release_expired_reservations(self, *, organization_id: UUID, now: datetime) -> None:
        result = await self.session.execute(
            select(AnswerReservation)
            .where(
                AnswerReservation.organization_id == organization_id,
                AnswerReservation.status == AnswerReservationStatus.ACTIVE.value,
                AnswerReservation.expires_at <= now,
            )
            .with_for_update()
        )
        for reservation in result.scalars().all():
            await self._release_locked(
                reservation=reservation,
                organization_id=organization_id,
                reason="reservation_expired",
                actor_user_id=None,
                now=now,
                expired=True,
            )

    async def _release_locked(
        self,
        *,
        reservation: AnswerReservation,
        organization_id: UUID,
        reason: str,
        actor_user_id: UUID | None,
        now: datetime,
        expired: bool = False,
    ) -> None:
        grant_result = await self.session.execute(
            select(AnswerCreditGrant).where(AnswerCreditGrant.id == reservation.grant_id).with_for_update()
        )
        grant = grant_result.scalar_one()
        grant.remaining_quantity += reservation.quantity
        reservation.status = (
            AnswerReservationStatus.EXPIRED.value if expired else AnswerReservationStatus.RELEASED.value
        )
        reservation.released_at = now
        reservation.release_reason = reason
        balance_delta, available_delta = self.ledger_deltas(
            AnswerLedgerEntryType.RELEASE.value, reservation.quantity
        )
        await self._append_ledger(
            organization_id=organization_id,
            grant_id=grant.id,
            reservation_id=reservation.id,
            reply_id=reservation.reply_id,
            entry_type=AnswerLedgerEntryType.RELEASE.value,
            balance_delta=balance_delta,
            available_delta=available_delta,
            idempotency_key=f"ledger:release:{reservation.reply_id}:{reservation.revision}",
            actor_user_id=actor_user_id,
            reason=reason,
            metadata={"expired": expired},
        )
        await self.audit.write(
            action="answer_balance.reservation_released",
            entity_type="answer_reservation",
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_id=str(reservation.id),
            metadata={"reply_id": str(reservation.reply_id), "reason": reason, "expired": expired},
        )

    async def _reservation_for_update(self, reply_id: UUID) -> AnswerReservation | None:
        result = await self.session.execute(
            select(AnswerReservation).where(AnswerReservation.reply_id == reply_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def _trial_marketplace_limit(self, *, organization_id: UUID, now: datetime) -> int | None:
        result = await self.session.execute(
            select(func.max(AnswerPackage.marketplace_limit))
            .join(AnswerCreditGrant, AnswerCreditGrant.package_id == AnswerPackage.id)
            .where(
                AnswerCreditGrant.organization_id == organization_id,
                AnswerPackage.kind == AnswerPackageKind.TRIAL.value,
                or_(AnswerCreditGrant.expires_at.is_(None), AnswerCreditGrant.expires_at > now),
            )
        )
        value = result.scalar_one_or_none()
        return int(value) if value is not None else None

    async def _append_ledger(
        self,
        *,
        organization_id: UUID,
        grant_id: UUID | None,
        reservation_id: UUID | None,
        reply_id: UUID | None,
        entry_type: str,
        balance_delta: int,
        available_delta: int,
        idempotency_key: str,
        actor_user_id: UUID | None,
        reason: str | None,
        metadata: dict[str, object],
    ) -> AnswerLedgerEntry:
        existing_result = await self.session.execute(
            select(AnswerLedgerEntry).where(
                AnswerLedgerEntry.organization_id == organization_id,
                AnswerLedgerEntry.idempotency_key == idempotency_key,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            return existing
        entry = AnswerLedgerEntry(
            organization_id=organization_id,
            grant_id=grant_id,
            reservation_id=reservation_id,
            reply_id=reply_id,
            entry_type=entry_type,
            balance_delta=balance_delta,
            available_delta=available_delta,
            idempotency_key=idempotency_key,
            actor_user_id=actor_user_id,
            reason=reason,
            metadata_json=metadata,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry
