import logging
import re
from collections.abc import MutableMapping
from typing import Any

import structlog

SECRET_PATTERNS = [
    re.compile(r"(Authorization:\s*Bearer\s+)[A-Za-z0-9._\-]+", re.IGNORECASE),
    re.compile(r"(api[_-]?key['\"\s:=]+)[A-Za-z0-9._\-]+", re.IGNORECASE),
    re.compile(r"(GROQ_API_KEY=)[^\s]+", re.IGNORECASE),
    re.compile(r"(CREDENTIALS_ENCRYPTION_KEY=)[^\s]+", re.IGNORECASE),
]


def _scrub(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    scrubbed = value
    for pattern in SECRET_PATTERNS:
        scrubbed = pattern.sub(r"\1[REDACTED]", scrubbed)
    return scrubbed


def scrub_secrets(_: Any, __: str, event_dict: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    return {key: _scrub(value) for key, value in event_dict.items()}


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), format="%(message)s")
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
