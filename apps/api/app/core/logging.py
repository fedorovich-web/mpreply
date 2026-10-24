import logging
import re
from collections.abc import Mapping, MutableMapping, Sequence
from typing import cast

import structlog

SECRET_PATTERNS = (
    re.compile(r"(Authorization:\s*Bearer\s+)[A-Za-z0-9._\-]+", re.IGNORECASE),
    re.compile(r"(api[_-]?key['\"\s:=]+)[A-Za-z0-9._\-]+", re.IGNORECASE),
    re.compile(r"((?:access|refresh)[_-]?token['\"\s:=]+)[^\s,}\]]+", re.IGNORECASE),
    re.compile(r"(client[_-]?secret['\"\s:=]+)[^\s,}\]]+", re.IGNORECASE),
    re.compile(r"(GROQ_API_KEY=)[^\s]+", re.IGNORECASE),
    re.compile(r"(CREDENTIALS_ENCRYPTION_KEY=)[^\s]+", re.IGNORECASE),
)

_SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "set_cookie",
        "api_key",
        "apikey",
        "access_token",
        "refresh_token",
        "client_secret",
        "password",
        "password_hash",
        "credentials",
        "credentials_encrypted",
        "raw_credentials",
        "secret",
    }
)


def _normalized_key(key: object) -> str:
    return str(key).strip().lower().replace("-", "_")


def _scrub(value: object) -> object:
    if isinstance(value, str):
        scrubbed = value
        for pattern in SECRET_PATTERNS:
            scrubbed = pattern.sub(r"\1[REDACTED]", scrubbed)
        return scrubbed
    if isinstance(value, Mapping):
        mapping = cast(Mapping[object, object], value)
        return {key: "[REDACTED]" if _normalized_key(key) in _SENSITIVE_KEYS else _scrub(item) for key, item in mapping.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_scrub(item) for item in cast(Sequence[object], value)]
    return value


def scrub_secrets(
    _: object,
    __: str,
    event_dict: MutableMapping[str, object],
) -> MutableMapping[str, object]:
    return {key: "[REDACTED]" if _normalized_key(key) in _SENSITIVE_KEYS else _scrub(value) for key, value in event_dict.items()}


class QuerySafeAccessLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) == 5 and isinstance(record.args[2], str):
            record.args = (*record.args[:2], record.args[2].split("?", 1)[0], *record.args[3:])
        return True


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), format="%(message)s")
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(item, QuerySafeAccessLogFilter) for item in access_logger.filters):
        access_logger.addFilter(QuerySafeAccessLogFilter())
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            scrub_secrets,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level.upper(), logging.INFO)),
        cache_logger_on_first_use=True,
    )
