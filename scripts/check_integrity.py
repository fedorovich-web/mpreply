from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
API = ROOT / "apps" / "api"

ERRORS: list[str] = []


def fail(message: str) -> None:
    ERRORS.append(message)


def check_public_routes() -> None:
    site_config = WEB / "lib" / "site-config.ts"
    text = site_config.read_text(encoding="utf-8")
    match = re.search(r"export const publicRoutes = \[(.*?)\] as const;", text, flags=re.S)
    if not match:
        fail("Cannot parse publicRoutes from apps/web/lib/site-config.ts")
        return

    routes = re.findall(r'"([^"]+)"', match.group(1))
    for route in routes:
        page = WEB / "app" / ("page.tsx" if route == "/" else route.strip("/") + "/page.tsx")
        if not page.exists():
            fail(f"Public route has no page.tsx: {route} -> {page.relative_to(ROOT)}")


def resolve_ts_import(source: Path, specifier: str) -> bool:
    if not specifier.startswith("."):
        return True
    base = (source.parent / specifier).resolve()
    candidates = [
        base,
        base.with_suffix(".ts"),
        base.with_suffix(".tsx"),
        base.with_suffix(".js"),
        base / "index.ts",
        base / "index.tsx",
        base / "index.js",
    ]
    return any(candidate.exists() for candidate in candidates)


def check_ts_imports() -> None:
    import_pattern = re.compile(r'(?:from\s+|import\s*\()\s*["\']([^"\']+)["\']')
    for source in list(WEB.rglob("*.ts")) + list(WEB.rglob("*.tsx")):
        if any(part in {"node_modules", ".next"} for part in source.parts):
            continue
        text = source.read_text(encoding="utf-8")
        for specifier in import_pattern.findall(text):
            if not resolve_ts_import(source, specifier):
                fail(f"Unresolved relative TypeScript import: {source.relative_to(ROOT)} -> {specifier}")


def check_alembic_chain() -> None:
    versions_dir = API / "alembic" / "versions"
    revisions: dict[str, str | None] = {}
    for file in versions_dir.glob("*.py"):
        tree = ast.parse(file.read_text(encoding="utf-8"), filename=str(file))
        revision = None
        down_revision = None
        for node in tree.body:
            if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                if node.target.id == "revision" and isinstance(node.value, ast.Constant):
                    revision = node.value.value
                if node.target.id == "down_revision" and isinstance(node.value, ast.Constant):
                    down_revision = node.value.value
        if not isinstance(revision, str):
            fail(f"Migration missing revision: {file.relative_to(ROOT)}")
            continue
        revisions[revision] = down_revision if isinstance(down_revision, str) else None

    for revision, down_revision in revisions.items():
        if down_revision is not None and down_revision not in revisions:
            fail(f"Migration {revision} references missing down_revision {down_revision}")

    referenced = {down for down in revisions.values() if down is not None}
    heads = sorted(set(revisions) - referenced)
    if len(heads) != 1:
        fail(f"Expected exactly one Alembic head, found: {heads}")
    elif heads[0] != "20260710_0007":
        fail(f"Unexpected Alembic head: {heads[0]}")


def check_lockfile_hygiene() -> None:
    lockfile = WEB / "package-lock.json"
    text = lockfile.read_text(encoding="utf-8")
    forbidden = ["internal.api.openai.org", "applied-caas-gateway"]
    for token in forbidden:
        if token in text:
            fail(f"package-lock.json contains forbidden internal registry token: {token}")


def check_versions() -> None:
    package = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((WEB / "package-lock.json").read_text(encoding="utf-8"))
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")
    config = (API / "app" / "core" / "config.py").read_text(encoding="utf-8")
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")

    expected = "0.1.8"
    if package.get("version") != expected:
        fail(f"apps/web/package.json version != {expected}")
    if lock.get("version") != expected or lock.get("packages", {}).get("", {}).get("version") != expected:
        fail(f"apps/web/package-lock.json version != {expected}")
    if f'version = "{expected}"' not in pyproject:
        fail(f"apps/api/pyproject.toml version != {expected}")
    if f'app_version: str = "{expected}"' not in config:
        fail(f"Backend app_version != {expected}")
    if f"APP_VERSION={expected}" not in env_example:
        fail(f".env.example APP_VERSION != {expected}")



def check_release_gate_contract() -> None:
    release_gate = (ROOT / "scripts" / "release-gate.ps1").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")

    required_local_tokens = [
        "--pythonpath $VenvPython app",
        "Backend environment smoke test",
        "Backend dependency consistency",
        "Release gate stopped",
    ]
    for token in required_local_tokens:
        if token not in release_gate:
            fail(f"release-gate.ps1 missing required fail-fast/environment contract: {token}")

    if '--pythonpath "$(command -v python)" app' not in workflow:
        fail("GitHub quality gate Pyright is not bound to the installed Python interpreter")

    if '"pyright==' in pyproject:
        fail("Python pyright wrapper must not be installed; project uses official Node-based Pyright via npx")

def main() -> int:
    check_public_routes()
    check_ts_imports()
    check_alembic_chain()
    check_lockfile_hygiene()
    check_versions()
    check_release_gate_contract()

    if ERRORS:
        print("Integrity gate failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print("Integrity gate passed: routes, imports, migrations, lockfile and versions are consistent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
