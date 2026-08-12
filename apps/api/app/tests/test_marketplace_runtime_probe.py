from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import pytest

from app.adapters.base import AdapterResult
from app.tools.marketplace_runtime_probe import (
    ProbeStep,
    RuntimeProbeReport,
    build_report,
    classify_result,
    exit_code,
    fingerprint,
    mask_identifier,
    safe_scopes,
    validate_git_sha,
    write_report_atomic,
)


def _sample_report() -> RuntimeProbeReport:
    return build_report(
        provider="wildberries",
        mode="read-only",
        status="PASS",
        started_at=datetime(2026, 8, 12, 10, 0, tzinfo=UTC),
        finished_at=datetime(2026, 8, 12, 10, 1, tzinfo=UTC),
        git_sha="a" * 40,
        app_version="0.1.103",
        credential="raw-secret",
        account_id="123456",
        page_budget=2,
        pages_checked=2,
        scopes=["fetch_questions", "fetch_reviews"],
        steps=[ProbeStep(name="validate_credentials", status="PASS")],
        write_target="target-77",
        write_attempted=False,
        write_confirmed=None,
    )


@pytest.mark.parametrize(
    "error_code",
    [
        "network_timeout",
        "network_error",
        "rate_limited",
        "marketplace_unavailable",
        "malformed_payload",
        "marketplace_malformed_response",
    ],
)
def test_post_write_uncertainty_is_ambiguous(error_code: str) -> None:
    result = AdapterResult(ok=False, error_code=error_code, error_message_safe="Safe local message")

    assert classify_result(result, write_started=True) == "AMBIGUOUS"


@pytest.mark.parametrize("error_code", ["invalid_credentials", "insufficient_scope", "payment_required"])
def test_pre_write_access_failure_is_blocked(error_code: str) -> None:
    result = AdapterResult(ok=False, error_code=error_code, error_message_safe="Safe local message")

    assert classify_result(result, write_started=False) == "BLOCKED"


def test_definite_pre_write_validation_error_fails() -> None:
    result = AdapterResult(ok=False, error_code="marketplace_validation_error")

    assert classify_result(result, write_started=False) == "FAIL"
    assert classify_result(AdapterResult(ok=True), write_started=True) == "PASS"


def test_scope_normalization_accepts_only_non_empty_strings() -> None:
    result = AdapterResult(
        ok=True,
        data={"scopes": [" fetch_reviews ", "fetch_questions", "fetch_reviews", 7, None, ""]},
    )

    assert safe_scopes(result) == ["fetch_questions", "fetch_reviews"]
    assert safe_scopes(AdapterResult(ok=True, data={"scopes": "fetch_reviews"})) == []
    assert safe_scopes(AdapterResult(ok=True, data=None)) == []


def test_report_contains_only_masked_identifiers_and_fingerprints() -> None:
    report = _sample_report()

    assert report.schema_version == 2
    assert report.provider == "wildberries"
    assert report.status == "PASS"
    assert report.started_at == "2026-08-12T10:00:00+00:00"
    assert report.finished_at == "2026-08-12T10:01:00+00:00"
    assert report.credential_fingerprint == fingerprint("raw-secret")
    assert report.account_id_masked == mask_identifier("123456")
    assert report.write_target_fingerprint == fingerprint("target-77")
    assert "raw-secret" not in json.dumps(report.to_json_dict())
    assert "123456" not in json.dumps(report.to_json_dict())
    assert "target-77" not in json.dumps(report.to_json_dict())


def test_atomic_writer_rejects_forbidden_values_without_replacing_previous_evidence(tmp_path: Path) -> None:
    output = tmp_path / "evidence.json"
    output.write_text('{"previous":true}\n', encoding="utf-8")
    unsafe_report = replace(_sample_report(), provider="raw-secret")

    with pytest.raises(ValueError, match="forbidden value"):
        write_report_atomic(output, unsafe_report, forbidden_values=("raw-secret",))

    assert output.read_text(encoding="utf-8") == '{"previous":true}\n'
    assert list(tmp_path.glob("*.tmp")) == []


def test_atomic_writer_creates_parseable_sanitized_evidence(tmp_path: Path) -> None:
    output = tmp_path / "nested" / "evidence.json"
    report = _sample_report()

    write_report_atomic(
        output,
        report,
        forbidden_values=("raw-secret", "123456", "target-77", "Synthetic reply"),
    )

    raw = output.read_text(encoding="utf-8")
    parsed_raw: object = json.loads(raw)
    assert isinstance(parsed_raw, dict)
    parsed = cast(dict[str, object], parsed_raw)
    assert parsed["status"] == "PASS"
    assert parsed["git_sha"] == "a" * 40
    assert "raw-secret" not in raw
    assert "123456" not in raw
    assert "target-77" not in raw
    assert "Synthetic reply" not in raw
    assert list(output.parent.glob("*.tmp")) == []


@pytest.mark.parametrize("value", ["", "a" * 39, "g" * 40, "A" * 40])
def test_git_sha_validation_rejects_non_canonical_values(value: str) -> None:
    with pytest.raises(ValueError, match="Git SHA"):
        validate_git_sha(value)


def test_exit_codes_keep_ambiguous_and_blocked_non_successful() -> None:
    assert exit_code("PASS") == 0
    assert exit_code("FAIL") == 2
    assert exit_code("BLOCKED") == 3
    assert exit_code("AMBIGUOUS") == 4
