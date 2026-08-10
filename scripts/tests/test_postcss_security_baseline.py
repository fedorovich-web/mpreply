from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_POSTCSS_VERSION = "8.5.23"


class PostCssSecurityBaselineTests(unittest.TestCase):
    def test_package_override_and_lockfile_are_patched(self) -> None:
        package = json.loads(
            (ROOT / "apps" / "web" / "package.json").read_text(encoding="utf-8")
        )
        lock = json.loads(
            (ROOT / "apps" / "web" / "package-lock.json").read_text(encoding="utf-8")
        )

        self.assertEqual(
            package.get("overrides", {}).get("postcss"),
            EXPECTED_POSTCSS_VERSION,
        )

        postcss_versions = {
            path: data.get("version")
            for path, data in lock.get("packages", {}).items()
            if path.endswith("node_modules/postcss") and isinstance(data, dict)
        }
        self.assertTrue(postcss_versions)
        self.assertEqual(
            set(postcss_versions.values()),
            {EXPECTED_POSTCSS_VERSION},
        )

    def test_integrity_checker_enforces_patched_version(self) -> None:
        checker = (ROOT / "scripts" / "check_integrity.py").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            '("overrides", "postcss"): "8.5.23"',
            checker,
        )
        self.assertNotIn(
            '("overrides", "postcss"): "8.5.18"',
            checker,
        )


if __name__ == "__main__":
    unittest.main()
