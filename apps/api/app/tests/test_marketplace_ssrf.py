from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import MarketplacePage, NormalizedMessage, NormalizedProduct
from app.core.config import Settings
from app.models.enums import MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.services.marketplace_ingest_service import InvalidNormalizedRecord, MarketplaceIngestService

NOW = datetime(2026, 9, 14, 12, tzinfo=UTC)


def _production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "production",
        "api_base_url": "https://api.respio.ru",
        "web_app_url": "https://app.respio.ru",
        "public_site_url": "https://respio.ru",
        "auth_secret_key": SecretStr("a" * 64),
        "credentials_encryption_key": SecretStr(Fernet.generate_key().decode()),
        "groq_api_key": SecretStr("gsk_contract_key_123456789"),
        "resend_api_key": SecretStr("re_contract_key_123456789"),
        "auth_cookie_secure": True,
        "rate_limit_enabled": True,
        "cors_allowed_origins": ["https://app.respio.ru", "https://respio.ru"],
        "allowed_hosts": ["api.respio.ru"],
    }
    values.update(overrides)
    return Settings.model_validate(values)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("groq_base_url", "https://api.groq.com.attacker.invalid/openai/v1"),
        ("groq_base_url", "https://api.groq.com@attacker.invalid/openai/v1"),
        ("groq_base_url", "https://api.groq.com:444/openai/v1"),
        ("resend_api_url", "https://api.resend.com/emails?next=https://attacker.invalid"),
        ("web_app_url", "https://app.respio.ru/path"),
        ("cors_allowed_origins", ["//attacker.invalid"]),
        ("allowed_hosts", ["*.respio.ru"]),
        ("allowed_hosts", ["localhost", "api.respio.ru"]),
    ],
)
def test_production_rejects_hostile_external_origins(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        _production_settings(**{field: value})


@pytest.mark.parametrize(
    "url",
    [
        "http://cdn.example.test/photo.jpg",
        "//attacker.invalid/photo.jpg",
        "javascript:alert(1)",
        "https://user:password@cdn.example.test/photo.jpg",
        "https://cdn.example.test:444/photo.jpg",
    ],
)
@pytest.mark.asyncio
async def test_ingestion_rejects_non_https_customer_media_before_database_io(url: str) -> None:
    service = MarketplaceIngestService(cast(AsyncSession, object()))
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace="wildberries",
        display_name="Main account",
        credentials_encrypted="encrypted",
        credentials_fingerprint="f" * 64,
    )
    message = NormalizedMessage(
        external_id="message-1",
        message_type=MessageType.REVIEW,
        rating=5,
        customer_display_name=None,
        customer_text="Review text",
        customer_photos=(url,),
        marketplace_created_at=NOW,
        product=NormalizedProduct(
            external_id="product-1",
            sku=None,
            name=None,
            brand=None,
            category=None,
            image_url=None,
            product_url=None,
            metadata={},
        ),
        metadata={},
    )

    with pytest.raises(InvalidNormalizedRecord, match="HTTPS origin"):
        await service.ingest_page(account, MarketplacePage(items=(message,), next_cursor=None), NOW)
