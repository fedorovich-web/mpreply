from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.frontend_transitive_security import (
    SECURITY_PACKAGES,
    check_frontend_transitive_security,
    is_reviewed_patched_version,
    resolved_versions,
)

ROOT = Path(__file__).resolve().parents[2]


class FrontendTransitiveSecurityBaselineTests(unittest.TestCase):
    def test_reviewed_version_floors_cover_patched_release_lines(self) -> None:
        accepted = {
            "brace-expansion": ("1.1.18", "2.1.4", "3.0.6", "5.0.9"),
            "ip-address": ("10.3.1", "11.0.0"),
            "js-yaml": ("3.15.1", "4.3.1", "5.0.0"),
            "nanoid": ("3.3.17", "5.1.6"),
            "postcss": ("8.5.23", "9.0.0"),
            "undici": ("7.29.0", "8.0.0"),
        }
        rejected = {
            "brace-expansion": ("1.1.17", "2.1.3", "3.0.5", "4.0.0", "5.0.8"),
            "ip-address": ("10.3.0",),
            "js-yaml": ("3.15.0", "4.3.0"),
            "nanoid": ("3.3.16",),
            "postcss": ("8.5.22",),
            "undici": ("7.28.0",),
        }

        for package_name, versions in accepted.items():
            for version in versions:
                with self.subTest(package=package_name, version=version):
                    self.assertTrue(
                        is_reviewed_patched_version(package_name, version)
                    )

        for package_name, versions in rejected.items():
            for version in versions:
                with self.subTest(package=package_name, version=version):
                    self.assertFalse(
                        is_reviewed_patched_version(package_name, version)
                    )

    def test_lockfile_resolves_only_reviewed_patched_versions(self) -> None:
        package = json.loads(
            (ROOT / "apps" / "web" / "package.json").read_text(encoding="utf-8")
        )
        lock = json.loads(
            (ROOT / "apps" / "web" / "package-lock.json").read_text(encoding="utf-8")
        )
        packages = lock.get("packages", {})

        self.assertNotIn("brace-expansion", package.get("devDependencies", {}))
        self.assertNotIn("brace-expansion", package.get("overrides", {}))
        self.assertFalse(
            any("vendor/npm/brace-expansion" in path for path in packages),
            "brace-expansion must resolve from patched upstream release lines",
        )

        for package_name in SECURITY_PACKAGES:
            with self.subTest(package=package_name):
                versions = resolved_versions(packages, package_name)
                self.assertTrue(versions, f"{package_name} is absent from lockfile")
                self.assertTrue(
                    all(
                        is_reviewed_patched_version(package_name, version)
                        for version in versions
                    ),
                    f"{package_name} has vulnerable or unexpected versions: "
                    f"{sorted(versions)}",
                )

    def test_integrity_callback_reports_the_old_dependency_graph(self) -> None:
        package = json.loads(
            (ROOT / "apps" / "web" / "package.json").read_text(encoding="utf-8")
        )
        lock = json.loads(
            (ROOT / "apps" / "web" / "package-lock.json").read_text(encoding="utf-8")
        )
        errors: list[str] = []

        check_frontend_transitive_security(package, lock, errors.append)

        self.assertEqual(
            sorted(errors),
            sorted(
                [
                    "apps/web/package-lock.json contains vulnerable or unexpected "
                    "brace-expansion versions: ['1.1.16', '5.0.7']",
                    "apps/web/package-lock.json contains vulnerable or unexpected "
                    "ip-address versions: ['10.2.0']",
                    "apps/web/package-lock.json contains vulnerable or unexpected "
                    "js-yaml versions: ['3.15.0', '4.3.0']",
                    "apps/web/package-lock.json contains vulnerable or unexpected "
                    "nanoid versions: ['3.3.16']",
                    "apps/web/package-lock.json contains vulnerable or unexpected "
                    "postcss versions: ['8.5.18']",
                    "apps/web/package-lock.json contains vulnerable or unexpected "
                    "undici versions: ['7.28.0']",
                ]
            ),
        )


if __name__ == "__main__":
    unittest.main()
