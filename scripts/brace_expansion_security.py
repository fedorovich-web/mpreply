from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

EXPECTED_VERSION = "5.0.8"
VENDOR_RELATIVE = Path("apps/web/vendor/npm/brace-expansion-5.0.8-mpreply-compat")
VENDOR_SPEC = "file:vendor/npm/brace-expansion-5.0.8-mpreply-compat"


def check_brace_expansion_security(root: Path, fail: Callable[[str], None]) -> None:
    web = root / "apps" / "web"
    package_path = web / "package.json"
    lock_path = web / "package-lock.json"
    vendor = root / VENDOR_RELATIVE

    package = json.loads(package_path.read_text(encoding="utf-8"))
    lock_text = lock_path.read_text(encoding="utf-8")
    lock = json.loads(lock_text)

    if package.get("devDependencies", {}).get("brace-expansion") != VENDOR_SPEC:
        fail(f"apps/web/package.json devDependencies.brace-expansion must equal {VENDOR_SPEC}")
    if package.get("overrides", {}).get("brace-expansion") != "$brace-expansion":
        fail("apps/web/package.json overrides.brace-expansion must reference the direct dependency")

    lock_packages = lock.get("packages", {})
    root_package = lock_packages.get("", {})
    if root_package.get("devDependencies", {}).get("brace-expansion") != VENDOR_SPEC:
        fail("apps/web/package-lock.json root brace-expansion dependency is not synchronized")

    brace_entries = {
        path: value
        for path, value in lock_packages.items()
        if path.endswith("node_modules/brace-expansion") and isinstance(value, dict)
    }
    if set(brace_entries) != {"node_modules/brace-expansion"}:
        fail(
            "apps/web/package-lock.json must contain exactly one hoisted "
            f"brace-expansion entry; got {sorted(brace_entries)}"
        )
    else:
        link = brace_entries["node_modules/brace-expansion"]
        if link.get("link") is not True:
            fail("apps/web/package-lock.json brace-expansion entry must be a local link")
        if link.get("resolved") != "vendor/npm/brace-expansion-5.0.8-mpreply-compat":
            fail("apps/web/package-lock.json brace-expansion link points to an unexpected path")

    vendor_entry = lock_packages.get("vendor/npm/brace-expansion-5.0.8-mpreply-compat")
    if not isinstance(vendor_entry, dict) or vendor_entry.get("version") != EXPECTED_VERSION:
        fail("apps/web/package-lock.json is missing the vendored brace-expansion 5.0.8 entry")

    for vulnerable in ('"version": "1.1.16"', '"version": "5.0.7"'):
        if vulnerable in lock_text:
            fail(f"apps/web/package-lock.json retains vulnerable brace-expansion {vulnerable}")

    required = [
        vendor / "package.json",
        vendor / "index.js",
        vendor / "index.d.ts",
        vendor / "LICENSE",
        vendor / "README.md",
        vendor / "PROVENANCE.md",
    ]
    for path in required:
        if not path.is_file():
            fail(f"Required brace-expansion vendor file is missing: {path.relative_to(root)}")

    if not all(path.is_file() for path in required):
        return

    vendor_package = json.loads((vendor / "package.json").read_text(encoding="utf-8"))
    implementation = (vendor / "index.js").read_text(encoding="utf-8")
    provenance = (vendor / "PROVENANCE.md").read_text(encoding="utf-8")

    if vendor_package.get("name") != "brace-expansion" or vendor_package.get("version") != EXPECTED_VERSION:
        fail("Vendored brace-expansion package identity is invalid")
    for token in (
        "const EXPANSION_MAX_LENGTH = 4_000_000;",
        "module.exports = expand;",
        "module.exports.expand = expand;",
    ):
        if token not in implementation:
            fail(f"Vendored brace-expansion implementation is missing contract: {token}")
    if "GHSA-mh99-v99m-4gvg" not in provenance or "CVE-2026-14257" not in provenance:
        fail("Vendored brace-expansion provenance is missing the advisory identifiers")
