from cryptography.fernet import Fernet

from app.core.security import CredentialService


def test_credential_encrypt_decrypt_roundtrip() -> None:
    service = CredentialService(Fernet.generate_key().decode("utf-8"))
    secret = "wb-secret-token-fixture"

    encrypted = service.encrypt(secret)

    assert encrypted != secret
    assert service.decrypt(encrypted) == secret


def test_credential_fingerprint_mask_does_not_reveal_secret() -> None:
    secret = "wb-secret-token-fixture"
    fingerprint = CredentialService.fingerprint(secret)
    masked = CredentialService.mask_fingerprint(fingerprint)

    assert secret not in fingerprint
    assert secret not in masked
    assert masked.startswith("••••••••")
    assert masked.endswith(fingerprint[-4:])
