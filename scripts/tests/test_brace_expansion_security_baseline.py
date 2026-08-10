from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from brace_expansion_security import VENDOR_SPEC, check_brace_expansion_security


class BraceExpansionSecurityBaselineTests(unittest.TestCase):
    def test_package_override_and_lockfile_use_only_patched_version(self) -> None:
        package = json.loads((ROOT / "apps/web/package.json").read_text(encoding="utf-8"))
        lock = json.loads((ROOT / "apps/web/package-lock.json").read_text(encoding="utf-8"))

        self.assertEqual(package["devDependencies"]["brace-expansion"], VENDOR_SPEC)
        self.assertEqual(package["overrides"]["brace-expansion"], "$brace-expansion")
        self.assertEqual(lock["packages"][""]["devDependencies"]["brace-expansion"], VENDOR_SPEC)

        entries = {
            path: value
            for path, value in lock["packages"].items()
            if path.endswith("node_modules/brace-expansion")
        }
        self.assertEqual(set(entries), {"node_modules/brace-expansion"})
        self.assertTrue(entries["node_modules/brace-expansion"]["link"])
        self.assertEqual(
            lock["packages"]["vendor/npm/brace-expansion-5.0.8-mpreply-compat"]["version"],
            "5.0.8",
        )

    def test_security_contract_reports_no_errors(self) -> None:
        errors: list[str] = []
        check_brace_expansion_security(ROOT, errors.append)
        self.assertEqual(errors, [])

    def test_integrity_checker_invokes_security_contract(self) -> None:
        checker = (ROOT / "scripts/check_integrity.py").read_text(encoding="utf-8")
        self.assertIn(
            "from brace_expansion_security import check_brace_expansion_security",
            checker,
        )
        self.assertIn("check_brace_expansion_security(ROOT, fail)", checker)


if __name__ == "__main__":
    unittest.main()
