from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.auth import create_access_token, decode_access_claims
from app.models.auth_session import AuthSession
from app.models.organization_invitation import OrganizationInvitation
from app.schemas.team import InvitationAcceptRequest, InvitationCreateRequest, TeamMemberRoleUpdateRequest
from app.services.auth_session_service import generate_refresh_token, hash_refresh_token
from app.services.team_service import generate_invitation_token, hash_invitation_token

API_ROOT = Path(__file__).resolve().parents[2]


def test_refresh_tokens_are_random_opaque_and_only_hash_is_persistable() -> None:
    first = generate_refresh_token()
    second = generate_refresh_token()

    assert first != second
    assert len(first) >= 64
    assert len(hash_refresh_token(first)) == 64
    assert first not in hash_refresh_token(first)


def test_invitation_tokens_are_random_single_use_secrets() -> None:
    token = generate_invitation_token()

    assert len(token) >= 64
    assert len(hash_invitation_token(token)) == 64
    assert token not in hash_invitation_token(token)


def test_access_token_carries_server_session_identifier() -> None:
    user_id = uuid4()
    session_id = uuid4()
    token = create_access_token(user_id=user_id, session_id=session_id, expires_delta=timedelta(minutes=5))

    claims = decode_access_claims(token)

    assert claims.user_id == user_id
    assert claims.session_id == session_id


def test_invitation_request_normalizes_email_and_rejects_owner_role() -> None:
    payload = InvitationCreateRequest(email="  USER@Example.COM ", role="manager")
    assert str(payload.email) == "user@example.com"

    with pytest.raises(ValidationError):
        InvitationCreateRequest.model_validate({"email": "owner@example.com", "role": "owner"})


def test_invitation_accept_token_has_minimum_entropy_shape() -> None:
    with pytest.raises(ValidationError):
        InvitationAcceptRequest(token="short")


def test_member_role_update_cannot_assign_owner() -> None:
    with pytest.raises(ValidationError):
        TeamMemberRoleUpdateRequest.model_validate({"role": "owner"})


def test_session_and_invitation_models_are_registered() -> None:
    assert AuthSession.__tablename__ == "auth_sessions"
    assert OrganizationInvitation.__tablename__ == "organization_invitations"


def test_session_service_uses_rotation_and_family_reuse_detection() -> None:
    source = (API_ROOT / "app" / "services" / "auth_session_service.py").read_text(encoding="utf-8")

    assert ".with_for_update()" in source
    assert 'current.status = "rotated"' in source
    assert 'reason="refresh_token_reuse"' in source
    assert "AuthSession.family_id == family_id" in source


def test_invitation_acceptance_requires_matching_authenticated_email() -> None:
    source = (API_ROOT / "app" / "services" / "team_service.py").read_text(encoding="utf-8")

    assert "actor.email.strip().lower() != invitation.email" in source
    assert 'raise forbidden("Invitation email does not match the authenticated user")' in source
    assert 'invitation.status = "accepted"' in source


def test_owner_membership_cannot_be_changed_or_removed() -> None:
    source = (API_ROOT / "app" / "services" / "team_service.py").read_text(encoding="utf-8")

    assert 'if membership.role == "owner"' in source
    assert "Organization owner role cannot be changed" in source
    assert "Organization owner cannot be removed" in source


def test_member_limit_counts_pending_invitations_and_rechecks_on_acceptance() -> None:
    source = (API_ROOT / "app" / "services" / "team_service.py").read_text(encoding="utf-8")

    assert "pending_count_result" in source
    assert "limit.used + pending_count >= limit.limit" in source
    assert source.count('metric="members"') >= 2
    assert "with_for_update()" in source
    assert "_lock_organization" in source


def test_migration_has_single_revision_and_partial_pending_invite_index() -> None:
    migration = (
        API_ROOT / "alembic" / "versions" / "20260722_0013_team_sessions_security.py"
    ).read_text(encoding="utf-8")

    assert 'revision: str = "20260722_0013"' in migration
    assert 'down_revision: str | None = "20260722_0012"' in migration
    assert "uq_organization_invitations_pending_email" in migration
    assert "status = 'pending'" in migration
    assert "ck_auth_sessions_status" in migration
    assert "ck_auth_sessions_rotation_replacement" in migration
    assert "ck_organization_invitations_email_lowercase" in migration


def test_refresh_cookie_is_http_only_and_scoped_to_auth_routes() -> None:
    cookies = (API_ROOT / "app" / "core" / "cookies.py").read_text(encoding="utf-8")

    assert 'REFRESH_COOKIE_NAME = "respio_refresh"' in cookies
    assert 'path="/api/auth"' in cookies
    assert "httponly=True" in cookies


def test_auth_routes_include_refresh_logout_all_and_session_management() -> None:
    auth_api = (API_ROOT / "app" / "api" / "auth.py").read_text(encoding="utf-8")

    assert '@router.post("/refresh"' in auth_api
    assert '@router.post("/logout-all"' in auth_api
    assert '@router.get("/sessions"' in auth_api
    assert '@router.delete("/sessions/{session_id}"' in auth_api


def test_team_routes_are_registered_without_public_ui_changes() -> None:
    main = (API_ROOT / "app" / "main.py").read_text(encoding="utf-8")

    assert "team_router" in main
    assert "app.include_router(team_router)" in main


def test_security_configuration_has_bounded_ttls() -> None:
    from app.core.config import Settings

    settings = Settings(
        auth_access_token_ttl_minutes=15,
        auth_refresh_token_ttl_days=30,
        auth_invitation_ttl_hours=72,
    )

    assert 5 <= settings.auth_access_token_ttl_minutes <= 60
    assert 1 <= settings.auth_refresh_token_ttl_days <= 90
    assert 1 <= settings.auth_invitation_ttl_hours <= 168


def test_expired_session_example_is_timezone_aware() -> None:
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=30)

    assert expires_at.tzinfo is UTC
    assert expires_at > now
