from __future__ import annotations

import ast
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
API = ROOT / "apps" / "api"
EXPECTED_VERSION = "0.1.9"
EXPECTED_ALEMBIC_HEAD = "20260710_0007"

ERRORS: list[str] = []


def fail(message: str) -> None:
    ERRORS.append(message)


def require_file(path: Path) -> None:
    if not path.is_file():
        fail(f"Required file is missing: {path.relative_to(ROOT)}")


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


def _python_module_exists(module_name: str) -> bool:
    if not module_name.startswith("app"):
        return True
    relative = module_name.split(".")[1:]
    base = API / "app"
    candidate = base.joinpath(*relative)
    return candidate.with_suffix(".py").is_file() or (candidate / "__init__.py").is_file()


def check_python_imports() -> None:
    for source in (API / "app").rglob("*.py"):
        tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if not _python_module_exists(alias.name):
                        fail(f"Unresolved Python import: {source.relative_to(ROOT)} -> {alias.name}")
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                if not _python_module_exists(node.module):
                    fail(f"Unresolved Python import: {source.relative_to(ROOT)} -> {node.module}")


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
    elif heads[0] != EXPECTED_ALEMBIC_HEAD:
        fail(f"Unexpected Alembic head: {heads[0]}")


def check_lockfile_hygiene() -> None:
    lockfile = WEB / "package-lock.json"
    text = lockfile.read_text(encoding="utf-8")
    forbidden = ["internal.api.openai.org", "applied-caas-gateway"]
    for token in forbidden:
        if token in text:
            fail(f"package-lock.json contains forbidden internal registry token: {token}")


def check_versions_and_frontend_security_baseline() -> None:
    package = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((WEB / "package-lock.json").read_text(encoding="utf-8"))
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")
    config = (API / "app" / "core" / "config.py").read_text(encoding="utf-8")
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")

    if package.get("version") != EXPECTED_VERSION:
        fail(f"apps/web/package.json version != {EXPECTED_VERSION}")
    if lock.get("version") != EXPECTED_VERSION or lock.get("packages", {}).get("", {}).get("version") != EXPECTED_VERSION:
        fail(f"apps/web/package-lock.json version != {EXPECTED_VERSION}")
    if f'version = "{EXPECTED_VERSION}"' not in pyproject:
        fail(f"apps/api/pyproject.toml version != {EXPECTED_VERSION}")
    if f'app_version: str = "{EXPECTED_VERSION}"' not in config:
        fail(f"Backend app_version != {EXPECTED_VERSION}")
    if f"APP_VERSION={EXPECTED_VERSION}" not in env_example:
        fail(f".env.example APP_VERSION != {EXPECTED_VERSION}")

    expected_dependencies = {
        ("dependencies", "next"): "16.2.10",
        ("devDependencies", "eslint-config-next"): "16.2.10",
        ("devDependencies", "vitest"): "4.1.10",
        ("overrides", "postcss"): "8.5.10",
    }
    for (section, name), expected in expected_dependencies.items():
        actual = package.get(section, {}).get(name)
        if actual != expected:
            fail(f"apps/web/package.json {section}.{name} != {expected}; got {actual!r}")


def check_release_gate_contract() -> None:
    release_gate = (ROOT / "scripts" / "release-gate.ps1").read_text(encoding="utf-8")
    container_gate = (ROOT / "scripts" / "container-gate.ps1").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")

    required_local_tokens = [
        "--pythonpath $VenvPython app",
        "Backend environment smoke test",
        "Backend dependency consistency",
        "Frontend security audit",
        "& $Npm audit --audit-level=high",
        "Release gate stopped",
    ]
    for token in required_local_tokens:
        if token not in release_gate:
            fail(f"release-gate.ps1 missing required contract: {token}")

    for token in ["& $Docker compose", "--wait", "/health/ready", "/api/health"]:
        if token not in container_gate:
            fail(f"container-gate.ps1 missing required contract: {token}")

    if '--pythonpath "$(command -v python)" app' not in workflow:
        fail("GitHub quality gate Pyright is not bound to the installed Python interpreter")
    if "npm audit --audit-level=high" not in workflow:
        fail("GitHub quality gate does not enforce frontend high/critical audit threshold")
    if "Build production images" not in workflow:
        fail("GitHub quality gate does not build production Docker images")
    if '"pyright==' in pyproject:
        fail("Python pyright wrapper must not be installed; project uses official Node-based Pyright via npx")


def check_deployment_contract() -> None:
    required_files = [
        API / ".dockerignore",
        WEB / ".dockerignore",
        WEB / "app" / "api" / "health" / "route.ts",
        ROOT / ".dockerignore",
        ROOT / "infra" / "docker" / "docker-compose.local.yml",
        ROOT / "infra" / "docker" / "docker-compose.production.yml",
        ROOT / "scripts" / "container-gate.ps1",
        ROOT / "docs" / "operations" / "backup-restore.md",
        ROOT / "docs" / "operations" / "incident-runbook.md",
        ROOT / "docs" / "operations" / "rollback.md",
        ROOT / "infra" / "coolify" / "deployment-checklist.md",
    ]
    for path in required_files:
        require_file(path)

    api_dockerfile = (API / "Dockerfile").read_text(encoding="utf-8")
    worker_dockerfile = (ROOT / "apps" / "worker" / "Dockerfile").read_text(encoding="utf-8")
    web_dockerfile = (WEB / "Dockerfile").read_text(encoding="utf-8")
    next_config = (WEB / "next.config.ts").read_text(encoding="utf-8")
    production_compose = (ROOT / "infra" / "docker" / "docker-compose.production.yml").read_text(encoding="utf-8")

    docker_contracts = [
        (api_dockerfile, "USER respio", "API image must run as non-root user"),
        (worker_dockerfile, "USER respio", "Worker image must run as non-root user"),
        (web_dockerfile, "USER nextjs", "Web image must run as non-root user"),
        (next_config, 'output: "standalone"', "Next.js must use standalone output for production image"),
        (production_compose, "no-new-privileges:true", "Production Compose must enable no-new-privileges"),
        (production_compose, "service_completed_successfully", "Production Compose must gate app startup on migrations"),
        (production_compose, "AUTH_SECRET_KEY is required", "Production Compose must require AUTH_SECRET_KEY"),
        (production_compose, "CREDENTIALS_ENCRYPTION_KEY is required", "Production Compose must require encryption key"),
        (production_compose, "FORWARDED_ALLOW_IPS is required", "Production Compose must require an explicit proxy trust boundary"),
    ]
    for content, token, message in docker_contracts:
        if token not in content:
            fail(message)

    if "--forwarded-allow-ips=*" in api_dockerfile:
        fail("API Dockerfile must not hardcode wildcard proxy-header trust")

    forbidden_production_tokens = ["respio_password", "replace-with-local-dev-secret", "replace-only-in-real-env"]
    for token in forbidden_production_tokens:
        if token in production_compose:
            fail(f"Production Compose contains forbidden hardcoded placeholder/secret: {token}")


def _git_tracked_paths() -> list[Path] | None:
    """Return tracked repository paths when Git metadata is available.

    Local developer caches such as .venv, node_modules and .next are expected to
    exist in a working tree and must not make the integrity gate fail. The release
    rule is that generated artifacts must not be tracked or shipped.
    """
    git = shutil.which("git")
    if git is None:
        return None

    result = subprocess.run(
        [git, "-C", str(ROOT), "ls-files", "-z"],
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        return None

    return [ROOT / entry.decode("utf-8") for entry in result.stdout.split(b"\0") if entry]


def check_generated_artifacts_absent() -> None:
    forbidden_names = {"node_modules", ".next", ".venv", "__pycache__", ".pytest_cache", ".ruff_cache"}
    paths = _git_tracked_paths()

    if paths is None:
        # Extracted release archives have no .git directory, so inspect the archive
        # tree itself. Developer working trees use the tracked-file path above.
        paths = [path for path in ROOT.rglob("*") if path.is_file()]

    reported: set[Path] = set()
    for path in paths:
        relative = path.relative_to(ROOT)
        parts = relative.parts
        for index, part in enumerate(parts):
            if part not in forbidden_names:
                continue
            artifact = Path(*parts[: index + 1])
            if artifact not in reported:
                reported.add(artifact)
                fail(f"Generated artifact must not be tracked or included in release archive: {artifact}")
            break


def main() -> int:
    check_public_routes()
    check_ts_imports()
    check_python_imports()
    check_alembic_chain()
    check_lockfile_hygiene()
    check_versions_and_frontend_security_baseline()
    check_release_gate_contract()
    check_deployment_contract()
    check_generated_artifacts_absent()

    if ERRORS:
        print("Integrity gate failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print("Integrity gate passed: routes, Python/TypeScript imports, migrations, versions, dependency baseline, release gates and deployment contracts are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
