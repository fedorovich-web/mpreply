from __future__ import annotations

import hashlib

from cryptography.fernet import Fernet, InvalidToken


class CredentialEncryptionError(RuntimeError):
    pass


class CredentialService:

    def __init__(self, encryption_key: str) -> None:
        self._fernet = Fernet(encryption_key.encode("utf-8"))

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise CredentialEncryptionError("Unable to decrypt credential") from exc

    @staticmethod
    def fingerprint(secret: str) -> str:
        return hashlib.sha256(secret.encode("utf-8")).hexdigest().upper()

    @staticmethod
    def mask_fingerprint(fingerprint: str) -> str:
        return f"••••••••{fingerprint[-4:]}"
