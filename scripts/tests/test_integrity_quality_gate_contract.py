from __future__ import annotations

import unittest

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


if __name__ == "__main__":
    unittest.main()
