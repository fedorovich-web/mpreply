from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.auth_tokens import digest_auth_token, new_auth_token
from app.services.transactional_email import build_password_reset_email, build_verification_email


def test_auth_tokens_are_opaque_and_only_digest_is_persistable() -> None:
    raw = new_auth_token()

    assert len(raw) >= 40
    assert digest_auth_token(raw) == digest_auth_token(raw)
    assert digest_auth_token(raw) != raw
    assert len(digest_auth_token(raw)) == 64


def test_verification_email_uses_transactional_sender_and_support_reply_to() -> None:
    message = build_verification_email(
        recipient="roman@example.com",
        verification_url="https://mpreply.ru/auth/verify-email?token=opaque-token",
    )

    assert message.sender == "MPReply <no-reply@mpreply.ru>"
    assert message.reply_to == "support@mpreply.ru"
    assert message.to == "roman@example.com"
    assert "opaque-token" in message.text
    assert "opaque-token" in message.html


def test_password_reset_email_does_not_claim_password_was_changed() -> None:
    message = build_password_reset_email(
        recipient="roman@example.com",
        reset_url="https://mpreply.ru/auth/reset-password?token=opaque-token",
        expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )

    assert "сброс" in message.subject.lower()
    assert "opaque-token" in message.text
    assert "пароль изменён" not in message.text.lower()
