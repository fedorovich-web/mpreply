from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models.user import User
from app.providers.yandex_id import YandexIDError, YandexProfile
from app.services.yandex_pending_link import issue_pending_link, verify_pending_link
from app.tests.test_yandex_id_client import yandex_settings


@pytest.mark.parametrize("failure", ["tampered", "expired", "wrong_user", "revoked_auth", "other_client"])
def test_pending_link_rejects_invalid_or_unowned_attestation(failure: str) -> None:
    settings = yandex_settings()
    now = datetime.now(UTC)
    user = User(id=uuid4(), email="existing@example.com", status="active", auth_version=0)
    token = issue_pending_link(user=user, profile=YandexProfile("subject", settings.yandex_oauth_client_id, user.email, None),
                               settings=settings, now=now)
    if failure == "tampered":
        token = "bad" + token
    elif failure == "expired":
        now += timedelta(minutes=10)
    elif failure == "wrong_user":
        user.id = uuid4()
    elif failure == "revoked_auth":
        user.auth_version = 1
    else:
        settings.yandex_oauth_client_id = "other-client"
    with pytest.raises(YandexIDError):
        verify_pending_link(token=token, user=user, settings=settings, now=now)
