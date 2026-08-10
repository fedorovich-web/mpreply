from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "apps" / "web"
VENDOR_SPEC = "file:vendor/npm/brace-expansion-5.0.8-mpreply-compat"
VENDOR_PATH = WEB / "vendor" / "npm" / "brace-expansion-5.0.8-mpreply-compat"
EXPECTED_VERSION = "5.0.8"


class BraceExpansionSecurityBaselineTests(unittest.TestCase):
    def test_package_override_and_lockfile_use_only_patched_version(self) -> None:
        package = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((WEB / "package-lock.json").read_text(encoding="utf-8"))

        self.assertEqual(package["devDependencies"]["brace-expansion"], VENDOR_SPEC)
        self.assertEqual(package["overrides"]["brace-expansion"], "$brace-expansion")
        self.assertEqual(lock["packages"][""]["devDependencies"]["brace-expansion"], VENDOR_SPEC)

        entries = {
            path: data
            for path, data in lock["packages"].items()
            if path.endswith("node_modules/brace-expansion") and isinstance(data, dict)
        }
        self.assertEqual(set(entries), {"node_modules/brace-expansion"})
        entry = entries["node_modules/brace-expansion"]
        self.assertTrue(entry["link"])
        self.assertEqual(entry["resolved"], "vendor/npm/brace-expansion-5.0.8-mpreply-compat")
        package_entry = lock["packages"]["vendor/npm/brace-expansion-5.0.8-mpreply-compat"]
        self.assertEqual(package_entry["name"], "brace-expansion")
        self.assertEqual(package_entry["version"], EXPECTED_VERSION)

    def test_vendored_directory_matches_lock_and_contract(self) -> None:
        lock = json.loads((WEB / "package-lock.json").read_text(encoding="utf-8"))
        link = lock["packages"]["node_modules/brace-expansion"]
        package_entry = lock["packages"]["vendor/npm/brace-expansion-5.0.8-mpreply-compat"]

        self.assertTrue(link["link"])
        self.assertEqual(link["resolved"], "vendor/npm/brace-expansion-5.0.8-mpreply-compat")
        self.assertEqual(package_entry["name"], "brace-expansion")
        self.assertEqual(package_entry["version"], EXPECTED_VERSION)

        vendored_package = json.loads((VENDOR_PATH / "package.json").read_text(encoding="utf-8"))
        index_source = (VENDOR_PATH / "index.js").read_text(encoding="utf-8")
        provenance = (VENDOR_PATH / "PROVENANCE.md").read_text(encoding="utf-8")
        self.assertTrue((VENDOR_PATH / "LICENSE").is_file())

        self.assertEqual(vendored_package["name"], "brace-expansion")
        self.assertEqual(vendored_package["version"], EXPECTED_VERSION)
        self.assertIn("module.exports = expand", index_source)
        self.assertIn("module.exports.expand = expand", index_source)
        self.assertIn("EXPANSION_MAX_LENGTH = 4_000_000", index_source)
        self.assertIn("GHSA-mh99-v99m-4gvg", provenance)
        self.assertIn("a1bd33999ea75262c4749fff3bbb0d1372bd07b5", provenance)

    def test_docker_dependency_stage_copies_vendored_directory_before_npm_ci(self) -> None:
        dockerfile = (WEB / "Dockerfile").read_text(encoding="utf-8")
        vendor_copy = dockerfile.index("COPY vendor/npm/brace-expansion-5.0.8-mpreply-compat")
        npm_ci = dockerfile.index("RUN npm ci")
        self.assertLess(vendor_copy, npm_ci)

    def test_integrity_checker_enforces_brace_expansion_contract(self) -> None:
        checker = (ROOT / "scripts" / "check_integrity.py").read_text(encoding="utf-8")
        for token in [
            'BRACE_EXPANSION_VENDOR_SPEC = "file:vendor/npm/brace-expansion-5.0.8-mpreply-compat"',
            '("devDependencies", "brace-expansion"): BRACE_EXPANSION_VENDOR_SPEC',
            '("overrides", "brace-expansion"): "$brace-expansion"',
            'EXPECTED_BRACE_EXPANSION_VERSION = "5.0.8"',
            'brace-expansion-5.0.8-mpreply-compat',
            'if not brace_vendor.is_dir():',
        ]:
            self.assertIn(token, checker)
        self.assertNotIn("require_file(brace_vendor)", checker)


if __name__ == "__main__":
    unittest.main()
