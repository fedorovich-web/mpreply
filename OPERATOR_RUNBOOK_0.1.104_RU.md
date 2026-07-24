# MP Reply 0.1.104 — Yandex Market dashboard batch

Этот runbook относится к полной рабочей копии `mpreply-0.1.104-yandex-dashboard`.

## Подтверждённый baseline

- репозиторий: `fedorovich-web/respio`;
- ветка: `work/0.1.104-yandex-foundation`;
- HEAD: `ecf0b170060681dd6747d6871a8b44e72c39c6c1`;
- версия контрактов: `0.1.103`;
- новый batch: health/status, scopes, sync streams, sync jobs и integration events для кабинета Яндекс Маркета;
- migrations: отсутствуют;
- version bump: отсутствует.

Не распаковывайте полный ZIP поверх Git checkout. Сначала распакуйте его в отдельную директорию, затем перенесите exact scope.

## 1. Проверка текущего checkout

Выполните блок целиком:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repository = "C:\Work\respio"
$ExpectedBranch = "work/0.1.104-yandex-foundation"
$ExpectedHead = "ecf0b170060681dd6747d6871a8b44e72c39c6c1"

Set-Location $Repository

git fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch failed: $LASTEXITCODE" }

$Branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "git branch failed: $LASTEXITCODE" }
if ($Branch -ne $ExpectedBranch) { throw "Unexpected branch: $Branch" }

$Head = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "git rev-parse failed: $LASTEXITCODE" }
if ($Head -ne $ExpectedHead) { throw "Unexpected HEAD: $Head" }

$RemoteLine = @(git ls-remote --heads origin "refs/heads/$ExpectedBranch")
if ($LASTEXITCODE -ne 0) { throw "git ls-remote failed: $LASTEXITCODE" }
if ($RemoteLine.Count -ne 1) { throw "Remote feature branch not found" }
$RemoteHead = (($RemoteLine[0] -split "\s+")[0]).Trim()
if ($RemoteHead -ne $ExpectedHead) { throw "Unexpected remote HEAD: $RemoteHead" }

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "git status failed: $LASTEXITCODE" }
if ($Status.Count -ne 0) { throw "Checkout is not clean:`n$($Status -join "`n")" }

Write-Host "BASELINE PREFLIGHT: PASS"
```

## 2. Распаковка полного проекта

Укажите фактический путь скачанного ZIP:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Archive = "$env:USERPROFILE\Downloads\mpreply-0.1.104-yandex-dashboard.zip"
$ExtractRoot = "C:\Work\mpreply-0.1.104-yandex-dashboard-artifact"

if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) {
    throw "Archive not found: $Archive"
}
if (Test-Path -LiteralPath $ExtractRoot) {
    throw "Extraction directory already exists: $ExtractRoot"
}

Expand-Archive -LiteralPath $Archive -DestinationPath $ExtractRoot

$Source = Join-Path $ExtractRoot "mpreply-0.1.104-yandex-dashboard"
if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Project root not found after extraction: $Source"
}

Write-Host "PROJECT EXTRACTION: PASS"
Write-Host "Source: $Source"
```

## 3. Проверка внутреннего manifest

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Source = "C:\Work\mpreply-0.1.104-yandex-dashboard-artifact\mpreply-0.1.104-yandex-dashboard"
$Manifest = Join-Path $Source "PROJECT_MANIFEST_SHA256.txt"

if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
    throw "Manifest missing: $Manifest"
}

$Verified = 0
foreach ($Line in Get-Content -LiteralPath $Manifest) {
    if ($Line -notmatch '^([0-9a-f]{64})  (.+)$') {
        throw "Malformed manifest line: $Line"
    }
    $ExpectedHash = $Matches[1]
    $RelativePath = $Matches[2]
    $File = Join-Path $Source ($RelativePath -replace '/', '\')
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
        throw "Manifest file missing: $RelativePath"
    }
    $ActualHash = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ActualHash -ne $ExpectedHash) {
        throw "Manifest mismatch: $RelativePath"
    }
    $Verified += 1
}

Write-Host "INTERNAL MANIFEST: PASS ($Verified files)"
```

## 4. Перенос exact scope

Эффективный scope dashboard-инкремента — **18 файлов**. `apps/api/app/services/marketplace_account_service.py` не входит в commit: после Ruff-коррекции файл байт-в-байт совпадает с baseline commit `ecf0b170060681dd6747d6871a8b44e72c39c6c1`.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repository = "C:\Work\respio"
$Source = "C:\Work\mpreply-0.1.104-yandex-dashboard-artifact\mpreply-0.1.104-yandex-dashboard"

$Paths = @(
    "README.md",
    "DEVELOPMENT_STATUS_0.1.104.md",
    "OPERATOR_RUNBOOK_0.1.104_RU.md",
    "DEVELOPMENT_EVIDENCE/CHANGED_PATHS.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_OBSERVABILITY_2026-07-24.md",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_TARGETED_TESTS.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_AVAILABLE_SUITE.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_TS_PARSER.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_CSS_PARSER.txt",
    "docs/integrations/yandex-market.md",
    "apps/api/app/api/marketplace_accounts.py",
    "apps/api/app/schemas/marketplace_overview.py",
    "apps/api/app/services/marketplace_account_overview_service.py",
    "apps/api/app/tests/test_marketplace_account_overview_contract.py",
    "apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx",
    "apps/web/lib/api/schemas.ts",
    "apps/web/styles/globals.css",
    "apps/web/tests/unit/integrations-workspace.test.tsx"
)

foreach ($RelativePath in $Paths) {
    $SourceFile = Join-Path $Source ($RelativePath -replace '/', '\')
    $TargetFile = Join-Path $Repository ($RelativePath -replace '/', '\')
    if (-not (Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
        throw "Source file missing: $RelativePath"
    }
    $TargetDirectory = Split-Path -Parent $TargetFile
    New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
    Copy-Item -LiteralPath $SourceFile -Destination $TargetFile -Force
}

Set-Location $Repository

git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check failed: $LASTEXITCODE" }

git status --short
Write-Host "EXACT FILE TRANSFER: PASS"
```

## 5. Backend gates

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repository = "C:\Work\respio"
$Python = "$Repository\.venv\Scripts\python.exe"
$Pytest = "$Repository\.venv\Scripts\pytest.exe"
$Ruff = "$Repository\.venv\Scripts\ruff.exe"

Set-Location "$Repository\apps\api"

& $Ruff check app alembic
if ($LASTEXITCODE -ne 0) { throw "Ruff failed: $LASTEXITCODE" }

npx.cmd --yes pyright@1.1.411 --pythonpath $Python app
if ($LASTEXITCODE -ne 0) { throw "Pyright failed: $LASTEXITCODE" }

& $Pytest -q
if ($LASTEXITCODE -ne 0) { throw "Pytest failed: $LASTEXITCODE" }

& $Python -m compileall -q app alembic
if ($LASTEXITCODE -ne 0) { throw "compileall failed: $LASTEXITCODE" }

Write-Host "BACKEND GATES: PASS"
```

## 6. Frontend gates

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Work\respio\apps\web"

npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed: $LASTEXITCODE" }

npm.cmd run test:frontend
if ($LASTEXITCODE -ne 0) { throw "frontend tests failed: $LASTEXITCODE" }

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw "frontend typecheck failed: $LASTEXITCODE" }

npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "frontend lint failed: $LASTEXITCODE" }

npm.cmd run validate:css-syntax
if ($LASTEXITCODE -ne 0) { throw "CSS validation failed: $LASTEXITCODE" }

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "frontend build failed: $LASTEXITCODE" }

Write-Host "FRONTEND GATES: PASS"
```

## 7. Full repository gates

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Work\respio"

& ".\scripts\release-gate.ps1"
if ($LASTEXITCODE -ne 0) { throw "release gate failed: $LASTEXITCODE" }

& ".\scripts\container-gate.ps1"
if ($LASTEXITCODE -ne 0) { throw "container gate failed: $LASTEXITCODE" }

Write-Host "RELEASE AND CONTAINER GATES: PASS"
```

## 8. Exact staging

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Work\respio"

$Paths = @(
    "README.md",
    "DEVELOPMENT_STATUS_0.1.104.md",
    "OPERATOR_RUNBOOK_0.1.104_RU.md",
    "DEVELOPMENT_EVIDENCE/CHANGED_PATHS.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_OBSERVABILITY_2026-07-24.md",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_TARGETED_TESTS.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_AVAILABLE_SUITE.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_TS_PARSER.txt",
    "DEVELOPMENT_EVIDENCE/YANDEX_DASHBOARD_CSS_PARSER.txt",
    "docs/integrations/yandex-market.md",
    "apps/api/app/api/marketplace_accounts.py",
    "apps/api/app/schemas/marketplace_overview.py",
    "apps/api/app/services/marketplace_account_overview_service.py",
    "apps/api/app/tests/test_marketplace_account_overview_contract.py",
    "apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx",
    "apps/web/lib/api/schemas.ts",
    "apps/web/styles/globals.css",
    "apps/web/tests/unit/integrations-workspace.test.tsx"
)

git add -- $Paths
if ($LASTEXITCODE -ne 0) { throw "git add failed: $LASTEXITCODE" }

git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "staged diff check failed: $LASTEXITCODE" }

git diff --cached --name-status
```

## 9. Commit и push feature-ветки

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Work\respio"

$Branch = (git branch --show-current).Trim()
if ($Branch -ne "work/0.1.104-yandex-foundation") {
    throw "Unexpected branch: $Branch"
}

git commit -m "feat(yandex-market): add integration health dashboard"
if ($LASTEXITCODE -ne 0) { throw "commit failed: $LASTEXITCODE" }

git push origin HEAD:refs/heads/work/0.1.104-yandex-foundation
if ($LASTEXITCODE -ne 0) { throw "push failed: $LASTEXITCODE" }

$LocalHead = (git rev-parse HEAD).Trim()
$RemoteLine = @(git ls-remote --heads origin "refs/heads/work/0.1.104-yandex-foundation")
if ($LASTEXITCODE -ne 0) { throw "remote verification failed: $LASTEXITCODE" }
if ($RemoteLine.Count -ne 1) { throw "Remote branch verification returned $($RemoteLine.Count) lines" }
$RemoteHead = (($RemoteLine[0] -split "\s+")[0]).Trim()
if ($LocalHead -ne $RemoteHead) { throw "SHA mismatch: local=$LocalHead remote=$RemoteHead" }

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($Status.Count -ne 0) { throw "Worktree is not clean:`n$($Status -join "`n")" }

Write-Host "DASHBOARD COMMIT AND PUSH: PASS"
Write-Host "SHA: $LocalHead"
```

Прямой push в `develop` и version bump до `0.1.104` на этом этапе не выполняются. Сначала требуется runtime-проверка Яндекс Маркета и закрытие согласованного release scope.
