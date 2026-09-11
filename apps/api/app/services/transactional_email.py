from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from html import escape

import httpx

from app.core.config import Settings, get_settings

DEFAULT_TRANSACTIONAL_SENDER = "MPReply <no-reply@mpreply.ru>"
DEFAULT_SUPPORT_EMAIL = "support@mpreply.ru"


@dataclass(frozen=True, slots=True)
class TransactionalEmail:
    sender: str
    reply_to: str
    to: str
    subject: str
    text: str
    html: str


class EmailDeliveryError(RuntimeError):
    pass


def _button_html(*, url: str, label: str) -> str:
    return (
        f'<a href="{escape(url, quote=True)}" style="display:inline-block;padding:12px 18px;'
        'background:#5148e8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">'
        f"{escape(label)}</a>"
    )


def _layout(*, title: str, body: str, action_html: str | None, footer: str) -> str:
    action = f'<p style="margin:24px 0">{action_html}</p>' if action_html else ""
    return (
        '<!doctype html><html><body style="margin:0;background:#f6f6fb;font-family:Arial,sans-serif;color:#191927">'
        '<div style="max-width:600px;margin:0 auto;padding:32px 20px">'
        '<div style="background:#fff;border:1px solid #e8e8ef;border-radius:12px;padding:28px">'
        f'<h1 style="font-size:22px;margin:0 0 16px">{escape(title)}</h1>'
        f'<div style="font-size:15px;line-height:1.6">{body}</div>{action}'
        f'<p style="margin:28px 0 0;color:#707080;font-size:13px">{escape(footer)}</p>'
        "</div></div></body></html>"
    )


def build_verification_email(
    *,
    recipient: str,
    verification_url: str,
    sender: str = DEFAULT_TRANSACTIONAL_SENDER,
    reply_to: str = DEFAULT_SUPPORT_EMAIL,
) -> TransactionalEmail:
    subject = "Подтвердите email в MPReply"
    text = (
        "Подтвердите email, чтобы завершить регистрацию в MPReply.\n\n"
        f"{verification_url}\n\n"
        "Если вы не создавали аккаунт, просто проигнорируйте это письмо."
    )
    html = _layout(
        title="Подтвердите email",
        body="Подтвердите адрес электронной почты, чтобы завершить регистрацию в MPReply.",
        action_html=_button_html(url=verification_url, label="Подтвердить email"),
        footer="Если вы не создавали аккаунт, просто проигнорируйте это письмо.",
    )
    return TransactionalEmail(sender=sender, reply_to=reply_to, to=recipient, subject=subject, text=text, html=html)


def build_password_reset_email(
    *,
    recipient: str,
    reset_url: str,
    expires_at: datetime,
    sender: str = DEFAULT_TRANSACTIONAL_SENDER,
    reply_to: str = DEFAULT_SUPPORT_EMAIL,
) -> TransactionalEmail:
    subject = "Сброс пароля MPReply"
    expires_label = expires_at.isoformat(timespec="minutes")
    text = (
        "Вы запросили сброс пароля MPReply.\n\n"
        f"{reset_url}\n\n"
        f"Ссылка действует до {expires_label}. Если запрос делали не вы, проигнорируйте письмо."
    )
    html = _layout(
        title="Сброс пароля",
        body="Используйте ссылку ниже, чтобы задать новый пароль.",
        action_html=_button_html(url=reset_url, label="Задать новый пароль"),
        footer=f"Ссылка действует до {expires_label}. Если запрос делали не вы, проигнорируйте письмо.",
    )
    return TransactionalEmail(sender=sender, reply_to=reply_to, to=recipient, subject=subject, text=text, html=html)


def build_password_changed_email(
    *,
    recipient: str,
    sender: str = DEFAULT_TRANSACTIONAL_SENDER,
    reply_to: str = DEFAULT_SUPPORT_EMAIL,
) -> TransactionalEmail:
    subject = "Пароль MPReply изменён"
    text = (
        "Пароль вашего аккаунта MPReply был изменён.\n\n"
        f"Если это были не вы, напишите в поддержку: {reply_to}"
    )
    html = _layout(
        title="Пароль изменён",
        body="Пароль вашего аккаунта MPReply был изменён.",
        action_html=None,
        footer=f"Если это были не вы, напишите в поддержку: {reply_to}",
    )
    return TransactionalEmail(sender=sender, reply_to=reply_to, to=recipient, subject=subject, text=text, html=html)


class ResendEmailClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def send(self, message: TransactionalEmail) -> None:
        api_key = self.settings.resend_api_key.get_secret_value().strip()
        if not api_key:
            raise EmailDeliveryError("Resend API key is not configured")

        payload = {
            "from": message.sender,
            "to": [message.to],
            "reply_to": message.reply_to,
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
        }
        try:
            async with httpx.AsyncClient(timeout=self.settings.resend_timeout_seconds) as client:
                response = await client.post(
                    self.settings.resend_api_url,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise EmailDeliveryError("Resend request failed") from exc

        if response.is_error:
            raise EmailDeliveryError(f"Resend rejected the email with HTTP {response.status_code}")
