from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import cast
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import conflict
from app.models.product import Product
from app.providers.groq import GroqProvider, GroqProviderError, LLMUsage

RESEARCH_KEY = "web_research"
RESEARCH_TIMEOUT_SECONDS = 55
_EMPTY_USAGE = LLMUsage(None, None, None, None)
_UNITS = frozenset({"mm", "cm", "m", "mah", "w", "v", "kg", "g", "l", "ml", "hz", "gb", "tb",
                    "\u043c\u043c", "\u0441\u043c", "\u043c", "\u043c\u0430\u0447", "\u0432\u0442", "\u0432",
                    "\u043a\u0433", "\u0433", "\u043b", "\u043c\u043b", "\u0433\u0446", "\u0433\u0431", "\u0442\u0431"})


def product_identity(product: Product) -> str:
    return sha256(json.dumps([product.name, product.sku, product.brand], ensure_ascii=False).encode()).hexdigest()


def _normalized(value: str) -> str:
    return "".join(char for char in value.casefold() if char.isalnum())


def source_matches_product(source: dict[str, str], product: Product) -> bool:
    """Exact article/model evidence is required when present; broad category matches are insufficient."""
    text = source["title"] + " " + source["excerpt"]
    source_tokens = {_normalized(token) for token in re.findall(r"[\w-]+", text)}
    name = product.name or ""
    tokens = [_normalized(token) for token in re.findall(r"[\w-]+", name)]
    brand_tokens = [_normalized(token) for token in re.findall(r"[\w-]+", product.brand or "")]
    if brand_tokens and not all(token in source_tokens for token in brand_tokens):
        return False
    variants = {"pro", "max", "plus", "lite", "mini", "ultra", "neo", "fe", "se"}.intersection(tokens)
    if not variants.issubset(source_tokens):
        return False
    models: list[str] = []
    for index, token in enumerate(tokens):
        if not any(char.isdigit() for char in token):
            continue
        measurement = re.fullmatch(r"(?:d)?\d+([a-z\u0430-\u044f]+)", token)
        if measurement and measurement.group(1) in _UNITS:
            continue
        if re.fullmatch(r"d\d{2,3}", token):
            continue
        if token.isdigit() and (len(token) < 2 or (index + 1 < len(tokens) and tokens[index + 1] in _UNITS)):
            continue
        models.append(token)
    if models:
        # A shared size/capacity never substitutes for the exact model or part identifier.
        return all(model in source_tokens for model in models)
    article = _normalized(product.sku or "")
    if article:
        return len(article) >= 4 and article in source_tokens
    words = [_normalized(token) for token in re.findall(r"\w+", name) if len(token) >= 4]
    brand = _normalized(product.brand or "")
    return bool(words and brand and brand in source_tokens and sum(word in source_tokens for word in words) / len(words) >= 0.7)


def research_context(metadata: dict[str, object]) -> dict[str, object]:
    """Lease/expiry/usage telemetry never enters the reply hash or model instructions."""
    result = dict(metadata)
    raw = result.get(RESEARCH_KEY)
    if isinstance(raw, dict):
        result[RESEARCH_KEY] = {key: raw[key] for key in ("identity", "status", "sources") if key in raw}
    return result


@dataclass(frozen=True)
class ResearchRun:
    verified: bool
    usage: LLMUsage = _EMPTY_USAGE
    latency_ms: int = 0
    cached: bool = False
    error_code: str | None = None


class ProductResearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ensure(self, *, product: Product | None, provider: GroqProvider) -> ResearchRun:
        if product is None or not product.name or not product.name.strip():
            return ResearchRun(verified=False, error_code="product_identity_missing")
        identity = product_identity(product)
        product_id, organization_id, account_id = product.id, product.organization_id, product.marketplace_account_id
        token = str(uuid4())

        async def load() -> Product:
            row = await self.session.scalar(select(Product).where(
                Product.id == product_id, Product.organization_id == organization_id,
                Product.marketplace_account_id == account_id,
            ).with_for_update().execution_options(populate_existing=True))
            if row is None or product_identity(row) != identity:
                raise conflict("Product changed during research; start a new generation")
            return row

        # A short database lease coalesces concurrent API/worker requests without holding a DB lock during HTTP.
        deadline = asyncio.get_running_loop().time() + 70
        while True:
            product = await load()
            now = datetime.now(UTC)
            raw = (product.metadata_json or {}).get(RESEARCH_KEY)
            cached = cast(dict[str, object], raw) if isinstance(raw, dict) else {}
            if cached.get("identity") != identity:
                cached = {}
            expires = cached.get("expires_at")
            if isinstance(expires, str) and expires > now.isoformat() and cached.get("status") != "pending":
                await self.session.commit()
                error = cached.get("error_code")
                return ResearchRun(verified=cached.get("status") == "verified", cached=True,
                                   error_code=error if isinstance(error, str) else None)
            lease = cached.get("lease_until")
            if cached.get("status") == "pending" and isinstance(lease, str) and lease > now.isoformat():
                await self.session.commit()
                if asyncio.get_running_loop().time() >= deadline:
                    raise conflict("Product research is already in progress; retry shortly")
                await asyncio.sleep(0.25)
                continue
            product.metadata_json = {**(product.metadata_json or {}), RESEARCH_KEY: {
                "identity": identity, "status": "pending", "lease_token": token,
                "lease_until": (now + timedelta(seconds=65)).isoformat(), "sources": [],
            }}
            await self.session.commit()
            break

        error_code = None
        usage, latency = _EMPTY_USAGE, 0
        sources: list[dict[str, str]] = []
        verified = False
        try:
            async with asyncio.timeout(RESEARCH_TIMEOUT_SECONDS):
                research = await provider.research_product(name=product.name or "", sku=product.sku, brand=product.brand)
            usage, latency = research.usage, research.latency_ms
            matches = [source for source in research.sources if source_matches_product(source, product)][:5]
            verified = bool(matches)
            # Retain actual provider evidence for a person even when seller/manufacturer identity differs.
            # These candidates must never enable automatic sending.
            sources = matches or research.sources[:5]
        except GroqProviderError as exc:
            error_code = exc.error_code
        except TimeoutError:
            error_code = "groq_timeout"
        product = await load()
        pending = (product.metadata_json or {}).get(RESEARCH_KEY)
        if not isinstance(pending, dict) or cast(dict[str, object], pending).get("lease_token") != token:
            raise conflict("Product research lease changed; start a new generation")
        now = datetime.now(UTC)
        status = "error" if error_code else "verified" if verified else "needs_review" if sources else "not_found"
        product.metadata_json = {**(product.metadata_json or {}), RESEARCH_KEY: {
            "identity": identity, "status": status, "sources": sources, "error_code": error_code,
            "checked_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=24) if sources else now + timedelta(minutes=1)).isoformat(),
        }}
        await self.session.commit()
        return ResearchRun(verified=verified, usage=usage, latency_ms=latency, error_code=error_code)
