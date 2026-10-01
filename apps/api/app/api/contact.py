from __future__ import annotations

from hashlib import sha256
from html import escape
from typing import Literal
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, ValidationInfo, field_validator

from app.core.config import Settings, get_settings
from app.core.csrf import require_csrf_header
from app.core.rate_limit import enforce_auth_rate_limit
from app.schemas.common import MessageResponse
from app.services.transactional_email import EmailDeliveryError, ResendEmailClient, TransactionalEmail

router = APIRouter(prefix="/api/contact", tags=["contact"])
logger = structlog.get_logger(__name__)

Topic = Literal["support", "demo", "partnership", "general"]
TOPIC_LABELS: dict[Topic, str] = {
    "support": "Техническая поддержка",
    "demo": "Запросить демо",
    "partnership": "Партнёрство",
    "general": "Общий вопрос",
}


class ContactRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    topic: Topic
    message: str = Field(min_length=10, max_length=5000)
    idempotency_key: UUID
    consent: Literal[True]

    @field_validator("name", "message")
    @classmethod
    def strip_and_validate(cls, value: str, info: ValidationInfo) -> str:
        stripped = value.strip()
        minimum = 2 if info.field_name == "name" else 10
        if len(stripped) < minimum:
            raise ValueError(f"Field must contain at least {minimum} characters")
        return stripped


@router.post("", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_csrf_header)])
async def send_contact_message(
    payload: ContactRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    await enforce_auth_rate_limit(
        request,
        scope="public-contact",
        identifier=str(payload.email),
        limit=5,
        window_seconds=3600,
    )

    topic = TOPIC_LABELS[payload.topic]
    safe_name = escape(payload.name)
    safe_email = escape(str(payload.email))
    safe_message = escape(payload.message).replace("\n", "<br>")
    body = f"Name: {payload.name}\nEmail: {payload.email}\nSubject: {topic}\n\n{payload.message}"
    email = TransactionalEmail(
        sender=settings.transactional_email_from,
        reply_to=str(payload.email),
        to=settings.support_email,
        subject=f"MPReply: {topic}",
        text=body,
        html=(
            '<div style="font:16px/1.6 Arial,sans-serif">'
            f"<p><strong>Name:</strong> {safe_name}<br>"
            f"<strong>Email:</strong> {safe_email}<br>"
            f"<strong>Subject:</strong> {escape(topic)}</p>"
            f"<p>{safe_message}</p></div>"
        ),
        idempotency_key=f"contact-{sha256(str(payload.idempotency_key).encode()).hexdigest()}",
    )
    try:
        await ResendEmailClient(settings).send(email)
    except EmailDeliveryError as exc:
        logger.warning("contact_email_delivery_failed", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send contact message",
        ) from exc

    return MessageResponse(message="Message sent")
