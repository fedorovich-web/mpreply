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
from app.providers.groq import GroqProvider, GroqProviderError
from app.providers.llm import LLMUsage

RESEARCH_KEY = "web_research"
COMPATIBILITY_KEY = "web_compatibility_research"
RESEARCH_TIMEOUT_SECONDS = 55
_EMPTY_USAGE = LLMUsage(None, None, None, None)
_UNITS = frozenset({"mm", "cm", "m", "mah", "w", "v", "kg", "g", "l", "ml", "hz", "gb", "tb",
                    "\u043c\u043c", "\u0441\u043c", "\u043c", "\u043c\u0430\u0447", "\u0432\u0442", "\u0432",
                    "\u043a\u0433", "\u0433", "\u043b", "\u043c\u043b", "\u0433\u0446", "\u0433\u0431", "\u0442\u0431"})


def product_identity(product: Product) -> str:
    return sha256(json.dumps(["research-v3", product.name, product.sku, product.brand], ensure_ascii=False).encode()).hexdigest()


def compatibility_models(customer_text: str) -> tuple[str, ...]:
    text = customer_text[:4096]
    text = re.sub(r"https?://\S+|[\w.+-]+@[\w.-]+|(?<!\w)\+?\d[\d ()-]{7,}\d", " ", text)
    private_labels = (r"(?:номер\s+)?заказ\w*|логин\w*|парол\w*|телеграм\w*|серийн\w*\s+номер|"
                      r"код\s+(?:подтвержден\w*|доступ\w*)|telegram|username|login|password|"
                      r"order(?:\s+(?:number|id))?|tracking(?:\s+number)?|serial(?:\s+number)?|otp|token")
    text = re.sub(r"\b(?:" + private_labels + r")\b[^,;?!\n.]*", " ", text, flags=re.IGNORECASE)
    pattern = r"(?<![\w@])([A-Za-z]{1,12}[ -]?\d{1,6}[A-Za-z0-9]*(?:[-/._][A-Za-z0-9]+)*(?:\s+[A-Z][A-Z0-9]{0,3})?)(?![\w@])"
    context = r"\b(?:подойд\w*|подход\w*|совмест\w*|модел\w*|замен\w*|для|на|к|for|fits?|compatib\w*|model|replacement|old\s+belt)\b"
    models: list[str] = []
    for match in re.finditer(pattern, text):
        prefix = re.split(r"[,;!?\n]|(?<!\d)\.(?!\d)", text[:match.start()])[-1][-100:]
        contact_context = r"\b(?:contact|reach|email|handle|связ\w*|контакт\w*|почт\w*)\b"
        if not re.search(contact_context, prefix, flags=re.IGNORECASE) and re.search(context, prefix, flags=re.IGNORECASE):
            models.append(re.sub(r"\s+", "", match.group(1)).upper())
    return tuple(dict.fromkeys(model for model in models if 3 <= len(model) <= 40))[:4]


def _query_key(models: tuple[str, ...]) -> str:
    return sha256(json.dumps(sorted(_normalized(model) for model in models)).encode()).hexdigest()


def _research_entry(metadata: dict[str, object], models: tuple[str, ...]) -> object:
    if not models:
        return metadata.get(RESEARCH_KEY)
    raw = metadata.get(COMPATIBILITY_KEY)
    return cast(dict[str, object], raw).get(_query_key(models)) if isinstance(raw, dict) else None


def _store_research(product: Product, models: tuple[str, ...], entry: dict[str, object]) -> None:
    metadata = dict(product.metadata_json or {})
    if not models:
        metadata[RESEARCH_KEY] = entry
    else:
        raw = metadata.get(COMPATIBILITY_KEY)
        entries: dict[str, object] = dict(cast(dict[str, object], raw)) if isinstance(raw, dict) else {}
        key = _query_key(models)
        if key not in entries and len(entries) >= 16:
            now = datetime.now(UTC).isoformat()
            removable: list[str] = []
            for name, value in entries.items():
                if isinstance(value, dict):
                    cached = cast(dict[str, object], value)
                    lease_until = cached.get("lease_until")
                    if cached.get("status") != "pending" or (isinstance(lease_until, str) and lease_until <= now):
                        removable.append(name)
            if not removable:
                raise conflict("Product compatibility research is busy; retry shortly")
            del entries[removable[0]]
        entries[key] = entry
        metadata[COMPATIBILITY_KEY] = entries
    product.metadata_json = metadata


def _contains_model(text: str, model: str) -> bool:
    letters = _normalized(model)
    pattern = r"(?<![a-z0-9])" + r"[\s./_-]*".join(re.escape(char) for char in letters) + r"(?![a-z0-9])"
    return bool(re.search(pattern, text.casefold()))


def _normalized(value: str) -> str:
    return "".join(char for char in value.casefold() if char.isalnum())


def source_matches_product(source: dict[str, str], product: Product) -> bool:
    text = source["title"] + " " + source["excerpt"]
    source_tokens = {_normalized(token) for token in re.findall(r"[\w-]+", text)}
    name = product.name or ""
    tokens = [_normalized(token) for token in re.findall(r"[\w-]+", name)]
    brand_tokens = [_normalized(token) for token in re.findall(r"[\w-]+", product.brand or "")]
    brand_matches = not brand_tokens or all(token in source_tokens for token in brand_tokens)
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
        model_matches = all(model in source_tokens for model in models)
        exact_title = _normalized(name) in _normalized(source["title"])
        strong_part = any(sum(char.isdigit() for char in model) >= 6 for model in models)
        return model_matches and (brand_matches or (exact_title and strong_part))
    if not brand_matches:
        return False
    article = _normalized(product.sku or "")
    if article:
        return len(article) >= 4 and article in source_tokens
    words = [_normalized(token) for token in re.findall(r"\w+", name) if len(token) >= 4]
    brand = _normalized(product.brand or "")
    return bool(words and brand and brand in source_tokens and sum(word in source_tokens for word in words) / len(words) >= 0.7)


def research_context(metadata: dict[str, object], models: tuple[str, ...] = ()) -> dict[str, object]:
    result = dict(metadata)
    raw = _research_entry(metadata, models)
    result.pop(COMPATIBILITY_KEY, None)
    result.pop(RESEARCH_KEY, None)
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

    async def ensure(self, *, product: Product | None, provider: GroqProvider, models: tuple[str, ...] = ()) -> ResearchRun:
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

        deadline = asyncio.get_running_loop().time() + 70
        while True:
            product = await load()
            now = datetime.now(UTC)
            raw = _research_entry(product.metadata_json or {}, models)
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
            _store_research(product, models, {
                "identity": identity, "status": "pending", "lease_token": token,
                "lease_until": (now + timedelta(seconds=65)).isoformat(), "sources": [],
            })
            await self.session.commit()
            break

        error_code = None
        usage, latency = _EMPTY_USAGE, 0
        sources: list[dict[str, str]] = []
        verified = False
        try:
            async with asyncio.timeout(RESEARCH_TIMEOUT_SECONDS):
                research = await provider.research_product(name=product.name or "", sku=product.sku, brand=product.brand,
                                                          compatibility_models=models)
            usage, latency = research.usage, research.latency_ms
            matches = [source for source in research.sources if source_matches_product(source, product)][:5]
            verified = bool(matches) and all(any(_contains_model(source["title"] + " " + source["excerpt"], model)
                                                for source in matches) for model in models)
            sources = matches or research.sources[:5]
        except GroqProviderError as exc:
            error_code = exc.error_code
        except TimeoutError:
            error_code = "groq_timeout"
        product = await load()
        pending = _research_entry(product.metadata_json or {}, models)
        if not isinstance(pending, dict) or cast(dict[str, object], pending).get("lease_token") != token:
            raise conflict("Product research lease changed; start a new generation")
        now = datetime.now(UTC)
        status = "error" if error_code else "verified" if verified else "needs_review" if sources else "not_found"
        _store_research(product, models, {
            "identity": identity, "status": status, "sources": sources, "error_code": error_code,
            "checked_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=24) if sources else now + timedelta(minutes=1)).isoformat(),
        })
        await self.session.commit()
        return ResearchRun(verified=verified, usage=usage, latency_ms=latency, error_code=error_code)
