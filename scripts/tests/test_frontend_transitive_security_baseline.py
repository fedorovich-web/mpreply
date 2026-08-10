from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "apps" / "web"

EXPECTED_OVERRIDES: dict[str, object] = {
    "@eslint/eslintrc": {"js-yaml": "4.3.1"},
    "@lhci/utils": {"js-yaml": "3.15.1"},
    "ip-address": "10.3.1",
    "nanoid": "3.3.17",
    "postcss": "8.5.23",
    "undici": "7.29.0",
}

EXPECTED_LOCK_VERSIONS: dict[str, set[str]] = {
    "ip-address": {"10.3.1"},
    "js-yaml": {"3.15.1", "4.3.1"},
    "nanoid": {"3.3.17"},
    "postcss": {"8.5.23"},
    "undici": {"7.29.0"},
}

class FrontendTransitiveSecurityBaselineTests(unittest.TestCase):
    def test_package_overrides_pin_reviewed_security_versions(self) -> None:
        package = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
        overrides = package["overrides"]
        for name, expected in EXPECTED_OVERRIDES.items():
            self.assertEqual(overrides[name], expected)

    def test_lockfile_contains_only_reviewed_security_versions(self) -> None:
        lock = json.loads((WEB / "package-lock.json").read_text(encoding="utf-8"))
        packages = lock["packages"]
        for name, expected_versions in EXPECTED_LOCK_VERSIONS.items():
            entries = {
                data.get("version")
                for path, data in packages.items()
                if path.endswith(f"node_modules/{name}") and isinstance(data, dict)
            }
            self.assertEqual(entries, expected_versions, name)

if __name__ == "__main__":
    unittest.main()
