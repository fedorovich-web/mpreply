from __future__ import annotations

import hashlib
import ipaddress
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import cast

import httpx

_SUPPORTED_NOTIFICATION_EVENTS = {
    "payment.canceled",
    "payment.succeeded",
    "payment.waiting_for_capture",
    "refund.canceled",
    "refund.succeeded",
}


@dataclass(frozen=True)
class YooKassaPayment:
    id: str
    status: str
    paid: bool
    amount_minor: int
    currency: str
    confirmation_url: str | None
    metadata: dict[str, object]
    raw: dict[str, object]


@dataclass(frozen=True)
class YooKassaRefund:
    id: str
    payment_id: str
    status: str
    amount_minor: int
    currency: str
    raw: dict[str, object]


@dataclass(frozen=True)
class YooKassaNotification:
    event: str
    object_type: str
    object_id: str
    payload_sha256: str


class YooKassaProviderError(RuntimeError):
    def __init__(self, message: str, *, error_code: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.status_code = status_code


def minor_to_value(amount_minor: int) -> str:
    if amount_minor <= 0:
        raise ValueError("Payment amount must be positive")
    return f"{Decimal(amount_minor) / Decimal(100):.2f}"


def value_to_minor(value: object) -> int:
    try:
        raw_value = Decimal(str(value))
        decimal_value = raw_value.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise YooKassaProviderError("Provider amount is malformed", error_code="provider_amount_invalid") from exc
    if not raw_value.is_finite() or not decimal_value.is_finite():
        raise YooKassaProviderError("Provider amount is not finite", error_code="provider_amount_invalid")
    if raw_value != decimal_value:
        raise YooKassaProviderError("Provider amount has unsupported precision", error_code="provider_amount_invalid")
    if decimal_value < 0:
        raise YooKassaProviderError("Provider amount is negative", error_code="provider_amount_invalid")
    return int(decimal_value * 100)


def payload_sha256(payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def parse_notification(payload: dict[str, object]) -> YooKassaNotification:
    if payload.get("type") != "notification":
        raise YooKassaProviderError("Unsupported notification type", error_code="webhook_type_invalid")
    event = payload.get("event")
    object_value = payload.get("object")
    if not isinstance(event, str) or not isinstance(object_value, dict):
        raise YooKassaProviderError("Webhook payload is malformed", error_code="webhook_payload_invalid")
    object_payload = cast(dict[str, object], object_value)
    object_id = object_payload.get("id")
    if not isinstance(object_id, str) or not object_id:
        raise YooKassaProviderError("Webhook object identifier is missing", error_code="webhook_payload_invalid")
    if event not in _SUPPORTED_NOTIFICATION_EVENTS:
        raise YooKassaProviderError("Webhook event is not supported", error_code="webhook_event_unsupported")
    object_type = "payment" if event.startswith("payment.") else "refund"
    return YooKassaNotification(
        event=event,
        object_type=object_type,
        object_id=object_id,
        payload_sha256=payload_sha256(payload),
    )


def resolve_source_ip(*, peer_ip: str, forwarded_for: str | None, trusted_proxy_networks: list[str]) -> str:
    peer = ipaddress.ip_address(peer_ip)
    trusted_networks = [ipaddress.ip_network(network, strict=False) for network in trusted_proxy_networks]
    if not any(peer in network for network in trusted_networks) or not forwarded_for:
        return str(peer)
    chain = [ipaddress.ip_address(part.strip()) for part in forwarded_for.split(",") if part.strip()]
    chain.append(peer)
    for address in reversed(chain):
        if any(address in network for network in trusted_networks):
            continue
        return str(address)
    return str(peer)


def is_allowed_source_ip(source_ip: str, allowed_networks: list[str]) -> bool:
    address = ipaddress.ip_address(source_ip)
    return any(address in ipaddress.ip_network(network, strict=False) for network in allowed_networks)


class YooKassaProvider:
    def __init__(
        self,
        *,
        shop_id: str,
        secret_key: str,
        base_url: str = "https://api.yookassa.ru/v3",
        timeout_seconds: float = 20.0,
    ) -> None:
        self.shop_id = shop_id.strip()
        self.secret_key = secret_key.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def create_payment(
        self,
        *,
        amount_minor: int,
        currency: str,
        idempotency_key: str,
        return_url: str,
        description: str,
        metadata: dict[str, str],
    ) -> YooKassaPayment:
        self._validate_credentials()
        payload: dict[str, object] = {
            "amount": {"value": minor_to_value(amount_minor), "currency": currency},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "description": description[:128],
            "metadata": metadata,
        }
        data = await self._request(
            "POST",
            "/payments",
            headers={"Idempotence-Key": idempotency_key},
            json_payload=payload,
        )
        return self.parse_payment(data)

    async def get_payment(self, payment_id: str) -> YooKassaPayment:
        self._validate_credentials()
        data = await self._request("GET", f"/payments/{payment_id}")
        return self.parse_payment(data)

    async def get_refund(self, refund_id: str) -> YooKassaRefund:
        self._validate_credentials()
        data = await self._request("GET", f"/refunds/{refund_id}")
        return self.parse_refund(data)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
        json_payload: dict[str, object] | None = None,
    ) -> dict[str, object]:
        async with httpx.AsyncClient(
            auth=httpx.BasicAuth(self.shop_id, self.secret_key),
            timeout=self.timeout_seconds,
        ) as client:
            try:
                response = await client.request(
                    method,
                    f"{self.base_url}{path}",
                    headers=headers,
                    json=json_payload,
                )
            except httpx.TimeoutException as exc:
                raise YooKassaProviderError("Payment provider timed out", error_code="provider_timeout") from exc
            except httpx.HTTPError as exc:
                raise YooKassaProviderError("Payment provider network error", error_code="provider_network_error") from exc
        data = self._safe_json(response)
        if not response.is_success:
            raise YooKassaProviderError(
                self._safe_error(data),
                error_code=self._map_status(response.status_code),
                status_code=response.status_code,
            )
        return data

    @staticmethod
    def parse_payment(data: dict[str, object]) -> YooKassaPayment:
        amount = YooKassaProvider._amount(data)
        confirmation_url: str | None = None
        confirmation_value = data.get("confirmation")
        if isinstance(confirmation_value, dict):
            candidate = cast(dict[str, object], confirmation_value).get("confirmation_url")
            confirmation_url = candidate if isinstance(candidate, str) else None
        metadata_value = data.get("metadata")
        metadata = cast(dict[str, object], metadata_value) if isinstance(metadata_value, dict) else {}
        payment_id = data.get("id")
        status = data.get("status")
        if not isinstance(payment_id, str) or not isinstance(status, str):
            raise YooKassaProviderError("Payment object is malformed", error_code="provider_response_invalid")
        return YooKassaPayment(
            id=payment_id,
            status=status,
            paid=data.get("paid") is True,
            amount_minor=value_to_minor(amount.get("value")),
            currency=str(amount.get("currency") or ""),
            confirmation_url=confirmation_url,
            metadata=metadata,
            raw=data,
        )

    @staticmethod
    def parse_refund(data: dict[str, object]) -> YooKassaRefund:
        amount = YooKassaProvider._amount(data)
        refund_id = data.get("id")
        payment_id = data.get("payment_id")
        status = data.get("status")
        if not isinstance(refund_id, str) or not isinstance(payment_id, str) or not isinstance(status, str):
            raise YooKassaProviderError("Refund object is malformed", error_code="provider_response_invalid")
        return YooKassaRefund(
            id=refund_id,
            payment_id=payment_id,
            status=status,
            amount_minor=value_to_minor(amount.get("value")),
            currency=str(amount.get("currency") or ""),
            raw=data,
        )

    @staticmethod
    def _amount(data: dict[str, object]) -> dict[str, object]:
        amount_value = data.get("amount")
        if not isinstance(amount_value, dict):
            raise YooKassaProviderError("Provider amount is missing", error_code="provider_response_invalid")
        return cast(dict[str, object], amount_value)

    @staticmethod
    def _safe_json(response: httpx.Response) -> dict[str, object]:
        try:
            value: object = response.json()
        except json.JSONDecodeError:
            value = {}
        return cast(dict[str, object], value) if isinstance(value, dict) else {}

    @staticmethod
    def _safe_error(data: dict[str, object]) -> str:
        description = data.get("description")
        if isinstance(description, str) and description:
            return description[:500]
        return "Payment provider returned an error"

    @staticmethod
    def _map_status(status_code: int) -> str:
        if status_code in {401, 403}:
            return "provider_auth_error"
        if status_code == 429:
            return "provider_rate_limited"
        if 500 <= status_code <= 599:
            return "provider_unavailable"
        return "provider_request_rejected"

    def _validate_credentials(self) -> None:
        if not self.shop_id or not self.secret_key or self.secret_key.startswith("replace-"):
            raise YooKassaProviderError("Payment provider is not configured", error_code="provider_not_configured")
