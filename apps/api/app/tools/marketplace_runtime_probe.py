from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, cast

from app.adapters.base import AdapterResult

FinalStatus = Literal["PASS", "FAIL", "BLOCKED", "AMBIGUOUS"]

_SCHEMA_VERSION = 2
_GIT_SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
_AMBIGUOUS_ERROR_CODES = frozenset(
    {
        "network_timeout",
        "network_error",
        "rate_limited",
        "marketplace_unavailable",
        "malformed_payload",
        "marketplace_malformed_response",
    }
)
_BLOCKED_ERROR_CODES = frozenset(
    {
        "invalid_credentials",
        "insufficient_scope",
        "payment_required",
    }
)


@dataclass(frozen=True)
class ProbeStep:
    name: str
    status: FinalStatus
    error_code: str | None = None
    retry_after_seconds: int | None = None
    pages_checked: int | None = None
    items_seen: int | None = None


@dataclass(frozen=True)
class RuntimeProbeReport:
    schema_version: int
    provider: str
    mode: str
    status: FinalStatus
    started_at: str
    finished_at: str
    git_sha: str
    app_version: str
    credential_fingerprint: str
    account_id_masked: str
    page_budget: int
    pages_checked: int
    scopes: list[str]
    steps: list[ProbeStep]
    write_target_fingerprint: str | None
    write_attempted: bool
    write_confirmed: bool | None

    def to_json_dict(self) -> dict[str, object]:
        return cast(dict[str, object], asdict(self))


def fingerprint(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"sha256:{digest[:12]}"


def mask_identifier(value: str) -> str:
    return f"masked:{len(value.strip())}chars"


def safe_scopes(result: AdapterResult) -> list[str]:
    payload: object | None = result.data
    if not isinstance(payload, dict):
        return []
    data = cast(dict[str, object], payload)
    raw_scopes = data.get("scopes")
    if not isinstance(raw_scopes, list):
        return []
    return sorted(
        {
            scope
            for value in cast(list[object], raw_scopes)
            if isinstance(value, str) and (scope := value.strip())
        }
    )


def classify_result(result: AdapterResult, *, write_started: bool) -> FinalStatus:
    if result.ok:
        return "PASS"
    error_code = result.error_code or "marketplace_error"
    if write_started and error_code in _AMBIGUOUS_ERROR_CODES:
        return "AMBIGUOUS"
    if error_code in _BLOCKED_ERROR_CODES:
        return "BLOCKED"
    return "FAIL"


def validate_git_sha(value: str) -> str:
    if not _GIT_SHA_PATTERN.fullmatch(value):
        raise ValueError("MPREPLY_GIT_SHA must be a canonical lowercase 40-character Git SHA")
    return value


def build_report(
    *,
    provider: str,
    mode: str,
    status: FinalStatus,
    started_at: datetime,
    finished_at: datetime,
    git_sha: str,
    app_version: str,
    credential: str,
    account_id: str,
    page_budget: int,
    pages_checked: int,
    scopes: list[str],
    steps: list[ProbeStep],
    write_target: str | None,
    write_attempted: bool,
    write_confirmed: bool | None,
) -> RuntimeProbeReport:
    if not provider.strip():
        raise ValueError("provider is required")
    if not mode.strip():
        raise ValueError("mode is required")
    if not app_version.strip():
        raise ValueError("app_version is required")
    if page_budget < 1:
        raise ValueError("page_budget must be positive")
    if pages_checked < 0:
        raise ValueError("pages_checked cannot be negative")
    canonical_git_sha = validate_git_sha(git_sha)
    normalized_target = (write_target or "").strip()
    return RuntimeProbeReport(
        schema_version=_SCHEMA_VERSION,
        provider=provider.strip(),
        mode=mode.strip(),
        status=status,
        started_at=_utc_isoformat(started_at),
        finished_at=_utc_isoformat(finished_at),
        git_sha=canonical_git_sha,
        app_version=app_version.strip(),
        credential_fingerprint=fingerprint(credential),
        account_id_masked=mask_identifier(account_id),
        page_budget=page_budget,
        pages_checked=pages_checked,
        scopes=sorted(set(scopes)),
        steps=list(steps),
        write_target_fingerprint=fingerprint(normalized_target) if normalized_target else None,
        write_attempted=write_attempted,
        write_confirmed=write_confirmed,
    )


def assert_evidence_safe(serialized: str, *, forbidden_values: tuple[str, ...]) -> None:
    for value in forbidden_values:
        if value and value in serialized:
            raise ValueError("runtime evidence contains a forbidden value")


def write_report_atomic(
    path: Path,
    report: RuntimeProbeReport,
    *,
    forbidden_values: tuple[str, ...],
) -> None:
    serialized = json.dumps(report.to_json_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    assert_evidence_safe(serialized, forbidden_values=forbidden_values)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=f".{path.name}.",
            suffix=".tmp",
            dir=path.parent,
            delete=False,
        ) as temporary:
            temporary.write(serialized)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        temporary_path.replace(path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def exit_code(status: FinalStatus) -> int:
    return {"PASS": 0, "FAIL": 2, "BLOCKED": 3, "AMBIGUOUS": 4}[status]


def _utc_isoformat(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("runtime evidence timestamps must be timezone-aware")
    return value.astimezone(UTC).isoformat()
