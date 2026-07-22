from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import cast
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # noqa: F401
from app.adapters.base import AdapterResult
from app.adapters.capabilities import get_marketplace_capability, list_marketplace_capabilities
from app.adapters.registry import get_marketplace_adapter
from app.adapters.wildberries import WildberriesAdapter
from app.models.base import Base
from app.models.enums import Marketplace, MarketplaceSyncStateStatus, MarketplaceSyncStream, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.marketplace_scheduler_service import MarketplaceSchedulerService, retry_delay_seconds

API_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = API_ROOT.parents[1]


class _Scalars:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def all(self) -> list[object]:
        return self.values


class _Result:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def scalars(self) -> _Scalars:
        return _Scalars(self.values)


class _FakeSession:
    def __init__(self, execute_results: list[list[object]] | None = None) -> None:
        self.execute_results = list(execute_results or [])
        self.added: list[object] = []
        self.flush_count = 0
        self.execute_count = 0

    async def execute(self, _statement: object) -> _Result:
        self.execute_count += 1
        values = self.execute_results.pop(0) if self.execute_results else []
        return _Result(values)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1


def _marketplace_account(marketplace: Marketplace = Marketplace.WILDBERRIES) -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=marketplace.value,
        display_name=f"{marketplace.value} test",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        status="active",
        credentials_status="valid",
        scopes_json={},
        default_response_mode="inherit",
        error_count=0,
    )


def test_capability_registry_exposes_every_marketplace_once() -> None:
    capabilities = list_marketplace_capabilities()

    assert [capability.marketplace for capability in capabilities] == list(Marketplace)
    assert len({capability.marketplace for capability in capabilities}) == len(Marketplace)


def test_only_wildberries_is_enabled_in_current_backend() -> None:
    enabled = [capability for capability in list_marketplace_capabilities() if capability.connection_enabled]

    assert [capability.marketplace for capability in enabled] == [Marketplace.WILDBERRIES]
    assert enabled[0].message_types == (MessageType.REVIEW, MessageType.QUESTION)
    assert enabled[0].scheduler_enabled is True


@pytest.mark.parametrize("marketplace", [Marketplace.OZON, Marketplace.YANDEX_MARKET, Marketplace.AVITO])
def test_unimplemented_marketplaces_remain_planned(marketplace: Marketplace) -> None:
    capability = get_marketplace_capability(marketplace)

    assert capability.integration_status == "planned"
    assert capability.operations == ()
    assert capability.polling_enabled is False


def test_registry_builds_only_the_enabled_adapter() -> None:
    assert isinstance(get_marketplace_adapter(Marketplace.WILDBERRIES), WildberriesAdapter)

    with pytest.raises(HTTPException) as exc_info:
        get_marketplace_adapter(Marketplace.OZON)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_wildberries_validation_uses_ping_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = WildberriesAdapter()
    request: dict[str, object] = {}

    async def fake_get(
        path: str,
        credential: str,
        params: dict[str, str | int] | None,
    ) -> AdapterResult:
        request.update(path=path, credential=credential, params=params)
        return AdapterResult(ok=True, data={"Status": "OK"})

    monkeypatch.setattr(adapter, "_get", fake_get)

    result = await adapter.validate_credentials("token")

    assert result.ok is True
    assert request == {"path": "/ping", "credential": "token", "params": None}


def test_wildberries_offset_cursor_advances_only_for_full_page() -> None:
    failed_page = WildberriesAdapter._with_next_cursor(
        result=AdapterResult(ok=False, error_code="network_error"),
        item_count=50,
        offset=100,
    )
    full_page = WildberriesAdapter._with_next_cursor(
        result=AdapterResult(ok=True, data={}),
        item_count=50,
        offset=100,
    )
    final_page = WildberriesAdapter._with_next_cursor(
        result=AdapterResult(ok=True, data={}),
        item_count=12,
        offset=150,
    )

    assert failed_page.ok is False
    assert failed_page.next_cursor is None
    assert full_page.next_cursor == "150"
    assert final_page.next_cursor is None


@pytest.mark.parametrize(
    ("failures", "expected"),
    [(0, 60), (1, 60), (2, 120), (3, 240), (7, 3600), (20, 3600)],
)
def test_scheduler_retry_backoff_is_bounded(failures: int, expected: int) -> None:
    assert retry_delay_seconds(failures) == expected


@pytest.mark.asyncio
async def test_scheduler_creates_two_active_stream_states() -> None:
    session = _FakeSession(execute_results=[[]])
    service = MarketplaceSchedulerService(cast(AsyncSession, session))
    account = _marketplace_account()
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)

    states = await service.ensure_account_states(account=account, activate=True, now=now)

    assert [state.stream for state in states] == ["reviews", "questions"]
    assert all(state.status == MarketplaceSyncStateStatus.IDLE.value for state in states)
    assert all(state.next_run_at == now for state in states)
    assert session.added == states
    assert session.flush_count == 1


@pytest.mark.asyncio
async def test_scheduler_does_not_create_states_for_planned_adapter() -> None:
    session = _FakeSession()
    service = MarketplaceSchedulerService(cast(AsyncSession, session))

    states = await service.ensure_account_states(
        account=_marketplace_account(Marketplace.OZON),
        activate=True,
    )

    assert states == []
    assert session.execute_count == 0
    assert session.added == []


@pytest.mark.asyncio
async def test_scheduler_pauses_existing_states_and_clears_lease() -> None:
    account = _marketplace_account()
    states = [
        MarketplaceSyncState(
            id=uuid4(),
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            stream=stream,
            status=MarketplaceSyncStateStatus.LEASED.value,
            next_run_at=datetime(2026, 7, 22, 12, 0, tzinfo=UTC),
            lease_token=uuid4(),
            lease_expires_at=datetime(2026, 7, 22, 12, 3, tzinfo=UTC),
            consecutive_failures=0,
            metadata_json={},
        )
        for stream in ("reviews", "questions")
    ]
    session = _FakeSession(execute_results=[cast(list[object], states)])
    service = MarketplaceSchedulerService(cast(AsyncSession, session))

    await service.pause_account_states(account_id=account.id)

    assert all(state.status == MarketplaceSyncStateStatus.PAUSED.value for state in states)
    assert all(state.next_run_at is None for state in states)
    assert all(state.lease_token is None for state in states)
    assert all(state.lease_expires_at is None for state in states)
    assert session.flush_count == 1


def test_sync_state_model_has_one_row_per_account_stream() -> None:
    constraints = MarketplaceSyncState.__table__.constraints
    unique_constraints = [constraint for constraint in constraints if isinstance(constraint, UniqueConstraint)]

    assert any(
        constraint.name == "uq_marketplace_sync_states_account_stream"
        for constraint in unique_constraints
    )
    assert MarketplaceSyncState.__tablename__ in Base.metadata.tables


def test_sync_state_enums_are_closed() -> None:
    assert {stream.value for stream in MarketplaceSyncStream} == {"reviews", "questions"}
    assert {status.value for status in MarketplaceSyncStateStatus} == {"idle", "leased", "error", "paused"}


def test_scheduler_configuration_has_safe_bounds() -> None:
    from app.core.config import Settings

    settings = Settings(
        marketplace_sync_interval_seconds=300,
        scheduler_poll_interval_seconds=10,
        scheduler_claim_limit=50,
        scheduler_lease_seconds=180,
    )

    assert settings.marketplace_sync_interval_seconds >= 60
    assert settings.scheduler_poll_interval_seconds >= 1
    assert settings.scheduler_claim_limit <= 500
    assert settings.scheduler_lease_seconds > settings.scheduler_poll_interval_seconds


def test_scheduler_migration_backfills_two_streams_and_has_single_revision_link() -> None:
    migration = (
        API_ROOT / "alembic" / "versions" / "20260722_0012_marketplace_scheduler_foundation.py"
    ).read_text(encoding="utf-8")

    assert 'revision: str = "20260722_0012"' in migration
    assert 'down_revision: str | None = "20260722_0011"' in migration
    assert "CROSS JOIN (VALUES ('reviews'), ('questions'))" in migration
    assert "ON CONFLICT (marketplace_account_id, stream) DO NOTHING" in migration


def test_scheduler_runtime_is_not_a_placeholder() -> None:
    scheduler_dockerfile = (REPOSITORY_ROOT / "apps" / "scheduler" / "Dockerfile").read_text(encoding="utf-8")
    worker_dockerfile = (REPOSITORY_ROOT / "apps" / "worker" / "Dockerfile").read_text(encoding="utf-8")
    production_compose = (
        REPOSITORY_ROOT / "infra" / "docker" / "docker-compose.production.yml"
    ).read_text(encoding="utf-8")

    assert "scheduler placeholder" not in scheduler_dockerfile.lower()
    assert 'CMD ["python", "-m", "app.scheduler.main"]' in scheduler_dockerfile
    assert "app.workers.marketplace_sync" in worker_dockerfile
    assert "  scheduler:" in production_compose


def test_scheduler_claim_uses_skip_locked_and_expiring_lease() -> None:
    source = (
        API_ROOT / "app" / "services" / "marketplace_scheduler_service.py"
    ).read_text(encoding="utf-8")

    assert ".with_for_update(skip_locked=True)" in source
    assert "lease_expires_at <= current_time" in source
    assert "uuid4()" in source


def test_scheduled_execution_resets_cursor_after_completed_cycle() -> None:
    source = (
        API_ROOT / "app" / "services" / "scheduled_sync_service.py"
    ).read_text(encoding="utf-8")

    assert "state.cursor = next_cursor" in source
    assert "state.last_cycle_completed_at = now" in source
    assert "marketplace_sync_interval_seconds" in source


def test_capability_api_and_sync_state_route_are_registered() -> None:
    main = (API_ROOT / "app" / "main.py").read_text(encoding="utf-8")
    routes = (API_ROOT / "app" / "api" / "marketplace_accounts.py").read_text(encoding="utf-8")

    assert "marketplace_capabilities_router" in main
    assert '"/{account_id}/sync-states"' in routes


def test_due_time_example_is_timezone_aware() -> None:
    now = datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    due = now + timedelta(seconds=300)

    assert due.tzinfo is UTC
    assert (due - now).total_seconds() == 300
