from __future__ import annotations

import unittest
from pathlib import Path

from scripts import check_integrity


class IntegrityQualityGateContractTests(unittest.TestCase):
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
