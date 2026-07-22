from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # noqa: F401
from app.models.base import Base
from app.automation.state_machine import ensure_reply_transition
from app.models.answer_reservation import AnswerReservation
from app.models.enums import AnswerLedgerEntryType, AnswerReservationStatus, ReplyStatus
from app.schemas.billing import AnswerBalanceResponse
from app.services.answer_entitlement_service import AnswerEntitlementService

API_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = API_ROOT.parents[1]


class _StubScalars:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def all(self) -> list[object]:
        return self.values


class _StubResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one(self) -> object:
        return self.value

    def scalar_one_or_none(self) -> object:
        return self.value

    def scalars(self) -> _StubScalars:
        if not isinstance(self.value, list):
            raise AssertionError("Stub result does not contain a scalar collection")
        return _StubScalars(self.value)


class _StubSession:
    def __init__(self, responses: list[object]) -> None:
        self.responses = responses
        self.executed = 0

    async def execute(self, _statement: object) -> _StubResult:
        if not self.responses:
            raise AssertionError("Unexpected database query")
        self.executed += 1
        return _StubResult(self.responses.pop(0))


@pytest.mark.parametrize(
    ("entry_type", "expected"),
    [
        (AnswerLedgerEntryType.GRANT.value, (5, 5)),
        (AnswerLedgerEntryType.RESERVE.value, (0, -5)),
        (AnswerLedgerEntryType.RELEASE.value, (0, 5)),
        (AnswerLedgerEntryType.DEBIT.value, (-5, 0)),
        (AnswerLedgerEntryType.REVERSAL.value, (5, 5)),
    ],
)
def test_ledger_deltas_keep_balance_and_availability_separate(entry_type: str, expected: tuple[int, int]) -> None:
    assert AnswerEntitlementService.ledger_deltas(entry_type, 5) == expected


def test_ledger_deltas_reject_invalid_quantity_and_type() -> None:
    with pytest.raises(ValueError, match="positive"):
        AnswerEntitlementService.ledger_deltas(AnswerLedgerEntryType.GRANT.value, 0)
    with pytest.raises(ValueError, match="Unsupported"):
        AnswerEntitlementService.ledger_deltas("unknown", 1)


def test_grant_contract_rejects_trial_source_package_mismatches() -> None:
    AnswerEntitlementService.validate_grant_contract(source_type="trial", package_kind="trial")
    AnswerEntitlementService.validate_grant_contract(source_type="purchase", package_kind="paid")

    with pytest.raises(ValueError, match="Unsupported"):
        AnswerEntitlementService.validate_grant_contract(source_type="unknown", package_kind="paid")
    with pytest.raises(ValueError, match="must use the trial package"):
        AnswerEntitlementService.validate_grant_contract(source_type="trial", package_kind="paid")
    with pytest.raises(ValueError, match="only create trial credits"):
        AnswerEntitlementService.validate_grant_contract(source_type="purchase", package_kind="trial")


def test_answer_ledger_models_have_database_idempotency_guards() -> None:
    grants = Base.metadata.tables["answer_credit_grants"]
    reservations = Base.metadata.tables["answer_reservations"]
    ledger = Base.metadata.tables["answer_ledger_entries"]

    grant_constraints = {constraint.name for constraint in grants.constraints}
    reservation_constraints = {constraint.name for constraint in reservations.constraints}
    ledger_constraints = {constraint.name for constraint in ledger.constraints}

    assert "uq_answer_credit_grants_org_idempotency" in grant_constraints
    assert "uq_answer_credit_grants_one_trial_per_org" in {index.name for index in grants.indexes}
    assert "uq_answer_reservations_reply" in reservation_constraints
    assert "uq_answer_reservations_org_idempotency" in reservation_constraints
    assert "uq_answer_ledger_entries_org_idempotency" in ledger_constraints
    assert "updated_at" not in ledger.c

    assert next(iter(reservations.c.reply_id.foreign_keys)).ondelete == "RESTRICT"
    assert next(iter(ledger.c.organization_id.foreign_keys)).ondelete == "RESTRICT"
    assert next(iter(ledger.c.reservation_id.foreign_keys)).ondelete == "RESTRICT"
    assert next(iter(ledger.c.reply_id.foreign_keys)).ondelete == "RESTRICT"


def test_answer_balance_schema_distinguishes_no_entitlement_from_unlimited_paid_access() -> None:
    organization_id = uuid4()
    no_entitlement = AnswerBalanceResponse(
        organization_id=organization_id,
        available=0,
        reserved=0,
        total=0,
        trial_available=0,
        paid_available=0,
        trial_expires_at=None,
        marketplace_limit=0,
    )
    paid = no_entitlement.model_copy(update={"available": 500, "total": 500, "paid_available": 500, "marketplace_limit": None})

    assert no_entitlement.marketplace_limit == 0
    assert paid.marketplace_limit is None


@pytest.mark.asyncio
async def test_balance_projection_keeps_active_reservations_in_total() -> None:
    organization_id = uuid4()
    expiry = datetime.now(UTC) + timedelta(days=7)
    session = _StubSession([398, 0, 398, 398, 0, 0, 2, expiry, 0, 2])
    service = AnswerEntitlementService(cast(AsyncSession, session))

    balance = await service.get_balance(organization_id=organization_id)

    assert balance.available == 398
    assert balance.reserved == 2
    assert balance.total == 400
    assert balance.trial_available == 398
    assert balance.paid_available == 0
    assert balance.trial_expires_at == expiry
    assert balance.marketplace_limit == 2
    assert session.executed == 10


@pytest.mark.asyncio
async def test_paid_grant_removes_trial_marketplace_cap() -> None:
    organization_id = uuid4()
    session = _StubSession([0, 0, 500, 0, 0, 0, 0, None, 1])
    service = AnswerEntitlementService(cast(AsyncSession, session))

    balance = await service.get_balance(organization_id=organization_id)

    assert balance.available == 500
    assert balance.total == 500
    assert balance.trial_available == 0
    assert balance.paid_available == 500
    assert balance.marketplace_limit is None
    assert session.executed == 9


@pytest.mark.asyncio
async def test_reservation_is_denied_without_available_grant() -> None:
    session = _StubSession([[], None, None])
    service = AnswerEntitlementService(cast(AsyncSession, session))

    decision = await service.reserve_for_reply(
        organization_id=uuid4(),
        reply_id=uuid4(),
        actor_user_id=None,
    )

    assert decision.allowed is False
    assert decision.reservation is None
    assert decision.reason == "answer_balance_exhausted"
    assert session.executed == 3


@pytest.mark.asyncio
async def test_active_reply_reservation_is_idempotently_reused() -> None:
    reservation = AnswerReservation(
        organization_id=uuid4(),
        reply_id=uuid4(),
        grant_id=uuid4(),
        quantity=1,
        status=AnswerReservationStatus.ACTIVE.value,
        revision=1,
        idempotency_key="answer:reply:test",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        metadata_json={},
    )
    session = _StubSession([[], reservation])
    service = AnswerEntitlementService(cast(AsyncSession, session))

    decision = await service.reserve_for_reply(
        organization_id=reservation.organization_id,
        reply_id=reservation.reply_id,
        actor_user_id=None,
    )

    assert decision.allowed is True
    assert decision.reservation is reservation
    assert decision.reason is None
    assert session.executed == 2


def test_migration_seeds_the_public_package_contract_and_existing_trials() -> None:
    source = (API_ROOT / "alembic" / "versions" / "20260722_0010_answer_ledger_foundation.py").read_text(encoding="utf-8")

    for token in [
        "'trial-400', 'Trial', 'trial', 400, 0",
        "'start-500', 'Старт', 'paid', 500, 116000",
        "'optimal-5000', 'Оптимальный', 'paid', 5000, 629000",
        "'business-10000', 'Бизнес', 'paid', 10000, 899000",
        "'scale-15000', 'Масштаб', 'paid', 15000, 1259000",
        "'enterprise-custom', 'Enterprise', 'custom'",
        "now() + interval '7 days'",
        "'trial:organization:' || organization.id::text",
        "CREATE TRIGGER trg_answer_ledger_entries_append_only",
        "CREATE TRIGGER trg_answer_ledger_entries_no_truncate",
        "answer_ledger_entries is append-only",
    ]:
        assert token in source


def test_reply_execution_reserves_before_network_and_debits_only_after_success() -> None:
    source = (API_ROOT / "app" / "services" / "reply_execution_service.py").read_text(encoding="utf-8")

    reserve = source.index("await self.entitlements.reserve_for_reply")
    transition_to_sending = source.index("self._transition_reply(reply, ReplyStatus.SENDING.value)", reserve)
    adapter_send = source.index("result = await self._send_through_adapter", transition_to_sending)
    settle = source.index("await self.entitlements.settle_for_reply", adapter_send)
    mark_sent = source.index("await self._mark_sent(", settle)

    assert reserve < transition_to_sending < adapter_send < settle < mark_sent
    assert 'reason="externally_already_answered"' in source
    assert "await self.entitlements.release_for_reply" in source
    assert 'action="answer_balance.publish_blocked"' in source



@pytest.mark.parametrize(
    "source_status",
    [ReplyStatus.SENDING.value, ReplyStatus.RETRY_PENDING.value, ReplyStatus.FAILED.value],
)
def test_balance_exhaustion_can_move_retryable_replies_to_manual_review(source_status: str) -> None:
    ensure_reply_transition(source_status, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)

def test_integrity_contract_tracks_answer_ledger_head() -> None:
    integrity_source = (REPOSITORY_ROOT / "scripts" / "check_integrity.py").read_text(encoding="utf-8")
    assert 'EXPECTED_ALEMBIC_HEAD = "20260722_0010"' in integrity_source
