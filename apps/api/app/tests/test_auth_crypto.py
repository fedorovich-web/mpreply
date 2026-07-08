from uuid import uuid4

from app.core.auth import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_verification() -> None:
    password_hash = hash_password("very-secure-password")

    assert verify_password("very-secure-password", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_access_token_roundtrip() -> None:
    user_id = uuid4()

    token = create_access_token(user_id=user_id)

    assert decode_access_token(token) == user_id
