from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import check_integrity


class IntegrityQualityGateContractTests(unittest.TestCase):
    def test_cms_quality_contract_reports_every_missing_pipeline_boundary(self) -> None:
        self.assertEqual(
            check_integrity.cms_quality_contract_errors("", ""),
            [
                "Local release gate does not validate the CMS application",
                "GitHub quality gate does not validate the CMS application",
                "GitHub quality gate does not build CMS production images",
                "GitHub container gate is not blocked by CMS validation",
            ],
        )

    def test_release_gate_contract_includes_cms_validator_findings(self) -> None:
        previous_errors = list(check_integrity.ERRORS)
        check_integrity.ERRORS.clear()
        try:
            with patch.object(
                check_integrity,
                "cms_quality_contract_errors",
                return_value=["sentinel CMS contract failure"],
            ):
                check_integrity.check_release_gate_contract()

            self.assertIn("sentinel CMS contract failure", check_integrity.ERRORS)
        finally:
            check_integrity.ERRORS[:] = previous_errors

    def test_release_gate_accepts_api_local_virtual_environment_fallback(self) -> None:
        root = Path(__file__).resolve().parents[2]
        release_gate = (root / "scripts" / "release-gate.ps1").read_text(encoding="utf-8")

        self.assertIn('$VenvCandidates = @(', release_gate)
        self.assertIn('Join-Path $Root ".venv"', release_gate)
        self.assertIn('Join-Path $Api ".venv"', release_gate)
        self.assertIn('$VenvHasPip', release_gate)
        self.assertIn('& $Uv pip check --python $VenvPython', release_gate)
        self.assertIn('& $VenvPython -m pytest -q', release_gate)

    def test_quality_gate_accepts_explicit_production_image_builds(self) -> None:
        previous_errors = list(check_integrity.ERRORS)
        check_integrity.ERRORS.clear()
        try:
            check_integrity.check_release_gate_contract()

            self.assertNotIn(
                "GitHub quality gate does not build production Docker images",
                check_integrity.ERRORS,
            )
        finally:
            check_integrity.ERRORS[:] = previous_errors

    def test_production_compose_enables_application_rate_limiting(self) -> None:
        root = Path(__file__).resolve().parents[2]
        compose = (root / "infra" / "docker" / "docker-compose.production.yml").read_text(encoding="utf-8")

        self.assertIn('RATE_LIMIT_ENABLED: "true"', compose)

    def test_auth_security_contract_is_complete(self) -> None:
        previous_errors = list(check_integrity.ERRORS)
        check_integrity.ERRORS.clear()
        try:
            check_integrity.check_auth_security_contract()

            self.assertEqual(check_integrity.ERRORS, [])
        finally:
            check_integrity.ERRORS[:] = previous_errors


if __name__ == "__main__":
    unittest.main()
