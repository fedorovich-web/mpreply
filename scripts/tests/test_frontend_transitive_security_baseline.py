from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SECURITY_MINIMUMS: dict[str, dict[int, tuple[int, int, int]]] = {
    "brace-expansion": {
        1: (1, 1, 18),
        2: (2, 1, 4),
        3: (3, 0, 6),
        5: (5, 0, 9),
    },
    "postcss": {8: (8, 5, 23)},
    "ip-address": {10: (10, 3, 1)},
    "js-yaml": {
        3: (3, 15, 1),
        4: (4, 3, 1),
        5: (5, 2, 1),
    },
    "nanoid": {
        3: (3, 3, 17),
        5: (5, 1, 6),
    },
    "undici": {
        6: (6, 28, 0),
        7: (7, 29, 0),
        8: (8, 9, 0),
    },
}


def parse_semver(value: object) -> tuple[int, int, int] | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", value)
    if match is None:
        return None
    return tuple(int(part) for part in match.groups())


class FrontendTransitiveSecurityBaselineTests(unittest.TestCase):
    def test_lockfile_contains_only_patched_transitive_versions(self) -> None:
        lock = json.loads(
            (ROOT / "apps" / "web" / "package-lock.json").read_text(
                encoding="utf-8"
            )
        )
        packages = lock.get("packages", {})

        for package_name, floors in SECURITY_MINIMUMS.items():
            found: list[tuple[str, tuple[int, int, int]]] = []
            suffix = f"node_modules/{package_name}"
            for path, metadata in packages.items():
                if not isinstance(path, str) or not isinstance(metadata, dict):
                    continue
                if path != suffix and not path.endswith(f"/{suffix}"):
                    continue
                version = parse_semver(metadata.get("version"))
                self.assertIsNotNone(
                    version,
                    msg=f"{package_name} has a non-semver lock entry at {path}",
                )
                assert version is not None
                found.append((path, version))
                floor = floors.get(version[0])
                self.assertIsNotNone(
                    floor,
                    msg=(
                        f"{package_name} major {version[0]} has no approved "
                        f"security line at {path}"
                    ),
                )
                assert floor is not None
                self.assertGreaterEqual(
                    version,
                    floor,
                    msg=(
                        f"{package_name} {'.'.join(map(str, version))} at {path} "
                        f"is below patched floor {'.'.join(map(str, floor))}"
                    ),
                )
            self.assertTrue(found, msg=f"{package_name} is missing from package-lock.json")

    def test_integrity_checker_enforces_current_security_floors(self) -> None:
        checker = (ROOT / "scripts" / "check_integrity.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("FRONTEND_SECURITY_MINIMUMS", checker)
        self.assertIn('("overrides", "postcss"): "8.5.23"', checker)
        self.assertNotIn('("overrides", "postcss"): "8.5.18"', checker)


if __name__ == "__main__":
    unittest.main()
