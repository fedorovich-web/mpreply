from __future__ import annotations

import secrets
from datetime import UTC, datetime
from hashlib import sha256

from cryptography.fernet import Fernet
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.reply import Reply
from app.models.user import User

DEMO_EMAIL = "public-demo@demo.mpreply.ru"
DEMO_SLUG = "mpreply-public-demo"

_SAMPLES = (
    ("wildberries", "review", "Товар понравился, но упаковка пришла повреждённой."),
    ("ozon", "question", "Этот товар будет в наличии на следующей неделе?"),
    ("yandex_market", "question", "Какого размера эта модель?"),
    ("avito", "chat", "Можно забрать товар самостоятельно?"),
)


async def ensure_demo_workspace(session: AsyncSession) -> User:
    bind = session.get_bind()
    if bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(410864541)"))

    user = await session.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(
            email=DEMO_EMAIL,
            name="Демо MPReply",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            status="demo",
            email_verified_at=datetime.now(UTC),
            auth_version=0,
        )
        session.add(user)
        await session.flush()

    organization = await session.scalar(select(Organization).where(Organization.slug == DEMO_SLUG))
    if organization is None:
        organization = Organization(
            name="Демо MPReply",
            slug=DEMO_SLUG,
            owner_user_id=user.id,
            default_response_mode="semi_auto",
            status="demo",
        )
        session.add(organization)
        await session.flush()

    membership = await session.scalar(
        select(OrganizationUser).where(
            OrganizationUser.organization_id == organization.id,
            OrganizationUser.user_id == user.id,
        )
    )
    if membership is None:
        session.add(OrganizationUser(organization_id=organization.id, user_id=user.id, role="viewer", status="active"))
        await session.flush()

    existing_accounts = {
        account.marketplace: account
        for account in (await session.scalars(
            select(MarketplaceAccount).where(MarketplaceAccount.organization_id == organization.id)
        )).all()
    }
    now = datetime.now(UTC)
    for marketplace, message_type, customer_text in _SAMPLES:
        account = existing_accounts.get(marketplace)
        if account is None:
            marker = f"disabled-public-demo:{marketplace}".encode()
            account = MarketplaceAccount(
                organization_id=organization.id,
                marketplace=marketplace,
                display_name=f"{marketplace.replace('_', ' ').title()} · демо",
                status="disabled",
                credentials_encrypted=Fernet(Fernet.generate_key()).encrypt(marker).decode(),
                credentials_fingerprint=sha256(marker).hexdigest().upper(),
                credentials_status="revoked",
                scopes_json={},
                default_response_mode="semi_auto",
            )
            session.add(account)
            await session.flush()

        external_id = f"public-demo-{marketplace}"
        message = await session.scalar(
            select(CustomerMessage).where(
                CustomerMessage.organization_id == organization.id,
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.external_id == external_id,
            )
        )
        if message is None:
            message = CustomerMessage(
                organization_id=organization.id,
                marketplace_account_id=account.id,
                marketplace=marketplace,
                external_id=external_id,
                type=message_type,
                status="waiting_review" if marketplace == "wildberries" else "needs_reply",
                rating=None,
                customer_display_name=None,
                customer_text=customer_text,
                customer_photos_json=[],
                marketplace_created_at=now,
                imported_at=now,
                last_synced_at=now,
                priority="normal",
                metadata_json={"demo": True},
            )
            session.add(message)
            await session.flush()

        if marketplace == "wildberries":
            reply = await session.scalar(
                select(Reply).where(Reply.organization_id == organization.id, Reply.message_id == message.id)
            )
            if reply is None:
                session.add(Reply(
                    organization_id=organization.id,
                    message_id=message.id,
                    reply_text=(
                        "Спасибо за отзыв. Рады, что товар вам понравился. "
                        "Сожалеем, что упаковка пришла повреждённой. "
                        "Передадим замечание команде для проверки."
                    ),
                    status="waiting_review",
                    mode="manual",
                    metadata_json={"demo": True},
                ))
    await session.flush()
    return user
