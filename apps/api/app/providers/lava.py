from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import cast
from urllib.parse import urlparse
from uuid import UUID

import httpx

from app.core.config import Settings, get_settings


class LavaError(RuntimeError):
    def __init__(self, code: str, *, ambiguous: bool = False) -> None:
        self.code = code
        self.ambiguous = ambiguous
        super().__init__(code)


@dataclass(frozen=True, slots=True)
class CreatedInvoice:
    id: UUID
    payment_url: str


@dataclass(frozen=True, slots=True)
class VerifiedInvoice:
    id: UUID
    status: str
    amount_minor: int
    currency: str
    correlation: str | None


def money_minor(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise LavaError("invalid_invoice_amount")
    try:
        amount = Decimal(str(value)) * 100
        if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value() or amount > 2147483647:
            raise LavaError("invalid_invoice_amount")
        return int(amount)
    except InvalidOperation:
        raise LavaError("invalid_invoice_amount") from None


def safe_payment_url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 4096:
        raise LavaError("invalid_payment_url", ambiguous=True)
    try:
        url = urlparse(value)
        host = (url.hostname or "").lower()
        if (value != value.strip() or url.scheme != "https" or url.username or url.password or url.port is not None
                or not (host == "lava.top" or host.endswith(".lava.top"))):
            raise LavaError("invalid_payment_url", ambiguous=True)
    except ValueError:
        raise LavaError("invalid_payment_url", ambiguous=True) from None
    return value


class LavaClient:
    def __init__(self, *, settings: Settings | None = None, http: httpx.AsyncClient | None = None) -> None:
        self.settings = settings or get_settings()
        self.http = http

    async def _request(self, method: str, path: str, *, body: str | None = None) -> dict[str, object]:
        if not self.settings.lava_enabled:
            raise LavaError("lava_disabled")
        headers = {"X-Api-Key": self.settings.lava_api_key.get_secret_value(), "Content-Type": "application/json"}
        try:
            if self.http is None:
                async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
                    response = await client.request(method, "https://gate.lava.top" + path, headers=headers, content=body)
            else:
                response = await self.http.request(method, "https://gate.lava.top" + path, headers=headers, content=body)
        except httpx.HTTPError:
            raise LavaError("lava_unavailable", ambiguous=method == "POST") from None
        if not 200 <= response.status_code < 300:
            raise LavaError("lava_request_rejected", ambiguous=method == "POST" and response.status_code >= 500)
        try:
            data: object = json.loads(response.content, parse_float=Decimal)
            if not isinstance(data, dict):
                raise LavaError("invalid_lava_response", ambiguous=method == "POST")
            return cast(dict[str, object], data)
        except (ValueError, UnicodeDecodeError):
            raise LavaError("invalid_lava_response", ambiguous=method == "POST") from None

    async def create_invoice(
        self, *, email: str, offer_id: UUID | None, amount_minor: int, correlation: str, return_urls: dict[str, str],
    ) -> CreatedInvoice:
        if offer_id is None or type(amount_minor) is not int or not 0 < amount_minor <= 2147483647:
            raise LavaError("invalid_purchase_amount")
        fields: dict[str, object] = {"email": email, "offerId": str(offer_id), "currency": "RUB", "periodicity": "ONE_TIME",
                                    "buyerLanguage": "RU", "clientUtm": {"utm_content": correlation}}
        for name, value in return_urls.items():
            if name not in {"successful_return_url", "failure_return_url", "cancel_return_url"}:
                raise LavaError("invalid_return_url")
            parsed = urlparse(value)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or len(value) > 512:
                raise LavaError("invalid_return_url")
            fields[name] = value
        body = json.dumps(fields).removesuffix("}") + ',"amount":' + str(Decimal(amount_minor) / 100) + "}"
        data = await self._request("POST", "/api/v3/invoice", body=body)
        try:
            invoice_id = UUID(str(data["id"]))
            return CreatedInvoice(invoice_id, safe_payment_url(data.get("paymentUrl")))
        except (KeyError, ValueError):
            raise LavaError("invalid_lava_response", ambiguous=True) from None

    async def get_invoice(self, invoice_id: UUID) -> VerifiedInvoice:
        data = await self._request("GET", f"/api/v1/invoices/{invoice_id}")
        try:
            received_id = UUID(str(data["id"]))
            raw_receipt = data["receipt"]
            state = str(data["status"]).lower()
            if received_id != invoice_id or not isinstance(raw_receipt, dict) or state not in {"new", "in_progress", "completed", "failed"}:
                raise LavaError("invalid_lava_invoice")
            receipt = cast(dict[str, object], raw_receipt)
            currency = receipt.get("currency")
            if not isinstance(currency, str) or currency != "RUB":
                raise LavaError("invalid_invoice_currency")
            utm = data.get("clientUtm")
            correlation = cast(dict[str, object], utm).get("utm_content") if isinstance(utm, dict) else None
            return VerifiedInvoice(received_id, state, money_minor(receipt.get("amount")), currency,
                                   correlation if isinstance(correlation, str) else None)
        except (KeyError, ValueError):
            raise LavaError("invalid_lava_invoice") from None
