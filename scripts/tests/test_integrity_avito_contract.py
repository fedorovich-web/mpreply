from __future__ import annotations

import unittest

from scripts import check_integrity


class IntegrityAvitoContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_errors = list(check_integrity.ERRORS)
        check_integrity.ERRORS.clear()

    def tearDown(self) -> None:
        check_integrity.ERRORS[:] = self._previous_errors

    def test_python_import_checker_accepts_namespace_package_directories(self) -> None:
        self.assertTrue(check_integrity._python_module_exists("app.services"))
        self.assertFalse(check_integrity._python_module_exists("app.missing_namespace"))

    def test_alembic_chain_accepts_current_avito_migration_head(self) -> None:
        check_integrity.check_alembic_chain()

        self.assertEqual(check_integrity.ERRORS, [])

    def test_marketplace_scheduler_contract_accepts_enabled_avito_capability(self) -> None:
        check_integrity.check_marketplace_scheduler_contract()

        self.assertEqual(check_integrity.ERRORS, [])


if __name__ == "__main__":
    unittest.main()
