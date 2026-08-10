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
EXPECTED_VERSION = "0.1.103"
EXPECTED_ALEMBIC_HEAD = "20260722_0014"

FRONTEND_SECURITY_MINIMUMS: dict[str, dict[int, tuple[int, int, int]]] = {
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

ERRORS: list[str] = []

GENERATED_ARTIFACT_PARTS = frozenset(
    {
        ".git",
        ".lighthouseci",
        ".mypy_cache",
        ".next",
        ".npm",
        ".pnpm-store",
        ".pytest_cache",
        ".qa-venv",
        ".ruff_cache",
        ".turbo",
        ".venv",
        "__pycache__",
        "blob-report",
        "coverage",
        "dist",
        "lighthouse-report",
        "node_modules",
        "out",
        "playwright-report",
        "test-results",
    }
)

GENERATED_ARTIFACT_FILES = frozenset(
    {
        ".coverage",
        "coverage.xml",
        "tsconfig.tsbuildinfo",
    }
)


def _is_generated_artifact_path(path: Path) -> bool:
    """Return true for local build, test and audit output.

    These paths are intentionally excluded from source/brand scans because
    reports can embed historical page content and are already prohibited from
    tracked release content by ``check_generated_artifacts_absent``.
    """
    try:
        relative = path.relative_to(ROOT)
    except ValueError:
        relative = path
    return (
        any(part in GENERATED_ARTIFACT_PARTS or part.endswith(".egg-info") for part in relative.parts)
        or relative.name in GENERATED_ARTIFACT_FILES
    )


TEXT_SOURCE_SUFFIXES = frozenset(
    {
        ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".py",
        ".ps1", ".sh", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
    }
)


def _is_text_source(path: Path) -> bool:
    return path.suffix.lower() in TEXT_SOURCE_SUFFIXES or ".env" in path.name.lower()


def _parse_semver(value: object) -> tuple[int, int, int] | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", value)
    if match is None:
        return None
    return tuple(int(part) for part in match.groups())


def _compact_archive_excludes(relative_path: str) -> bool:
    """Return true when a known-forensic compact handoff archive excludes a file.

    Some next-chat context archives intentionally omit large vendored npm
    tarballs while keeping `vendor/npm/README.md` and recording the omission in
    `HANDOFF/EXCLUDED_ITEMS.txt`. The integrity gate should still fail in a full
    repository when the tarballs are missing, but it must not make compact
    verification impossible when the exclusion is explicitly documented.
    """
    exclusions = ROOT / "HANDOFF" / "EXCLUDED_ITEMS.txt"
    if not exclusions.is_file():
        return False
    text = exclusions.read_text(encoding="utf-8", errors="replace")
    return any(line.split("\t", 1)[0] == relative_path for line in text.splitlines())


def require_file_unless_compact_excluded(path: Path) -> None:
    if path.is_file():
        return
    relative = path.relative_to(ROOT).as_posix()
    if _compact_archive_excludes(relative):
        return
    fail(f"Required file is missing: {path.relative_to(ROOT)}")


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
    forbidden = ["internal" + ".api.openai.org", "applied-" + "caas-" + "gateway"]
    for token in forbidden:
        if token in text:
            fail(f"package-lock.json contains forbidden internal registry token: {token}")


def check_versions_and_frontend_security_baseline() -> None:
    package = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((WEB / "package-lock.json").read_text(encoding="utf-8"))
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")
    config = (API / "app" / "core" / "config.py").read_text(encoding="utf-8")
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")
    local_compose = (ROOT / "infra" / "docker" / "docker-compose.local.yml").read_text(encoding="utf-8")
    production_compose = (ROOT / "infra" / "docker" / "docker-compose.production.yml").read_text(encoding="utf-8")
    coolify_env = (ROOT / "infra" / "coolify" / ".env.production.example").read_text(encoding="utf-8")
    web_health = (WEB / "app" / "api" / "health" / "route.ts").read_text(encoding="utf-8")

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
    for label, content in (
        ("local Compose", local_compose),
        ("production Compose", production_compose),
        ("Coolify env example", coolify_env),
    ):
        if f"APP_VERSION: {EXPECTED_VERSION}" not in content and f"APP_VERSION={EXPECTED_VERSION}" not in content:
            fail(f"{label} APP_VERSION != {EXPECTED_VERSION}")
    if f'version: "{EXPECTED_VERSION}"' not in web_health:
        fail(f"Web health route version != {EXPECTED_VERSION}")

    overrides = package.get("overrides", {})
    if overrides.get("chrome-launcher") != "1.2.1":
        fail("apps/web/package.json overrides.chrome-launcher must equal 1.2.1")
    if "@lhci/cli" in overrides:
        fail("apps/web/package.json must not use the npm-11-incompatible nested @lhci/cli override")

    lock_packages = lock.get("packages", {})
    for package_name, floors in FRONTEND_SECURITY_MINIMUMS.items():
        found_versions: list[tuple[str, tuple[int, int, int]]] = []
        suffix = f"node_modules/{package_name}"
        for path, metadata in lock_packages.items():
            if not isinstance(path, str) or not isinstance(metadata, dict):
                continue
            if path != suffix and not path.endswith(f"/{suffix}"):
                continue
            version = _parse_semver(metadata.get("version"))
            if version is None:
                fail(f"{package_name} has a non-semver lock entry at {path}")
                continue
            found_versions.append((path, version))
            floor = floors.get(version[0])
            if floor is None:
                fail(
                    f"{package_name} major {version[0]} has no approved security line at {path}"
                )
                continue
            if version < floor:
                fail(
                    f"{package_name} {'.'.join(map(str, version))} at {path} is below "
                    f"patched floor {'.'.join(map(str, floor))}"
                )
        if not found_versions:
            fail(f"{package_name} is missing from apps/web/package-lock.json")
    root_chrome_launcher = lock_packages.get("node_modules/chrome-launcher", {})
    if root_chrome_launcher.get("version") != "1.2.1":
        fail("apps/web/package-lock.json root chrome-launcher must equal 1.2.1")
    if "node_modules/lighthouse/node_modules/chrome-launcher" in lock_packages:
        fail("apps/web/package-lock.json must not retain a nested Lighthouse chrome-launcher copy")

    expected_dependencies = {
        ("dependencies", "next"): "16.2.11",
        ("devDependencies", "eslint-config-next"): "16.2.11",
        ("devDependencies", "vitest"): "4.1.10",
        ("devDependencies", "@testing-library/react"): "16.3.2",
        ("devDependencies", "@testing-library/jest-dom"): "6.9.1",
        ("devDependencies", "jsdom"): "29.1.1",
        ("devDependencies", "impeccable"): "3.2.1",
        ("devDependencies", "@playwright/test"): "1.61.1",
        ("devDependencies", "@axe-core/playwright"): "4.12.1",
        ("devDependencies", "@lhci/cli"): "0.15.1",
        ("devDependencies", "proxy-agent"): "8.0.2",
        ("devDependencies", "vnu-jar"): "26.7.11",
        ("devDependencies", "csstree-validator"): "4.0.1",
        ("overrides", "postcss"): "8.5.23",
        ("overrides", "sharp"): "0.35.3",
        ("overrides", "chrome-launcher"): "1.2.1",
        ("overrides", "tmp"): "0.2.7",
        ("overrides", "uuid"): "11.1.1",
        ("overrides", "chrome-launcher"): "1.2.1",
    }
    for (section, name), expected in expected_dependencies.items():
        actual = package.get(section, {}).get(name)
        if actual != expected:
            fail(f"apps/web/package.json {section}.{name} != {expected}; got {actual!r}")

    expected_scripts = {
        "typecheck": "next typegen && tsc --noEmit",
        "test:unit": "vitest run tests/unit --maxWorkers=1",
        "test:design-tokens": "vitest run tests/design",
        "test:frontend": "npm run test:unit && npm run test:design-tokens",
        "test:e2e": "playwright test e2e/public-site.spec.ts e2e/automation-rules.spec.ts e2e/ai-assistant.spec.ts e2e/integrations.spec.ts --project=chromium",
        "test:a11y": "playwright test e2e/accessibility.spec.ts e2e/automation-rules-accessibility.spec.ts e2e/ai-assistant-accessibility.spec.ts e2e/integrations-accessibility.spec.ts e2e/dark-theme-accessibility.spec.ts --project=chromium",
        "validate:css-syntax": "csstree-validator styles",
        "validate:w3c:html": "node scripts/validate-w3c-html.mjs",
        "validate:w3c:css": "node scripts/validate-w3c-css.mjs",
        "validate:w3c": "npm run validate:w3c:css && npm run validate:w3c:html",
    }
    for name, expected in expected_scripts.items():
        actual = package.get("scripts", {}).get(name)
        if actual != expected:
            fail(f"apps/web/package.json scripts.{name} != {expected!r}; got {actual!r}")


def check_release_gate_contract() -> None:
    release_gate = (ROOT / "scripts" / "release-gate.ps1").read_text(encoding="utf-8")
    container_gate = (ROOT / "scripts" / "container-gate.ps1").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")
    pyproject = (API / "pyproject.toml").read_text(encoding="utf-8")

    required_local_tokens = [
        "--pythonpath $VenvPython app",
        "Backend environment smoke test",
        "Backend dependency consistency",
        "Frontend dependency tree",
        "& $Npm ls --all",
        "Frontend security audit",
        "& $Npm audit --audit-level=high",
        "Frontend unit tests",
        "& $Npm run test:unit",
        "Design token tests",
        "& $Npm run test:design-tokens",
        "Frontend design anti-pattern scan",
        "& $Npm run design:detect",
        "Frontend CSS syntax validation",
        "& $Npm run validate:css-syntax",
        "Frontend W3C HTML and CSS validation",
        "& $Npm run validate:w3c",
        "Frontend critical E2E",
        "& $Npm run test:e2e",
        "Frontend accessibility",
        "& $Npm run test:a11y",
        "Repository tooling tests",
        "scripts\\tests",
        "write-release-result.mjs",
        "project-quality-result.json",
        "Release gate stopped",
    ]
    for token in required_local_tokens:
        if token not in release_gate:
            fail(f"release-gate.ps1 missing required contract: {token}")

    for token in [
        "& $Docker compose",
        "--wait",
        "/health/ready",
        "/api/health",
        "write-release-result.mjs",
        "container-gate-result.json",
    ]:
        if token not in container_gate:
            fail(f"container-gate.ps1 missing required contract: {token}")

    if '--pythonpath "$(command -v python)" app' not in workflow:
        fail("GitHub quality gate Pyright is not bound to the installed Python interpreter")
    if "npm ls --all" not in workflow:
        fail("GitHub quality gate does not validate the complete frontend dependency tree")
    if "npm audit --audit-level=high" not in workflow:
        fail("GitHub quality gate does not enforce frontend high/critical audit threshold")
    if 'python -m unittest discover -s scripts/tests -p "test_*.py"' not in workflow:
        fail("GitHub quality gate does not run repository tooling regression tests")
    for token in [
        "npm run test:unit",
        "npm run test:design-tokens",
        "npm run design:detect",
        "npm run validate:css-syntax",
        "npm run validate:w3c",
        "npx playwright install --with-deps chromium",
        "npm run test:e2e",
        "npm run test:a11y",
        "npm run lighthouse",
    ]:
        if token not in workflow:
            fail(f"GitHub quality gate missing frontend design/browser contract: {token}")
    if "Build production images" not in workflow:
        fail("GitHub quality gate does not build production Docker images")
    if '"pyright==' in pyproject:
        fail("Python pyright wrapper must not be installed; project uses official Node-based Pyright via npx")


def check_handoff_export_contract() -> None:
    exporter = (ROOT / "create-mpreply-next-chat-context-v4.mjs").read_text(encoding="utf-8")
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    required_tokens = [
        '["ls-files", "-z"]',
        '"status", "--porcelain=v1", "--untracked-files=all"',
        '"rev-list", "--left-right", "--count"',
        '"ls-remote", "--heads"',
        'function runNpm(args, cwd)',
        'process.env.ComSpec || process.env.COMSPEC || "cmd.exe"',
        'runNpm(["ls", "--package-lock-only", "--all"]',
        'project-quality-result.json',
        'container-gate-result.json',
        '"result.json"',
        'scanSecrets(files)',
        'verifyZip(root, zipPath, archiveBaseName)',
    ]
    for token in required_tokens:
        if token not in exporter:
            fail(f"Final handoff exporter missing required contract: {token}")
    if "function walk(" in exporter or "readdirSync(root" in exporter:
        fail("Final handoff exporter must not build release payload by walking the working tree")
    if ".handoff/" not in gitignore:
        fail(".gitignore must exclude generated .handoff release evidence")


def check_answer_ledger_contract() -> None:
    migration = (API / "alembic" / "versions" / "20260722_0010_answer_ledger_foundation.py").read_text(encoding="utf-8")
    service = (API / "app" / "services" / "answer_entitlement_service.py").read_text(encoding="utf-8")
    reply_execution = (API / "app" / "services" / "reply_execution_service.py").read_text(encoding="utf-8")
    config = (API / "app" / "core" / "config.py").read_text(encoding="utf-8")
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")
    local_compose = (ROOT / "infra" / "docker" / "docker-compose.local.yml").read_text(encoding="utf-8")
    production_compose = (ROOT / "infra" / "docker" / "docker-compose.production.yml").read_text(encoding="utf-8")

    for token in [
        "answer_packages",
        "answer_credit_grants",
        "answer_reservations",
        "answer_ledger_entries",
        "uq_answer_credit_grants_one_trial_per_org",
        "'trial-400', 'Trial', 'trial', 400, 0",
        "'start-500', 'Старт', 'paid', 500, 116000",
        "'optimal-5000', 'Оптимальный', 'paid', 5000, 629000",
        "'business-10000', 'Бизнес', 'paid', 10000, 899000",
        "'scale-15000', 'Масштаб', 'paid', 15000, 1259000",
        "now() + interval '7 days'",
        "CREATE TRIGGER trg_answer_ledger_entries_append_only",
        "CREATE TRIGGER trg_answer_ledger_entries_no_truncate",
        "answer_ledger_entries is append-only",
    ]:
        if token not in migration:
            fail(f"Answer ledger migration contract missing: {token}")

    for token in [
        "ledger_deltas",
        "validate_grant_contract",
        "reserve_for_reply",
        "settle_for_reply",
        "release_for_reply",
        "answer_balance_exhausted",
    ]:
        if token not in service:
            fail(f"Answer entitlement service contract missing: {token}")

    reservation_ttl_contracts = {
        "backend config": (config, "answer_reservation_ttl_seconds"),
        ".env.example": (env_example, "ANSWER_RESERVATION_TTL_SECONDS=900"),
        "local Compose": (local_compose, "ANSWER_RESERVATION_TTL_SECONDS"),
        "production Compose": (production_compose, "ANSWER_RESERVATION_TTL_SECONDS"),
    }
    for label, (content, token) in reservation_ttl_contracts.items():
        if token not in content:
            fail(f"{label} missing answer reservation TTL contract")

    reserve_index = reply_execution.find("await self.entitlements.reserve_for_reply")
    send_index = reply_execution.find("result = await self._send_through_adapter")
    settle_index = reply_execution.find("await self.entitlements.settle_for_reply")
    if min(reserve_index, send_index, settle_index) < 0 or not reserve_index < send_index < settle_index:
        fail("Reply execution must reserve before marketplace send and settle only after success")


def check_seller_settings_audit_contract() -> None:
    migration = (
        API / "alembic" / "versions" / "20260722_0011_seller_settings_audit_read_api.py"
    ).read_text(encoding="utf-8")
    main = (API / "app" / "main.py").read_text(encoding="utf-8")
    ai_service = (API / "app" / "services" / "ai_service.py").read_text(encoding="utf-8")
    organization_service = (API / "app" / "services" / "organization_service.py").read_text(encoding="utf-8")
    seller_service = (API / "app" / "services" / "seller_settings_service.py").read_text(encoding="utf-8")
    audit_service = (API / "app" / "services" / "audit_service.py").read_text(encoding="utf-8")

    for token in [
        "seller_settings",
        "uq_seller_settings_organization",
        "ON CONFLICT (organization_id) DO NOTHING",
        "CREATE TRIGGER trg_audit_logs_append_only",
        "CREATE TRIGGER trg_audit_logs_no_truncate",
        "audit_logs is append-only",
    ]:
        if token not in migration:
            fail(f"Seller settings/audit migration contract missing: {token}")

    route_contracts = {
        "audit router registration": (main, "app.include_router(audit_logs_router)"),
        "seller settings router registration": (main, "app.include_router(seller_settings_router)"),
        "AI persisted settings resolution": (ai_service, "prompt_settings.resolve"),
        "AI deterministic seller policy gate": (ai_service, "prompt_settings.policy_flags"),
        "AI audit settings marker": (ai_service, '"seller_settings_applied"'),
        "organization defaults": (organization_service, "self.seller_settings.ensure_defaults"),
        "seller settings owner/admin write boundary": (seller_service, '_WRITE_ROLES = {"owner", "admin"}'),
        "audit owner/admin read boundary": (audit_service, '_AUDIT_READ_ROLES = {"owner", "admin"}'),
        "audit keyset ordering": (audit_service, "AuditLog.created_at.desc(), AuditLog.id.desc()"),
    }
    for label, (content, token) in route_contracts.items():
        if token not in content:
            fail(f"Missing {label} contract")


def check_deployment_contract() -> None:
    required_files = [
        API / ".dockerignore",
        WEB / ".dockerignore",
        WEB / "app" / "api" / "health" / "route.ts",
        WEB / "app" / "app" / "review-queue" / "page.tsx",
        WEB / "app" / "app" / "analytics" / "page.tsx",
        WEB / "app" / "app" / "billing" / "page.tsx",
        WEB / "app" / "app" / "admin" / "page.tsx",
        WEB / "components" / "review-queue" / "ReviewQueueWorkspace.tsx",
        WEB / "components" / "analytics" / "AnalyticsWorkspace.tsx",
        WEB / "components" / "billing" / "BillingWorkspace.tsx",
        WEB / "components" / "admin" / "AdminOverviewWorkspace.tsx",
        API / "app" / "api" / "analytics.py",
        API / "app" / "api" / "billing.py",
        API / "app" / "api" / "admin.py",
        API / "app" / "services" / "analytics_service.py",
        API / "app" / "services" / "plan_limit_service.py",
        API / "app" / "models" / "billing_plan.py",
        API / "app" / "models" / "subscription.py",
        API / "app" / "models" / "answer_package.py",
        API / "app" / "models" / "answer_credit_grant.py",
        API / "app" / "models" / "answer_reservation.py",
        API / "app" / "models" / "answer_ledger_entry.py",
        API / "app" / "services" / "answer_entitlement_service.py",
        API / "app" / "tests" / "test_answer_entitlement_contract.py",
        API / "alembic" / "versions" / "20260722_0010_answer_ledger_foundation.py",
        API / "alembic" / "versions" / "20260722_0011_seller_settings_audit_read_api.py",
        API / "app" / "api" / "audit_logs.py",
        API / "app" / "api" / "seller_settings.py",
        API / "app" / "models" / "seller_settings.py",
        API / "app" / "schemas" / "audit.py",
        API / "app" / "schemas" / "seller_settings.py",
        API / "app" / "services" / "seller_settings_service.py",
        API / "app" / "tests" / "test_seller_settings_audit_contract.py",
        API / "app" / "tests" / "test_marketplace_scheduler_contract.py",
        API / "app" / "adapters" / "capabilities.py",
        API / "app" / "adapters" / "registry.py",
        API / "app" / "models" / "marketplace_sync_state.py",
        API / "app" / "services" / "marketplace_scheduler_service.py",
        API / "app" / "services" / "scheduled_sync_service.py",
        API / "app" / "workers" / "marketplace_sync.py",
        API / "app" / "scheduler" / "main.py",
        ROOT / "apps" / "scheduler" / "Dockerfile",
        WEB / "components" / "workspace" / "WorkspaceProvider.tsx",
        WEB / "components" / "providers" / "AppProviders.tsx",
        WEB / "components" / "auth" / "AuthForm.tsx",
        WEB / "app" / "auth" / "layout.tsx",
        WEB / "lib" / "api" / "client.ts",
        WEB / "lib" / "api" / "schemas.ts",
        ROOT / ".dockerignore",
        ROOT / "infra" / "docker" / "docker-compose.local.yml",
        ROOT / "infra" / "docker" / "docker-compose.production.yml",
        ROOT / "scripts" / "container-gate.ps1",
        ROOT / "scripts" / "write-release-result.mjs",
        ROOT / "scripts" / "tests" / "test_handoff_exporter.py",
        ROOT / "create-mpreply-next-chat-context-v4.mjs",
        ROOT / "infra" / "docker" / ".env.ci",
        ROOT / "docs" / "operations" / "backup-restore.md",
        ROOT / "docs" / "operations" / "incident-runbook.md",
        ROOT / "docs" / "operations" / "rollback.md",
        ROOT / "infra" / "coolify" / "deployment-checklist.md",
        ROOT / "PRODUCT.md",
        ROOT / "DESIGN.md",
        ROOT / "AGENTS.md",
        WEB / "vitest.config.ts",
        WEB / "vitest.setup.ts",
        WEB / "tests" / "unit" / "api-client.test.ts",
        WEB / "tests" / "unit" / "theme-toggle.test.tsx",
        WEB / "tests" / "unit" / "automation-rules-contract.test.ts",
        WEB / "tests" / "unit" / "automation-rules-workspace.test.tsx",
        WEB / "tests" / "unit" / "ai-assistant-contract.test.ts",
        WEB / "tests" / "unit" / "ai-assistant-workspace.test.tsx",
        WEB / "components" / "ai-assistant" / "AIAssistantWorkspace.tsx",
        WEB / "tests" / "design" / "design-tokens.test.ts",
        WEB / "scripts" / "validate-w3c-html.mjs",
        WEB / "scripts" / "validate-w3c-css.mjs",
        WEB / "styles" / "fonts.css",
        WEB / "public" / "fonts" / "onest" / "onest-400-ru-en.woff2",
        WEB / "public" / "fonts" / "onest" / "onest-500-ru-en.woff2",
        WEB / "public" / "fonts" / "onest" / "onest-600-ru-en.woff2",
        WEB / "public" / "fonts" / "onest" / "onest-700-ru-en.woff2",
        WEB / "components" / "automation-rules" / "AutomationRulesWorkspace.tsx",
        WEB / "e2e" / "helpers" / "automation-rules-api.ts",
        WEB / "e2e" / "automation-rules.spec.ts",
        WEB / "e2e" / "automation-rules-accessibility.spec.ts",
        WEB / "e2e" / "ai-assistant.spec.ts",
        WEB / "e2e" / "ai-assistant-accessibility.spec.ts",
        WEB / "e2e" / "helpers" / "ai-assistant-api.ts",
        WEB / "components" / "integrations" / "IntegrationsWorkspace.tsx",
        WEB / "components" / "integrations" / "WildberriesIntegrationWorkspace.tsx",
        WEB / "tests" / "unit" / "integrations-contract.test.ts",
        WEB / "tests" / "unit" / "integrations-workspace.test.tsx",
        WEB / "e2e" / "helpers" / "integrations-api.ts",
        WEB / "e2e" / "integrations.spec.ts",
        WEB / "e2e" / "integrations-accessibility.spec.ts",
        WEB / "e2e" / "dark-theme-accessibility.spec.ts",
        API / "app" / "tests" / "test_organization_response.py",
        WEB / "playwright.config.ts",
        WEB / "lighthouserc.cjs",
        WEB / "e2e" / "helpers" / "public-routes.ts",
        WEB / "e2e" / "public-site.spec.ts",
        WEB / "e2e" / "accessibility.spec.ts",
        WEB / "e2e" / "visual.spec.ts",
        ROOT / "scripts" / "bootstrap-design-tooling.ps1",
        ROOT / "scripts" / "web-design-gate.ps1",
        ROOT / "docs" / "product" / "public-site-master-brief.md",
        ROOT / "docs" / "brand" / "brand-foundation.md",
        ROOT / "docs" / "seo" / "public-site-seo-spec.md",
        ROOT / "docs" / "design" / "ui-ux-quality-standard.md",
        ROOT / "docs" / "design" / "asset-policy.md",
        ROOT / "docs" / "qa" / "frontend-design-tooling.md",
        ROOT / "docs" / "qa" / "sprint-13-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.18-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.19-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.20-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.22-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.24-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.25-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.26-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.84-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.85-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.86-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.97-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.98-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.99-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.100-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.102-release-report.md",
        ROOT / "docs" / "qa" / "patch-0.1.103-release-report.md",
        API / "alembic" / "versions" / "20260722_0013_team_sessions_security.py",
        API / "app" / "api" / "team.py",
        API / "app" / "models" / "auth_session.py",
        API / "app" / "models" / "organization_invitation.py",
        API / "app" / "services" / "auth_session_service.py",
        API / "app" / "services" / "team_service.py",
        API / "app" / "tests" / "test_team_sessions_security_contract.py",
        API / "alembic" / "versions" / "20260722_0014_payment_foundation.py",
        API / "app" / "api" / "payments.py",
        API / "app" / "models" / "payment_order.py",
        API / "app" / "models" / "payment_refund.py",
        API / "app" / "models" / "payment_webhook_event.py",
        API / "app" / "providers" / "yookassa.py",
        API / "app" / "schemas" / "payment.py",
        API / "app" / "services" / "payment_service.py",
        API / "app" / "tests" / "test_payment_foundation_contract.py",
        ROOT / "vendor" / "npm" / "README.md",
        ROOT / "vendor" / "npm" / "impeccable-3.2.1.tgz",
        ROOT / "vendor" / "npm" / "playwright-test-1.61.1.tgz",
        ROOT / "vendor" / "npm" / "axe-core-playwright-4.12.1.tgz",
        ROOT / "vendor" / "npm" / "lhci-cli-0.15.1.tgz",
    ]
    for path in required_files:
        if path.suffix == ".tgz" and path.parent == ROOT / "vendor" / "npm":
            require_file_unless_compact_excluded(path)
        else:
            require_file(path)

    api_dockerfile = (API / "Dockerfile").read_text(encoding="utf-8")
    worker_dockerfile = (ROOT / "apps" / "worker" / "Dockerfile").read_text(encoding="utf-8")
    scheduler_dockerfile = (ROOT / "apps" / "scheduler" / "Dockerfile").read_text(encoding="utf-8")
    web_dockerfile = (WEB / "Dockerfile").read_text(encoding="utf-8")
    next_config = (WEB / "next.config.ts").read_text(encoding="utf-8")
    production_compose = (ROOT / "infra" / "docker" / "docker-compose.production.yml").read_text(encoding="utf-8")
    ci_env_path = ROOT / "infra" / "docker" / ".env.ci"
    require_file(ci_env_path)
    ci_env = ci_env_path.read_text(encoding="utf-8") if ci_env_path.is_file() else ""
    required_ci_env_tokens = [
        "API_BASE_URL=https://api.mpreply.example",
        "WEB_APP_URL=https://app.mpreply.example",
        "PUBLIC_SITE_URL=https://mpreply.example",
        "DATABASE_URL=postgresql+asyncpg://mpreply:",
        "PAYMENT_RETURN_URL=https://app.mpreply.example/app/billing?payment=return",
        'CORS_ALLOWED_ORIGINS=["https://app.mpreply.example","https://mpreply.example"]',
        'ALLOWED_HOSTS=["api.mpreply.example"]',
        "FORWARDED_ALLOW_IPS=127.0.0.1",
        "DEPLOYMENT_VERSION=ci",
    ]
    for token in required_ci_env_tokens:
        if token not in ci_env:
            fail(f"infra/docker/.env.ci missing required CI contract: {token}")

    docker_contracts = [
        (api_dockerfile, "USER mpreply", "API image must run as non-root user"),
        (worker_dockerfile, "USER mpreply", "Worker image must run as non-root user"),
        (worker_dockerfile, "app.workers.marketplace_sync", "Worker image must load marketplace sync actors"),
        (scheduler_dockerfile, "USER mpreply", "Scheduler image must run as non-root user"),
        (scheduler_dockerfile, "app.scheduler.main", "Scheduler image must run the real scheduler module"),
        (web_dockerfile, "USER nextjs", "Web image must run as non-root user"),
        (web_dockerfile, "NEXT_PUBLIC_API_BASE_URL", "Web image must receive public API base URL at build time"),
        (next_config, 'output: "standalone"', "Next.js must use standalone output for production image"),
        (production_compose, "no-new-privileges:true", "Production Compose must enable no-new-privileges"),
        (production_compose, "service_completed_successfully", "Production Compose must gate app startup on migrations"),
        (production_compose, "scheduler:", "Production Compose must include the scheduler service"),
        (production_compose, "AUTH_SECRET_KEY is required", "Production Compose must require AUTH_SECRET_KEY"),
        (production_compose, "AUTH_INVITATION_TTL_HOURS", "Production Compose must configure invitation expiry"),
        (production_compose, "CREDENTIALS_ENCRYPTION_KEY is required", "Production Compose must require encryption key"),
        (production_compose, "FORWARDED_ALLOW_IPS is required", "Production Compose must require an explicit proxy trust boundary"),
        (production_compose, "NEXT_PUBLIC_API_BASE_URL", "Production Compose must inject the public API URL into the web build"),
    ]
    for content, token, message in docker_contracts:
        if token not in content:
            fail(message)

    if "--forwarded-allow-ips=*" in api_dockerfile:
        fail("API Dockerfile must not hardcode wildcard proxy-header trust")

    forbidden_production_tokens = ["mpreply_password", "replace-with-local-dev-secret", "replace-only-in-real-env"]
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


def check_marketplace_scheduler_contract() -> None:
    capabilities = (API / "app" / "adapters" / "capabilities.py").read_text(encoding="utf-8")
    scheduler = (API / "app" / "services" / "marketplace_scheduler_service.py").read_text(encoding="utf-8")
    execution = (API / "app" / "services" / "scheduled_sync_service.py").read_text(encoding="utf-8")
    migration = (API / "alembic" / "versions" / "20260722_0012_marketplace_scheduler_foundation.py").read_text(encoding="utf-8")

    required_tokens = {
        "capability registry": (capabilities, "Marketplace.WILDBERRIES"),
        "planned integrations remain disabled": (capabilities, 'integration_status="planned"'),
        "skip locked scheduler claims": (scheduler, ".with_for_update(skip_locked=True)"),
        "lease expiry": (scheduler, "scheduler_lease_seconds"),
        "persisted cursor execution": (execution, "state.cursor"),
        "sync-state uniqueness": (migration, "uq_marketplace_sync_states_account_stream"),
        "existing account backfill": (migration, "CROSS JOIN (VALUES ('reviews'), ('questions'))"),
    }
    for label, (content, token) in required_tokens.items():
        if token not in content:
            fail(f"Marketplace scheduler contract missing {label}: {token}")


def check_payment_foundation_contract() -> None:
    provider = (API / "app" / "providers" / "yookassa.py").read_text(encoding="utf-8")
    service = (API / "app" / "services" / "payment_service.py").read_text(encoding="utf-8")
    migration = (API / "alembic" / "versions" / "20260722_0014_payment_foundation.py").read_text(encoding="utf-8")
    config = (API / "app" / "core" / "config.py").read_text(encoding="utf-8")

    required_tokens = {
        "provider idempotency header": (provider, '"Idempotence-Key"'),
        "provider object verification": (service, "get_payment(notification.object_id)"),
        "refund object verification": (service, "get_refund(notification.object_id)"),
        "webhook source allowlist": (service, "is_allowed_source_ip"),
        "idempotent credit grant": (service, 'idempotency_key=f"payment:{order.id}:grant"'),
        "unspent-grant refund safeguard": (service, "REFUND_REVIEW_REQUIRED"),
        "payment order table": (migration, "payment_orders"),
        "webhook inbox table": (migration, "payment_webhook_events"),
        "refund table": (migration, "payment_refunds"),
        "ledger revoke type": (migration, "'revoke'"),
        "official YooKassa network": (config, '"185.71.76.0/27"'),
    }
    for label, (content, token) in required_tokens.items():
        if token not in content:
            fail(f"Payment foundation contract missing {label}: {token}")



def check_brand_identity_contract() -> None:
    legacy_lower = "".join(("res", "pio"))
    legacy_title = legacy_lower.capitalize()
    legacy_upper = legacy_lower.upper()

    required_assets = [
        WEB / "public" / "favicon-96x96.png",
        WEB / "public" / "favicon.svg",
        WEB / "public" / "favicon.ico",
        WEB / "public" / "apple-touch-icon.png",
        WEB / "public" / "web-app-manifest-192x192.png",
        WEB / "public" / "web-app-manifest-512x512.png",
        WEB / "public" / "site.webmanifest",
        WEB / "public" / "logo" / "logo.avif",
        WEB / "public" / "logo" / "logo.webp",
        WEB / "public" / "logo" / "logo-canvas.avif",
        WEB / "public" / "logo" / "logo-canvas.webp",
    ]
    for asset in required_assets:
        require_file(asset)
        if asset.is_file() and asset.stat().st_size == 0:
            fail(f"Brand asset is empty: {asset.relative_to(ROOT)}")

    manifest_path = WEB / "public" / "site.webmanifest"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("name") != "MP Reply" or manifest.get("short_name") != "MP Reply":
            fail("site.webmanifest must use MP Reply for name and short_name")

    site_config = (WEB / "lib" / "site-config.ts").read_text(encoding="utf-8")
    layout = (WEB / "app" / "layout.tsx").read_text(encoding="utf-8")
    logo_component = (WEB / "components" / "public-site" / "BrandLogo.tsx").read_text(encoding="utf-8")
    header = (WEB / "components" / "public-site" / "PublicHeader.tsx").read_text(encoding="utf-8")
    footer = (WEB / "components" / "public-site" / "PublicShell.tsx").read_text(encoding="utf-8")
    canvas = (WEB / "components" / "public-site" / "HeroProductFlowCanvas.tsx").read_text(encoding="utf-8")
    cookies = (API / "app" / "core" / "cookies.py").read_text(encoding="utf-8")
    api_config = (API / "app" / "core" / "config.py").read_text(encoding="utf-8")
    web_package = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    api_project = (API / "pyproject.toml").read_text(encoding="utf-8")

    required_tokens = {
        "canonical domain": (site_config, '"https://mpreply.ru"'),
        "site name": (site_config, 'name: "MP Reply"'),
        "horizontal AVIF logo": (logo_component, 'avif: "/logo/logo.avif"'),
        "horizontal WebP fallback": (logo_component, 'webp: "/logo/logo.webp"'),
        "canvas AVIF logo": (logo_component, 'avif: "/logo/logo-canvas.avif"'),
        "canvas WebP fallback": (logo_component, 'webp: "/logo/logo-canvas.webp"'),
        "header logo": (header, 'className="public-brand-logo"'),
        "footer logo": (footer, 'className="public-footer-brand-logo"'),
        "favicon PNG": (layout, 'href="/favicon-96x96.png"'),
        "favicon SVG": (layout, 'href="/favicon.svg"'),
        "favicon ICO": (layout, 'href="/favicon.ico"'),
        "Apple touch icon": (layout, 'href="/apple-touch-icon.png"'),
        "web manifest": (layout, 'href="/site.webmanifest"'),
        "new access cookie": (cookies, 'ACCESS_COOKIE_NAME = "mpreply_access"'),
        "new refresh cookie": (cookies, 'REFRESH_COOKIE_NAME = "mpreply_refresh"'),
        "backend app name": (api_config, 'app_name: str = "MPReply"'),
        "backend package": (api_project, 'name = "mpreply-api"'),
    }
    for label, (content, token) in required_tokens.items():
        if token not in content:
            fail(f"Brand identity contract missing {label}: {token}")

    if web_package.get("name") != "mpreply-web":
        fail("apps/web/package.json name must be mpreply-web")
    if "<BrandLogo" in canvas or 'variant="canvas"' in canvas:
        fail("Product-flow Canvas must not duplicate the MP Reply logo")
    if "public-footer-topline" in footer or "<strong>Материалы</strong>" in footer:
        fail("Footer must integrate brand copy into the main grid without a Materials column")

    visible_brand_sources = [
        *sorted((WEB / "app").rglob("*.tsx")),
        *sorted((WEB / "components").rglob("*.tsx")),
        WEB / "lib" / "site-config.ts",
        WEB / "lib" / "public-pricing.ts",
        WEB / "public" / "site.webmanifest",
    ]
    for source in visible_brand_sources:
        if source.is_file() and "MPReply" in source.read_text(encoding="utf-8"):
            fail(f"Visible frontend brand must be written as MP Reply: {source.relative_to(ROOT)}")

    roots = [
        ROOT / ".env.example",
        ROOT / ".github",
        ROOT / "AGENTS.md",
        ROOT / "DESIGN.md",
        ROOT / "PATCH_README.md",
        ROOT / "PRODUCT.md",
        ROOT / "README.md",
        ROOT / "apps",
        ROOT / "docs",
        ROOT / "infra",
        ROOT / "packages",
        ROOT / "scripts",
    ]
    for source_root in roots:
        paths = [source_root] if source_root.is_file() else source_root.rglob("*")
        for source in paths:
            if not source.is_file() or not _is_text_source(source):
                continue
            if _is_generated_artifact_path(source):
                continue
            content = source.read_text(encoding="utf-8", errors="replace")
            if any(token in content for token in (legacy_lower, legacy_title, legacy_upper)):
                fail(f"Legacy brand token remains in {source.relative_to(ROOT)}")

    for source_root in (ROOT / "apps", ROOT / "docs", ROOT / "infra", ROOT / "scripts"):
        for path in source_root.rglob("*"):
            if legacy_lower in path.name.lower():
                fail(f"Legacy brand path remains: {path.relative_to(ROOT)}")

def check_generated_artifacts_absent() -> None:
    forbidden_names = GENERATED_ARTIFACT_PARTS | GENERATED_ARTIFACT_FILES
    paths = _git_tracked_paths()

    if paths is None:
        # A handoff archive has no .git directory, so every file physically
        # present in the extracted snapshot is release content and must be
        # checked directly. In a working Git repository we inspect only tracked
        # paths so normal local caches do not create false positives.
        paths = [path for path in ROOT.rglob("*") if path.is_file()]

    reported: set[Path] = set()
    for path in paths:
        relative = path.relative_to(ROOT)
        parts = relative.parts
        for index, part in enumerate(parts):
            is_forbidden = part in forbidden_names or part.endswith(".egg-info")
            if not is_forbidden:
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
    check_handoff_export_contract()
    check_answer_ledger_contract()
    check_seller_settings_audit_contract()
    check_marketplace_scheduler_contract()
    check_payment_foundation_contract()
    check_brand_identity_contract()
    check_deployment_contract()
    check_generated_artifacts_absent()

    if ERRORS:
        print("Integrity gate failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print(
        "Integrity gate passed: routes, Python/TypeScript imports, migrations, versions, "
        "dependency baseline, brand identity, release gates and deployment contracts are consistent."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
