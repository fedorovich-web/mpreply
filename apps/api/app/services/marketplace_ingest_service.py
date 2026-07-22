from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product


class MarketplaceMessageIngestService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert_normalized_message(self, account: MarketplaceAccount, normalized: dict[str, Any]) -> str:
        if not normalized.get("external_id") or not normalized.get("customer_text"):
            return "skipped"
        now = datetime.now(UTC)
        product = await self._upsert_product(account, normalized["product"])
        result = await self.session.execute(
            select(CustomerMessage).where(
                CustomerMessage.organization_id == account.organization_id,
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.marketplace == account.marketplace,
                CustomerMessage.external_id == normalized["external_id"],
                CustomerMessage.type == normalized["type"],
            )
        )
        message = result.scalar_one_or_none()
        if message is None:
            message = CustomerMessage(
                organization_id=account.organization_id,
                marketplace_account_id=account.id,
                product_id=product.id,
                marketplace=account.marketplace,
                external_id=normalized["external_id"],
                type=normalized["type"],
                status=normalized["status"],
                rating=normalized.get("rating"),
                customer_display_name=normalized.get("customer_display_name"),
                customer_text=normalized["customer_text"],
                customer_photos_json=normalized.get("customer_photos_json") or [],
                marketplace_created_at=normalized["marketplace_created_at"],
                imported_at=now,
                last_synced_at=now,
                priority=self._priority_for(normalized),
                metadata_json=normalized.get("metadata_json") or {},
            )
            self.session.add(message)
            await self.session.flush()
            return "created"
        message.product_id = product.id
        message.rating = normalized.get("rating")
        message.customer_display_name = normalized.get("customer_display_name")
        message.customer_text = normalized["customer_text"]
        message.customer_photos_json = normalized.get("customer_photos_json") or []
        message.last_synced_at = now
        message.metadata_json = {**(message.metadata_json or {}), **(normalized.get("metadata_json") or {})}
        await self.session.flush()
        return "updated"

    async def _upsert_product(self, account: MarketplaceAccount, product_payload: dict[str, Any]) -> Product:
        external_id = product_payload.get("external_id") or "unknown"
        result = await self.session.execute(
            select(Product).where(
                Product.organization_id == account.organization_id,
                Product.marketplace_account_id == account.id,
                Product.external_id == external_id,
            )
        )
        product = result.scalar_one_or_none()
        if product is None:
            product = Product(
                organization_id=account.organization_id,
                marketplace_account_id=account.id,
                marketplace=account.marketplace,
                external_id=external_id,
                sku=product_payload.get("sku"),
                name=product_payload.get("name") or "Marketplace product",
                brand=product_payload.get("brand"),
                category=product_payload.get("category"),
                image_url=product_payload.get("image_url"),
                product_url=product_payload.get("product_url"),
                metadata_json=product_payload.get("metadata_json") or {},
            )
            self.session.add(product)
            await self.session.flush()
            return product
        product.sku = product_payload.get("sku")
        product.name = product_payload.get("name") or product.name
        product.brand = product_payload.get("brand")
        product.category = product_payload.get("category")
        product.image_url = product_payload.get("image_url")
        product.product_url = product_payload.get("product_url")
        product.metadata_json = {**(product.metadata_json or {}), **(product_payload.get("metadata_json") or {})}
        await self.session.flush()
        return product

    @staticmethod
    def _priority_for(normalized: dict[str, Any]) -> str:
        rating = normalized.get("rating")
        if rating is not None and rating <= 2:
            return "high"
        return "normal"
