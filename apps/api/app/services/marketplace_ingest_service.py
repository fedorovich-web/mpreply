from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, cast
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import MarketplacePage, NormalizedMessage, NormalizedProduct, ProviderMessageResolution
from app.automation.state_machine import ensure_message_transition
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product
from app.models.reply import Reply

_MAX_METADATA_STRING_LENGTH = 512
_MAX_MESSAGE_TEXT_LENGTH = 100_000
_MAX_PHOTO_COUNT = 20
_MAX_URL_LENGTH = 2048
_MESSAGE_CONSTRAINT = "uq_customer_messages_external"
_PRODUCT_CONSTRAINT = "uq_products_external"

_MESSAGE_METADATA_KEYS: dict[Marketplace, frozenset[str]] = {
    Marketplace.WILDBERRIES: frozenset({"source", "status", "is_answered"}),
    Marketplace.OZON: frozenset({"source", "status", "is_answered", "sku"}),
    Marketplace.YANDEX_MARKET: frozenset({"source", "status", "is_answered"}),
    Marketplace.AVITO: frozenset({"source", "status", "chat_id", "chat_type", "author_type", "direction", "stage", "used_in_score"}),
}
_PRODUCT_METADATA_KEYS: dict[Marketplace, frozenset[str]] = {
    Marketplace.WILDBERRIES: frozenset({"nm_id", "imt_id", "supplier_article"}),
    Marketplace.OZON: frozenset({"offer_id", "product_id", "sku"}),
    Marketplace.YANDEX_MARKET: frozenset({"business_id", "market_sku", "offer_id"}),
    Marketplace.AVITO: frozenset({"item_id"}),
}


class _DatabaseDiagnostic(Protocol):
    constraint_name: str | None


class _DatabaseError(Protocol):
    diag: _DatabaseDiagnostic


class InvalidNormalizedRecord(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class IngestStats:
    created_messages: int = 0
    updated_messages: int = 0
    created_products: int = 0
    updated_products: int = 0


class MarketplaceIngestService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ingest_page(
        self,
        account: MarketplaceAccount,
        page: MarketplacePage[NormalizedMessage],
        now: datetime,
    ) -> IngestStats:
        marketplace = _marketplace(account.marketplace)
        _validate_aware_datetime(now, field_name="ingestion time")
        created_messages = 0
        updated_messages = 0
        created_products = 0
        updated_products = 0

        for normalized in page.items:
            _validate_message(normalized, marketplace)
            product: Product | None = None
            if normalized.product is not None:
                product, product_created = await self._insert_or_get_product(
                    account,
                    marketplace,
                    normalized.product,
                )
                if product_created:
                    created_products += 1
                else:
                    self._update_product(product, marketplace, normalized.product)
                    updated_products += 1
            elif normalized.message_type is not MessageType.CHAT and not (marketplace is Marketplace.AVITO and normalized.message_type is MessageType.REVIEW):
                raise InvalidNormalizedRecord("review and question records require a product identity")

            message, message_created = await self._insert_or_get_message(
                account,
                marketplace,
                normalized,
                product,
                now,
            )
            if message_created:
                created_messages += 1
            else:
                self._update_message(message, marketplace, normalized, product, now)
                updated_messages += 1

        for resolution in page.resolutions:
            await self._reconcile_resolution(account, marketplace, resolution, now)

        return IngestStats(
            created_messages=created_messages,
            updated_messages=updated_messages,
            created_products=created_products,
            updated_products=updated_products,
        )

    async def _reconcile_resolution(
        self,
        account: MarketplaceAccount,
        marketplace: Marketplace,
        resolution: ProviderMessageResolution,
        now: datetime,
    ) -> None:
        if marketplace is not Marketplace.AVITO or resolution.message_type is not MessageType.REVIEW:
            raise InvalidNormalizedRecord("provider resolution is unsupported for this stream")
        _validate_required_text(resolution.external_id, field_name="message external ID", maximum=255)
        if resolution.status not in {
            MessageStatus.ANSWERED,
            MessageStatus.WAITING_REVIEW,
            MessageStatus.NEEDS_MANUAL_CHECK,
            MessageStatus.BLOCKED_BY_MARKETPLACE,
        }:
            raise InvalidNormalizedRecord("provider resolution status is invalid")
        message = await self.session.scalar(
            select(CustomerMessage)
            .where(
                CustomerMessage.organization_id == account.organization_id,
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.marketplace == marketplace.value,
                CustomerMessage.external_id == resolution.external_id,
                CustomerMessage.type == MessageType.REVIEW.value,
            )
            .with_for_update()
        )
        if message is None:
            return
        if (
            resolution.status is MessageStatus.ANSWERED
            and message.status in {MessageStatus.ANSWERED.value, MessageStatus.AUTO_REPLY_SENT.value}
            and (message.metadata_json or {}).get("provider_publication") == "unverified"
        ):
            metadata = dict(message.metadata_json)
            metadata.pop("provider_publication")
            message.metadata_json = metadata
        if message.status != MessageStatus.NEEDS_REPLY.value:
            return
        reply_id = await self.session.scalar(select(Reply.id).where(Reply.organization_id == account.organization_id, Reply.message_id == message.id).limit(1))
        if reply_id is not None:
            return
        ensure_message_transition(message.status, resolution.status.value)
        message.status = resolution.status.value
        message.last_synced_at = now

    async def _insert_or_get_product(
        self,
        account: MarketplaceAccount,
        marketplace: Marketplace,
        normalized: NormalizedProduct,
    ) -> tuple[Product, bool]:
        _validate_product(normalized)
        product = Product(
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            marketplace=marketplace.value,
            external_id=normalized.external_id,
            sku=normalized.sku,
            name=normalized.name,
            brand=normalized.brand,
            category=normalized.category,
            image_url=normalized.image_url,
            product_url=normalized.product_url,
            metadata_json=sanitize_product_metadata(marketplace, normalized.metadata),
        )
        try:
            async with self.session.begin_nested():
                self.session.add(product)
                await self.session.flush()
            return product, True
        except IntegrityError as exc:
            if _constraint_name(exc) != _PRODUCT_CONSTRAINT:
                raise

        winner = await self.session.scalar(
            select(Product).where(
                Product.organization_id == account.organization_id,
                Product.marketplace_account_id == account.id,
                Product.external_id == normalized.external_id,
            )
        )
        if winner is None:
            raise RuntimeError("unique product winner was not visible after conflict")
        return winner, False

    async def _insert_or_get_message(
        self,
        account: MarketplaceAccount,
        marketplace: Marketplace,
        normalized: NormalizedMessage,
        product: Product | None,
        now: datetime,
    ) -> tuple[CustomerMessage, bool]:
        message = CustomerMessage(
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            product_id=product.id if product is not None else None,
            marketplace=marketplace.value,
            external_id=normalized.external_id,
            type=normalized.message_type.value,
            status=MessageStatus.NEEDS_REPLY.value,
            rating=normalized.rating,
            customer_display_name=normalized.customer_display_name,
            customer_text=normalized.customer_text,
            customer_photos_json=list(normalized.customer_photos),
            marketplace_created_at=normalized.marketplace_created_at,
            imported_at=now,
            last_synced_at=now,
            priority=_priority_for(normalized),
            metadata_json=sanitize_message_metadata(marketplace, normalized.metadata),
        )
        try:
            async with self.session.begin_nested():
                self.session.add(message)
                await self.session.flush()
            return message, True
        except IntegrityError as exc:
            if _constraint_name(exc) != _MESSAGE_CONSTRAINT:
                raise

        winner = await self.session.scalar(
            select(CustomerMessage).where(
                CustomerMessage.organization_id == account.organization_id,
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.marketplace == marketplace.value,
                CustomerMessage.external_id == normalized.external_id,
                CustomerMessage.type == normalized.message_type.value,
            )
        )
        if winner is None:
            raise RuntimeError("unique message winner was not visible after conflict")
        return winner, False

    @staticmethod
    def _update_product(
        product: Product,
        marketplace: Marketplace,
        normalized: NormalizedProduct,
    ) -> None:
        product.sku = normalized.sku
        product.name = normalized.name
        product.brand = normalized.brand
        product.category = normalized.category
        product.image_url = normalized.image_url
        product.product_url = normalized.product_url
        product.metadata_json = sanitize_product_metadata(marketplace, normalized.metadata)

    @staticmethod
    def _update_message(
        message: CustomerMessage,
        marketplace: Marketplace,
        normalized: NormalizedMessage,
        product: Product | None,
        now: datetime,
    ) -> None:
        message.product_id = product.id if product is not None else None
        message.rating = normalized.rating
        message.customer_display_name = normalized.customer_display_name
        message.customer_text = normalized.customer_text
        message.customer_photos_json = list(normalized.customer_photos)
        message.marketplace_created_at = normalized.marketplace_created_at
        message.last_synced_at = now
        message.priority = _priority_for(normalized)
        metadata = sanitize_message_metadata(marketplace, normalized.metadata)
        if (
            marketplace is Marketplace.AVITO
            and normalized.message_type is MessageType.REVIEW
            and (message.metadata_json or {}).get("provider_publication") == "unverified"
        ):
            metadata["provider_publication"] = "unverified"
        message.metadata_json = metadata


def sanitize_message_metadata(
    marketplace: Marketplace,
    metadata: dict[str, object],
) -> dict[str, object]:
    return _sanitize_metadata(metadata, _MESSAGE_METADATA_KEYS[marketplace])


def sanitize_product_metadata(
    marketplace: Marketplace,
    metadata: dict[str, object],
) -> dict[str, object]:
    return _sanitize_metadata(metadata, _PRODUCT_METADATA_KEYS[marketplace])


def _sanitize_metadata(
    metadata: dict[str, object],
    allowed_keys: frozenset[str],
) -> dict[str, object]:
    sanitized: dict[str, object] = {}
    for key in allowed_keys:
        value = metadata.get(key)
        if isinstance(value, bool | int) or (isinstance(value, str) and len(value) <= _MAX_METADATA_STRING_LENGTH):
            sanitized[key] = value
    return sanitized


def _constraint_name(exc: IntegrityError) -> str | None:
    try:
        name = cast(_DatabaseError, exc.orig).diag.constraint_name
    except AttributeError:
        return None
    return name if isinstance(name, str) else None


def _marketplace(value: str) -> Marketplace:
    try:
        return Marketplace(value)
    except ValueError as exc:
        raise InvalidNormalizedRecord("marketplace is not supported for ingestion") from exc


def _validate_message(message: NormalizedMessage, marketplace: Marketplace) -> None:
    _validate_required_text(message.external_id, field_name="message external ID", maximum=255)
    if message.customer_text or not (marketplace is Marketplace.AVITO and message.message_type is MessageType.REVIEW):
        _validate_required_text(message.customer_text, field_name="customer text", maximum=_MAX_MESSAGE_TEXT_LENGTH)
    _validate_optional_text(message.customer_display_name, field_name="customer display name", maximum=255)
    _validate_aware_datetime(message.marketplace_created_at, field_name="marketplace creation time")
    if message.message_type is MessageType.REVIEW:
        if message.rating is not None and not 1 <= message.rating <= 5:
            raise InvalidNormalizedRecord("review rating is outside the supported range")
    elif message.rating is not None:
        raise InvalidNormalizedRecord("only review records may contain a rating")
    if len(message.customer_photos) > _MAX_PHOTO_COUNT:
        raise InvalidNormalizedRecord("customer photo count exceeds the safe limit")
    for photo in message.customer_photos:
        _validate_https_url(photo, field_name="customer photo URL")


def _validate_product(product: NormalizedProduct) -> None:
    _validate_required_text(product.external_id, field_name="product external ID", maximum=255)
    _validate_optional_text(product.name, field_name="product name", maximum=500)
    _validate_optional_text(product.sku, field_name="product SKU", maximum=255)
    _validate_optional_text(product.brand, field_name="product brand", maximum=255)
    _validate_optional_text(product.category, field_name="product category", maximum=255)
    _validate_optional_https_url(product.image_url, field_name="product image URL")
    _validate_optional_https_url(product.product_url, field_name="product URL")


def _validate_required_text(value: str, *, field_name: str, maximum: int) -> None:
    if not value or value != value.strip() or len(value) > maximum or "\x00" in value:
        raise InvalidNormalizedRecord(f"{field_name} is invalid")


def _validate_optional_text(value: str | None, *, field_name: str, maximum: int) -> None:
    if value is not None:
        _validate_required_text(value, field_name=field_name, maximum=maximum)


def _validate_optional_https_url(value: str | None, *, field_name: str) -> None:
    if value is not None:
        _validate_https_url(value, field_name=field_name)


def _validate_https_url(value: str, *, field_name: str) -> None:
    _validate_required_text(value, field_name=field_name, maximum=_MAX_URL_LENGTH)
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as exc:
        raise InvalidNormalizedRecord(f"{field_name} is invalid") from exc
    if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or parsed.password is not None or port not in {None, 443}:
        raise InvalidNormalizedRecord(f"{field_name} must use an HTTPS origin")


def _validate_aware_datetime(value: datetime, *, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise InvalidNormalizedRecord(f"{field_name} must be timezone-aware")


def _priority_for(normalized: NormalizedMessage) -> str:
    return "high" if normalized.rating is not None and normalized.rating <= 2 else "normal"
