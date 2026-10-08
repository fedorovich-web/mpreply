from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import ORMExecuteState
from sqlalchemy.sql import Select
from sqlalchemy.sql.functions import Function

from app.models.ai_draft import AIDraft
from app.models.base import Base
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.reply import Reply
from app.models.user import User
from app.services.analytics_service import AnalyticsService


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_: JSONB, __: object, **___: object) -> str:
    return "JSON"


async def test_sent_analytics_exclude_external_answers_and_preserve_legacy_sends_and_tenant_period_filters() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            now = datetime.now(UTC)
            actor = User(email="analytics@example.test", status="active")
            org = Organization(name="Analytics", slug=str(uuid4()))
            other_org = Organization(name="Other", slug=str(uuid4()))
            session.add_all([actor, org, other_org])
            await session.flush()
            session.add(OrganizationUser(organization_id=org.id, user_id=actor.id, role="viewer"))
            session.add(OrganizationUser(organization_id=other_org.id, user_id=actor.id, role="viewer"))
            account = MarketplaceAccount(organization_id=org.id, marketplace="wildberries", display_name="Test",
                                         credentials_encrypted="unused", credentials_fingerprint="unused")
            session.add(account)
            other_account = MarketplaceAccount(organization_id=other_org.id, marketplace="wildberries", display_name="Other",
                                               credentials_encrypted="unused", credentials_fingerprint="unused")
            session.add(other_account)
            await session.flush()
            # Actual send, legacy send, preflight convergence, another tenant, an old send.
            cases = [(org, "auto", False, True, now), (org, "semi_auto", None, False, now),
                     (org, "auto", True, True, now), (other_org, "auto", False, False, now),
                     (org, "auto", False, False, now - timedelta(days=40))]
            for index, (tenant, mode, external, has_draft, sent_at) in enumerate(cases):
                message = CustomerMessage(organization_id=tenant.id,
                    marketplace_account_id=account.id if tenant.id == org.id else other_account.id,
                    marketplace="wildberries", external_id=str(index), type="review", status="answered",
                    customer_text="Synthetic", marketplace_created_at=sent_at - timedelta(hours=20 if external else 1),
                    imported_at=sent_at - timedelta(hours=1), last_synced_at=sent_at)
                session.add(message)
                await session.flush()
                draft = None
                if has_draft:
                    draft = AIDraft(organization_id=tenant.id, message_id=message.id, model="test", prompt_version="test",
                                    prompt_input_hash="test", draft_text="Synthetic", created_at=sent_at)
                    session.add(draft)
                    await session.flush()
                session.add(Reply(organization_id=tenant.id, message_id=message.id, reply_text="Synthetic", status="sent",
                    mode=mode, sent_at=sent_at - timedelta(minutes=1), sent_by=actor.id,
                    ai_draft_id=draft.id if draft else None,
                    metadata_json={} if external is None else {"externally_already_answered": external}))
            await session.commit()

            response_time_queries: list[Select[tuple[object, ...]]] = []

            def capture_response_time_query(state: ORMExecuteState) -> None:
                statement = state.statement
                if isinstance(statement, Select):
                    columns = list(statement.selected_columns)
                    if len(columns) == 1 and isinstance(columns[0], Function) and columns[0].name == "avg":
                        response_time_queries.append(cast(Select[tuple[object, ...]], statement))

            event.listen(session.sync_session, "do_orm_execute", capture_response_time_query)
            service = AnalyticsService(session)
            overview = await service.overview(actor=actor, organization_id=org.id)
            event.remove(session.sync_session, "do_orm_execute", capture_response_time_query)
            assert (overview.replies_sent, overview.auto_replies_sent, overview.manual_replies_sent) == (2, 1, 1)
            assert overview.ai_drafts_generated == 2
            assert overview.ai_acceptance_rate == 0.5
            # SQLite cannot evaluate PostgreSQL timestamp subtraction as an interval.
            # Execute the actual aggregate's input query to verify its provenance,
            # tenant and period filters independently of that dialect difference.
            assert len(response_time_queries) == 1
            response_times = (await session.execute(response_time_queries[0].with_only_columns(
                Reply.sent_at, CustomerMessage.marketplace_created_at,
            ))).all()
            assert len(response_times) == 2
            assert all(sent is not None and (sent - received).total_seconds() == 3540 for sent, received in response_times)
            daily = await service.messages(actor=actor, organization_id=org.id)
            assert sum(point.answered for point in daily.points) == 2
            team = await service.team(actor=actor, organization_id=org.id)
            assert len(team.items) == 1
            assert team.items[0].replies_sent == 2
    finally:
        await engine.dispose()
