from __future__ import annotations

from collections.abc import Callable
from typing import cast

SECURITY_PACKAGES = (
    "brace-expansion",
    "ip-address",
    "js-yaml",
    "nanoid",
    "postcss",
    "undici",
)


def version_tuple(value: str) -> tuple[int, int, int] | None:
    core = value.split("-", 1)[0]
    parts = core.split(".")
    if len(parts) < 3 or not all(part.isdecimal() for part in parts[:3]):
        return None
    return int(parts[0]), int(parts[1]), int(parts[2])


def is_reviewed_patched_version(package_name: str, version: str) -> bool:
    parsed = version_tuple(version)
    if parsed is None:
        return False

    if package_name == "brace-expansion":
        major = parsed[0]
        floors = {
            1: (1, 1, 18),
            2: (2, 1, 4),
            3: (3, 0, 6),
            5: (5, 0, 9),
        }
        floor = floors.get(major)
        return floor is not None and parsed >= floor

    if package_name == "ip-address":
        return parsed >= (10, 3, 1)

    if package_name == "js-yaml":
        if parsed[0] == 3:
            return parsed >= (3, 15, 1)
        return parsed >= (4, 3, 1)

    if package_name == "nanoid":
        return parsed >= (3, 3, 17)

    if package_name == "postcss":
        return parsed >= (8, 5, 23)

    if package_name == "undici":
        return parsed >= (7, 29, 0)

    return False


def resolved_versions(
    lock_packages: dict[str, object],
    package_name: str,
) -> set[str]:
    versions: set[str] = set()
    suffix = f"/node_modules/{package_name}"
    root_path = f"node_modules/{package_name}"

    for path, raw_entry in lock_packages.items():
        if path != root_path and not path.endswith(suffix):
            continue
        if not isinstance(raw_entry, dict):
            continue
        entry = cast(dict[str, object], raw_entry)
        version = entry.get("version")
        if version is not None:
            versions.add(str(version))

    return versions


def check_frontend_transitive_security(
    package: dict[str, object],
    lock: dict[str, object],
    fail: Callable[[str], None],
) -> None:
    dev_dependencies_raw = package.get("devDependencies")
    overrides_raw = package.get("overrides")
    lock_packages_raw = lock.get("packages")

    dev_dependencies = (
        cast(dict[str, object], dev_dependencies_raw)
        if isinstance(dev_dependencies_raw, dict)
        else {}
    )
    overrides = (
        cast(dict[str, object], overrides_raw)
        if isinstance(overrides_raw, dict)
        else {}
    )
    lock_packages = (
        cast(dict[str, object], lock_packages_raw)
        if isinstance(lock_packages_raw, dict)
        else {}
    )

    if "brace-expansion" in dev_dependencies:
        fail("apps/web/package.json must not pin brace-expansion directly")
    if "brace-expansion" in overrides:
        fail(
            "apps/web/package.json must not globally override brace-expansion "
            "across incompatible major lines"
        )
    if any("vendor/npm/brace-expansion" in path for path in lock_packages):
        fail("apps/web/package-lock.json must not use vendored brace-expansion")

    for package_name in SECURITY_PACKAGES:
        versions = resolved_versions(lock_packages, package_name)
        if not versions:
            fail(f"apps/web/package-lock.json is missing {package_name}")
            continue
        if not all(
            is_reviewed_patched_version(package_name, version)
            for version in versions
        ):
            fail(
                "apps/web/package-lock.json contains vulnerable or unexpected "
                f"{package_name} versions: {sorted(versions)}"
            )
