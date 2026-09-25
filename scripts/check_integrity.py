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
EXPECTED_VERSION = "0.1.27"
EXPECTED_ALEMBIC_HEAD = "20260710_0009"

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
    ci_env = (ROOT / "infra" / "docker" / ".env.ci").read_text(encoding="utf-8")
    dokploy_checklist = (ROOT / "infra" / "dokploy" / "deployment-checklist.md").read_text(encoding="utf-8")
    dokploy_env = (ROOT / "infra" / "dokploy" / ".env.production.example").read_text(encoding="utf-8")
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
        ("Dokploy env example", dokploy_env),
    ):
        if f"APP_VERSION: {EXPECTED_VERSION}" not in content and f"APP_VERSION={EXPECTED_VERSION}" not in content:
            fail(f"{label} APP_VERSION != {EXPECTED_VERSION}")
    if f'version: "{EXPECTED_VERSION}"' not in web_health:
        fail(f"Web health route version != {EXPECTED_VERSION}")

    expected_dependencies = {
        ("dependencies", "next"): "16.3.4",
        ("devDependencies", "eslint-config-next"): "16.3.4",
        ("devDependencies", "vitest"): "5.0.0",
        ("devDependencies", "@testing-library/react"): "16.3.2",
        ("devDependencies", "@testing-library/jest-dom"): "6.9.1",
        ("devDependencies", "jsdom"): "29.1.1",
        ("devDependencies", "impeccable"): "3.2.1",
        ("devDependencies", "@playwright/test"): "1.61.1",
        ("devDependencies", "playwright-core"): "1.61.1",
        ("devDependencies", "@axe-core/playwright"): "4.12.1",
        ("devDependencies", "@lhci/cli"): "0.15.1",
        ("devDependencies", "vnu-jar"): "26.7.11",
        ("devDependencies", "csstree-validator"): "4.0.1",
        ("overrides", "postcss"): "8.5.28",
        ("overrides", "tmp"): "0.2.7",
        ("overrides", "uuid"): "11.1.1",
    }
    for (section, name), expected in expected_dependencies.items():
        actual = package.get(section, {}).get(name)
        if actual != expected:
            fail(f"apps/web/package.json {section}.{name} != {expected}; got {actual!r}")

    expected_scripts = {
        "test:unit": "vitest run tests/unit",
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
        "Frontend production dependency security audit",
        "& $Npm audit --omit=dev --audit-level=high",
        "Frontend unit tests",
        "& $Npm run test:unit",
        "Design token tests",
        "& $Npm run test:design-tokens",
        "Frontend CSS syntax validation",
        "& $Npm run validate:css-syntax",
        "Frontend W3C HTML and CSS validation",
        "& $Npm run validate:w3c",
        "Frontend critical E2E",
        "& $Npm run test:e2e",
        "Frontend accessibility",
        "& $Npm run test:a11y",
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
    if "npm audit --omit=dev --audit-level=high" not in workflow:
        fail("GitHub quality gate does not enforce frontend high/critical audit threshold")
    for token in [
        "npm run test:unit",
        "npm run test:design-tokens",
        "npm run validate:css-syntax",
        "npm run validate:w3c",
        "npx playwright install --with-deps chromium",
        "npm run test:e2e",
        "npm run test:a11y",
        "npm run lighthouse",
    ]:
        if token not in workflow:
            fail(f"GitHub quality gate missing frontend browser/quality contract: {token}")
    if "Build production images" not in workflow:
        fail("GitHub quality gate does not build production Docker images")
    if '"pyright==' in pyproject:
        fail("Python pyright wrapper must not be installed; project uses official Node-based Pyright via npx")


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
        ROOT / "docs" / "operations" / "backup-restore.md",
        ROOT / "docs" / "operations" / "incident-runbook.md",
        ROOT / "docs" / "operations" / "rollback.md",
        ROOT / "infra" / "dokploy" / "deployment-checklist.md",
        ROOT / "PRODUCT.md",
        ROOT / "DESIGN.md",
        ROOT / "AGENTS.md",
        WEB / "vitest.config.ts",
        WEB / "vitest.setup.ts",
        WEB / "tests" / "unit" / "api-client.test.ts",
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
        ROOT / "vendor" / "npm" / "README.md",
        ROOT / "vendor" / "npm" / "impeccable-3.2.1.tgz",
        ROOT / "vendor" / "npm" / "playwright-test-1.61.1.tgz",
        ROOT / "vendor" / "npm" / "axe-core-playwright-4.12.1.tgz",
        ROOT / "vendor" / "npm" / "lhci-cli-0.15.1.tgz",
    ]
    for path in required_files:
        require_file(path)

    api_dockerfile = (API / "Dockerfile").read_text(encoding="utf-8")
    worker_dockerfile = (ROOT / "apps" / "worker" / "Dockerfile").read_text(encoding="utf-8")
    web_dockerfile = (WEB / "Dockerfile").read_text(encoding="utf-8")
    next_config = (WEB / "next.config.ts").read_text(encoding="utf-8")
    production_compose = (ROOT / "infra" / "docker" / "docker-compose.production.yml").read_text(encoding="utf-8")
    ci_env = (ROOT / "infra" / "docker" / ".env.ci").read_text(encoding="utf-8")
    dokploy_checklist = (ROOT / "infra" / "dokploy" / "deployment-checklist.md").read_text(encoding="utf-8")
    web_health = (WEB / "app" / "api" / "health" / "route.ts").read_text(encoding="utf-8")
    observability = (API / "app" / "core" / "observability.py").read_text(encoding="utf-8")

    docker_contracts = [
        (api_dockerfile, "USER mpreply", "API image must run as non-root user"),
        (worker_dockerfile, "USER mpreply", "Worker image must run as non-root user"),
        (web_dockerfile, "USER nextjs", "Web image must run as non-root user"),
        (web_dockerfile, "NEXT_PUBLIC_API_BASE_URL", "Web image must receive public API base URL at build time"),
        (next_config, 'output: "standalone"', "Next.js must use standalone output for production image"),
        (production_compose, "no-new-privileges:true", "Production Compose must enable no-new-privileges"),
        (production_compose, "service_completed_successfully", "Production Compose must gate app startup on migrations"),
        (production_compose, "AUTH_SECRET_KEY is required", "Production Compose must require AUTH_SECRET_KEY"),
        (production_compose, "CREDENTIALS_ENCRYPTION_KEY is required", "Production Compose must require encryption key"),
        (production_compose, "FORWARDED_ALLOW_IPS is required", "Production Compose must require an explicit proxy trust boundary"),
        (production_compose, "NEXT_PUBLIC_API_BASE_URL", "Production Compose must inject the public API URL into the web build"),
    ]
    for content, token, message in docker_contracts:
        if token not in content:
            fail(message)

    if "--forwarded-allow-ips=*" in api_dockerfile:
        fail("API Dockerfile must not hardcode wildcard proxy-header trust")
    if 'app: "mpreply-web"' not in web_health:
        fail("Web health route must expose the MPReply runtime name")
    if 'release=f"mpreply-api@{settings.app_version}"' not in observability:
        fail("Sentry release identity must use mpreply-api")

    forbidden_production_tokens = ["respio_password", "replace-with-local-dev-secret", "replace-only-in-real-env"]
    for token in forbidden_production_tokens:
        if token in production_compose:
            fail(f"Production Compose contains forbidden hardcoded placeholder/secret: {token}")

    production_identity_sources = {
        "production Compose": production_compose,
        "CI environment": ci_env,
        "Dokploy checklist": dokploy_checklist,
    }
    forbidden_legacy_identity = [
        "respio.ru",
        "respio.example",
        "fedorovich-web/respio",
        "name: respio-production",
        "APP_NAME=Respio",
    ]
    for label, content in production_identity_sources.items():
        for token in forbidden_legacy_identity:
            if token in content:
                fail(f"{label} still contains legacy Respio production identity: {token}")

    current_brand_docs = [
        ROOT / "PRODUCT.md",
        ROOT / "DESIGN.md",
        ROOT / "AGENTS.md",
        ROOT / "docs" / "brand" / "brand-foundation.md",
        ROOT / "docs" / "design" / "ui-ux-quality-standard.md",
        ROOT / "docs" / "design" / "asset-policy.md",
        ROOT / "docs" / "product" / "product-baseline.md",
        ROOT / "docs" / "automation-rules-engine-v1.md",
        ROOT / "docs" / "security" / "marketplace-credentials-lifecycle.md",
        ROOT / "docs" / "operations" / "backup-restore.md",
        ROOT / "docs" / "operations" / "incident-runbook.md",
        ROOT / "infra" / "docker" / "README.md",
        ROOT / "infra" / "dokploy" / "deployment-checklist.md",
        ROOT / "infra" / "dokploy" / "service-map.md",
        ROOT / "packages" / "design-tokens" / "README.md",
    ]
    for path in current_brand_docs:
        content = path.read_text(encoding="utf-8")
        if "Respio" in content:
            fail(f"Current product/source-of-truth document still uses the legacy Respio brand: {path.relative_to(ROOT)}")


def check_production_raster_assets() -> None:
    """Production raster assets must ship as WebP.

    Playwright visual-regression baselines intentionally remain PNG under e2e/
    and are not served by the application.
    """
    public_dir = WEB / "public"
    forbidden_suffixes = {".png", ".jpg", ".jpeg"}

    for path in public_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in forbidden_suffixes:
            fail(
                "Production raster asset must be WebP: "
                f"{path.relative_to(ROOT)}"
            )

    source_roots = [
        WEB / "app",
        WEB / "components",
        WEB / "lib",
        WEB / "styles",
    ]
    source_suffixes = {".ts", ".tsx", ".js", ".mjs", ".css"}
    raster_reference = re.compile(r"\.(?:png|jpe?g)(?:[\"')?#]|$)", flags=re.I)

    for source_root in source_roots:
        for path in source_root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in source_suffixes:
                continue
            text = path.read_text(encoding="utf-8")
            if raster_reference.search(text):
                fail(
                    "Production source references PNG/JPEG instead of WebP: "
                    f"{path.relative_to(ROOT)}"
                )


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
    forbidden_names = {
        "node_modules",
        ".next",
        ".venv",
        ".qa-venv",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        ".coverage",
        "coverage.xml",
    }
    paths = _git_tracked_paths()

    if paths is None:
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
    check_deployment_contract()
    check_production_raster_assets()
    check_generated_artifacts_absent()

    if ERRORS:
        print("Integrity gate failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print("Integrity gate passed: routes, Python/TypeScript imports, migrations, versions, dependency baseline, release gates, deployment contracts and production raster assets are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
