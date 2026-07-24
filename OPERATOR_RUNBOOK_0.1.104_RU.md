# MP Reply 0.1.104 — команды установки, проверки, commit и push

Этот runbook относится к полному development snapshot `mpreply-0.1.104-development`.

Текущее состояние snapshot:

- база: `develop` / `179ae0c254df44d6e480357864f60d8fa70e603e`;
- версия контрактов внутри проекта: `0.1.103`;
- целевой релиз: `0.1.104`;
- Wildberries: существующая интеграция;
- Яндекс Маркет: development vertical slice;
- Ozon и Авито: ещё не объявлены готовыми;
- commit, push и version bump в архиве не выполнены.

## 0. Правила

- Не распаковывать ZIP поверх `C:\Work\respio`.
- Не использовать `git add .`, `git add -A`, `git reset --hard`, `git clean`, force push.
- Не пушить в `develop`, пока не пройдены release/container gates и внешний runtime Яндекс Маркета.
- Raw API keys не вставлять в команды, Git, логи или чат.
- После любой ошибки блок прекращается. Не продолжать команды вручную после `throw`.

---

## 1. Проверка скачанного ZIP

Замените путь `$Archive` на фактический путь скачанного файла.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Archive = "C:\Users\Roman\Downloads\mpreply-0.1.104-development-yandex-foundation-with-runbook.zip"
$ShaFile = "$Archive.sha256"

if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) {
    throw "Archive is missing: $Archive"
}
if (-not (Test-Path -LiteralPath $ShaFile -PathType Leaf)) {
    throw "Companion SHA file is missing: $ShaFile"
}

$ShaLine = (Get-Content -LiteralPath $ShaFile -Raw).Trim()
if ($ShaLine -notmatch '^([0-9a-fA-F]{64})\s{2,}.+$') {
    throw "Malformed SHA file: $ShaFile"
}
$ExpectedArchiveSha = $Matches[1].ToLowerInvariant()
$ActualArchiveSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $Archive).Hash.ToLowerInvariant()
if ($ActualArchiveSha -ne $ExpectedArchiveSha) {
    throw "Archive SHA mismatch: expected=$ExpectedArchiveSha actual=$ActualArchiveSha"
}

Write-Host "ARCHIVE SHA256: PASS"
```

## 2. Распаковка и проверка внутреннего manifest

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Archive = "C:\Users\Roman\Downloads\mpreply-0.1.104-development-yandex-foundation-with-runbook.zip"
$ExtractRoot = "C:\Work\mpreply-0.1.104-artifact"
$Source = Join-Path $ExtractRoot "mpreply-0.1.104-development"

if (Test-Path -LiteralPath $ExtractRoot) {
    throw "Extraction path already exists: $ExtractRoot"
}

Expand-Archive -LiteralPath $Archive -DestinationPath $ExtractRoot

$Manifest = Join-Path $Source "PROJECT_MANIFEST_SHA256.txt"
if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
    throw "Internal manifest is missing: $Manifest"
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
        throw "Manifest file is missing: $RelativePath"
    }

    $ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $File).Hash.ToLowerInvariant()
    if ($ActualHash -ne $ExpectedHash) {
        throw "Manifest hash mismatch: $RelativePath"
    }

    $Verified++
}

Write-Host "INTERNAL MANIFEST: PASS ($Verified files)"
Write-Host "SOURCE: $Source"
```

---

## 3. Проверка основного checkout

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repository = "C:\Work\respio"
$ExpectedBaseSha = "179ae0c254df44d6e480357864f60d8fa70e603e"

Set-Location $Repository

git fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch failed: $LASTEXITCODE" }

$Branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "git branch failed: $LASTEXITCODE" }
if ($Branch -ne "develop") { throw "Expected develop, actual=$Branch" }

$Head = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "git rev-parse HEAD failed: $LASTEXITCODE" }
if ($Head -ne $ExpectedBaseSha) { throw "Base SHA mismatch: expected=$ExpectedBaseSha actual=$Head" }

$Upstream = (git rev-parse --abbrev-ref --symbolic-full-name "@{upstream}").Trim()
if ($LASTEXITCODE -ne 0) { throw "upstream check failed: $LASTEXITCODE" }
if ($Upstream -ne "origin/develop") { throw "Unexpected upstream: $Upstream" }

$AheadBehind = (git rev-list --left-right --count "HEAD...@{upstream}").Trim()
if ($LASTEXITCODE -ne 0) { throw "ahead/behind check failed: $LASTEXITCODE" }
if ($AheadBehind -notmatch '^0\s+0$') { throw "Local/remote divergence: $AheadBehind" }

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "git status failed: $LASTEXITCODE" }
if ($Status.Count -ne 0) { throw "Main checkout is not clean:`n$($Status -join "`n")" }

Write-Host "MAIN CHECKOUT PREFLIGHT: PASS"
```

---

## 4. Создание отдельной development-ветки и worktree

Имя ветки использует `/`, а не недопустимый Windows-backslash `\`.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repository = "C:\Work\respio"
$Worktree = "C:\Work\respio-0.1.104-yandex"
$FeatureBranch = "work/0.1.104-yandex-foundation"
$ExpectedBaseSha = "179ae0c254df44d6e480357864f60d8fa70e603e"

Set-Location $Repository

if (Test-Path -LiteralPath $Worktree) {
    throw "Worktree path already exists: $Worktree"
}

git show-ref --verify --quiet "refs/heads/$FeatureBranch"
if ($LASTEXITCODE -eq 0) {
    throw "Local branch already exists: $FeatureBranch"
}
if ($LASTEXITCODE -ne 1) {
    throw "git show-ref failed unexpectedly: $LASTEXITCODE"
}

git worktree add -b $FeatureBranch $Worktree $ExpectedBaseSha
if ($LASTEXITCODE -ne 0) { throw "git worktree add failed: $LASTEXITCODE" }

Set-Location $Worktree

$ActualBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "worktree branch check failed: $LASTEXITCODE" }
if ($ActualBranch -ne $FeatureBranch) { throw "Unexpected worktree branch: $ActualBranch" }

$ActualSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "worktree HEAD check failed: $LASTEXITCODE" }
if ($ActualSha -ne $ExpectedBaseSha) { throw "Unexpected worktree SHA: $ActualSha" }

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "worktree status failed: $LASTEXITCODE" }
if ($Status.Count -ne 0) { throw "New worktree is not clean" }

Write-Host "WORKTREE CREATION: PASS"
Write-Host "WORKTREE: $Worktree"
Write-Host "BRANCH:   $FeatureBranch"
```

---

## 5. Перенос exact development-файлов в worktree

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Source = "C:\Work\mpreply-0.1.104-artifact\mpreply-0.1.104-development"
$Worktree = "C:\Work\respio-0.1.104-yandex"

$CopyPaths = @(
    "DEVELOPMENT_EVIDENCE/CHANGED_PATHS.txt",
    "DEVELOPMENT_EVIDENCE/TEST_RESULTS.md",
    "DEVELOPMENT_STATUS_0.1.104.md",
    "OPERATOR_RUNBOOK_0.1.104_RU.md",
    "README.md",
    "apps/api/app/adapters/base.py",
    "apps/api/app/adapters/capabilities.py",
    "apps/api/app/adapters/registry.py",
    "apps/api/app/adapters/wildberries.py",
    "apps/api/app/adapters/yandex_market.py",
    "apps/api/app/services/marketplace_account_service.py",
    "apps/api/app/services/marketplace_scheduler_service.py",
    "apps/api/app/services/reply_execution_service.py",
    "apps/api/app/services/scheduled_sync_service.py",
    "apps/api/app/services/sync_service.py",
    "apps/api/app/tests/test_marketplace_capability_dispatch.py",
    "apps/api/app/tests/test_marketplace_scheduler_contract.py",
    "apps/api/app/tests/test_marketplace_sync_pagination.py",
    "apps/api/app/tests/test_yandex_market_adapter_contract.py",
    "apps/api/app/tests/test_yandex_market_adapter_normalization.py",
    "apps/api/app/tests/test_yandex_market_service_contract.py",
    "apps/web/app/app/integrations/yandex-market/page.tsx",
    "apps/web/components/integrations/IntegrationsWorkspace.tsx",
    "apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx",
    "apps/web/tests/unit/integrations-workspace.test.tsx",
    "docs/integrations/yandex-market.md"
)

foreach ($RelativePath in $CopyPaths) {
    $SourceFile = Join-Path $Source ($RelativePath -replace '/', '\')
    $DestinationFile = Join-Path $Worktree ($RelativePath -replace '/', '\')

    if (-not (Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
        throw "Source file is missing: $RelativePath"
    }

    $DestinationDirectory = Split-Path -Parent $DestinationFile
    New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
    Copy-Item -LiteralPath $SourceFile -Destination $DestinationFile -Force
}

$DeletedPath = Join-Path $Worktree "PATCH_README.md"
if (-not (Test-Path -LiteralPath $DeletedPath -PathType Leaf)) {
    throw "Expected baseline file for deletion is missing: PATCH_README.md"
}
Remove-Item -LiteralPath $DeletedPath

Write-Host "EXACT FILE COPY: PASS"
```

---

## 6. Проверка exact scope до тестов

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
Set-Location $Worktree

$ExpectedPaths = @(
    "DEVELOPMENT_EVIDENCE/CHANGED_PATHS.txt",
    "DEVELOPMENT_EVIDENCE/TEST_RESULTS.md",
    "DEVELOPMENT_STATUS_0.1.104.md",
    "OPERATOR_RUNBOOK_0.1.104_RU.md",
    "PATCH_README.md",
    "README.md",
    "apps/api/app/adapters/base.py",
    "apps/api/app/adapters/capabilities.py",
    "apps/api/app/adapters/registry.py",
    "apps/api/app/adapters/wildberries.py",
    "apps/api/app/adapters/yandex_market.py",
    "apps/api/app/services/marketplace_account_service.py",
    "apps/api/app/services/marketplace_scheduler_service.py",
    "apps/api/app/services/reply_execution_service.py",
    "apps/api/app/services/scheduled_sync_service.py",
    "apps/api/app/services/sync_service.py",
    "apps/api/app/tests/test_marketplace_capability_dispatch.py",
    "apps/api/app/tests/test_marketplace_scheduler_contract.py",
    "apps/api/app/tests/test_marketplace_sync_pagination.py",
    "apps/api/app/tests/test_yandex_market_adapter_contract.py",
    "apps/api/app/tests/test_yandex_market_adapter_normalization.py",
    "apps/api/app/tests/test_yandex_market_service_contract.py",
    "apps/web/app/app/integrations/yandex-market/page.tsx",
    "apps/web/components/integrations/IntegrationsWorkspace.tsx",
    "apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx",
    "apps/web/tests/unit/integrations-workspace.test.tsx",
    "docs/integrations/yandex-market.md"
) | Sort-Object -Unique

$TrackedDiff = @(git diff --name-only --) | ForEach-Object { $_.Replace('\', '/') }
if ($LASTEXITCODE -ne 0) { throw "git diff --name-only failed: $LASTEXITCODE" }

$Untracked = @(git ls-files --others --exclude-standard) | ForEach-Object { $_.Replace('\', '/') }
if ($LASTEXITCODE -ne 0) { throw "git ls-files --others failed: $LASTEXITCODE" }

$ActualPaths = @($TrackedDiff + $Untracked) | Sort-Object -Unique
$ScopeDiff = @(Compare-Object -ReferenceObject $ExpectedPaths -DifferenceObject $ActualPaths)
if ($ScopeDiff.Count -ne 0) {
    throw "Scope mismatch:`n$($ScopeDiff | Format-Table | Out-String)"
}

git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check failed: $LASTEXITCODE" }

Write-Host "EXACT PRE-STAGING SCOPE: PASS ($($ActualPaths.Count) paths)"
```

---

## 7. Backend checks

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
$Python = "C:\Work\respio\.venv\Scripts\python.exe"
$Pip = "C:\Work\respio\.venv\Scripts\pip.exe"
$Pytest = "C:\Work\respio\.venv\Scripts\pytest.exe"
$Ruff = "C:\Work\respio\.venv\Scripts\ruff.exe"
$Alembic = "C:\Work\respio\.venv\Scripts\alembic.exe"

Set-Location "$Worktree\apps\api"

& $Python -m pip check
if ($LASTEXITCODE -ne 0) { throw "pip check failed: $LASTEXITCODE" }

& $Ruff check app alembic
if ($LASTEXITCODE -ne 0) { throw "Ruff failed: $LASTEXITCODE" }

npx.cmd --yes pyright@1.1.411 --pythonpath $Python app
if ($LASTEXITCODE -ne 0) { throw "Pyright failed: $LASTEXITCODE" }

& $Pytest -q `
    "app/tests/test_marketplace_capability_dispatch.py" `
    "app/tests/test_marketplace_scheduler_contract.py" `
    "app/tests/test_marketplace_sync_pagination.py" `
    "app/tests/test_yandex_market_adapter_contract.py" `
    "app/tests/test_yandex_market_adapter_normalization.py" `
    "app/tests/test_yandex_market_service_contract.py" `
    "app/tests/test_credentials_service.py" `
    "app/tests/test_reply_idempotency.py" `
    "app/tests/test_manual_reply_safety.py" `
    "app/tests/test_wildberries_adapter_normalization.py" `
    "app/tests/test_wildberries_answer_status.py"
if ($LASTEXITCODE -ne 0) { throw "Targeted backend tests failed: $LASTEXITCODE" }

& $Pytest -q
if ($LASTEXITCODE -ne 0) { throw "Full backend pytest failed: $LASTEXITCODE" }

& $Python -m compileall -q app alembic
if ($LASTEXITCODE -ne 0) { throw "compileall failed: $LASTEXITCODE" }

& $Alembic heads
if ($LASTEXITCODE -ne 0) { throw "alembic heads failed: $LASTEXITCODE" }

Write-Host "BACKEND GATES: PASS"
```

---

## 8. Frontend checks

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
Set-Location "$Worktree\apps\web"

npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed: $LASTEXITCODE" }

npm.cmd ls --all
if ($LASTEXITCODE -ne 0) { throw "npm ls --all failed: $LASTEXITCODE" }

npm.cmd audit --audit-level=high
if ($LASTEXITCODE -ne 0) { throw "npm audit failed: $LASTEXITCODE" }

npm.cmd run test:unit
if ($LASTEXITCODE -ne 0) { throw "frontend unit tests failed: $LASTEXITCODE" }

npm.cmd run test:design-tokens
if ($LASTEXITCODE -ne 0) { throw "design token tests failed: $LASTEXITCODE" }

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw "frontend typecheck failed: $LASTEXITCODE" }

npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw "frontend lint failed: $LASTEXITCODE" }

npm.cmd run design:detect
if ($LASTEXITCODE -ne 0) { throw "design scan failed: $LASTEXITCODE" }

npm.cmd run validate:css-syntax
if ($LASTEXITCODE -ne 0) { throw "CSS syntax validation failed: $LASTEXITCODE" }

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "frontend build failed: $LASTEXITCODE" }

npm.cmd run validate:w3c
if ($LASTEXITCODE -ne 0) { throw "W3C validation failed: $LASTEXITCODE" }

npm.cmd run test:e2e
if ($LASTEXITCODE -ne 0) { throw "E2E tests failed: $LASTEXITCODE" }

npm.cmd run test:a11y
if ($LASTEXITCODE -ne 0) { throw "accessibility tests failed: $LASTEXITCODE" }

Write-Host "FRONTEND GATES: PASS"
```

---

## 9. Полные project gates и Docker

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
Set-Location $Worktree

docker.exe version
if ($LASTEXITCODE -ne 0) { throw "Docker daemon is unavailable: $LASTEXITCODE" }

& ".\scripts\release-gate.ps1"
if ($LASTEXITCODE -ne 0) { throw "release-gate failed: $LASTEXITCODE" }

& ".\scripts\container-gate.ps1"
if ($LASTEXITCODE -ne 0) { throw "container-gate failed: $LASTEXITCODE" }

Write-Host "FULL PROJECT GATES: PASS"
```

Запуск локального стека после gates:

```powershell
Set-Location "C:\Work\respio-0.1.104-yandex"
docker.exe compose -f .\infra\docker\docker-compose.local.yml up --build -d --wait
if ($LASTEXITCODE -ne 0) { throw "local compose startup failed: $LASTEXITCODE" }
```

Readiness:

```powershell
Invoke-RestMethod "http://localhost:8000/health/live"
Invoke-RestMethod "http://localhost:8000/health/ready"
Invoke-RestMethod "http://localhost:3000/api/health"
```

Остановка без удаления volumes:

```powershell
docker.exe compose -f .\infra\docker\docker-compose.local.yml down
if ($LASTEXITCODE -ne 0) { throw "local compose shutdown failed: $LASTEXITCODE" }
```

---

## 10. Staging exact paths

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
Set-Location $Worktree

$ExpectedPaths = @(
    "DEVELOPMENT_EVIDENCE/CHANGED_PATHS.txt",
    "DEVELOPMENT_EVIDENCE/TEST_RESULTS.md",
    "DEVELOPMENT_STATUS_0.1.104.md",
    "OPERATOR_RUNBOOK_0.1.104_RU.md",
    "PATCH_README.md",
    "README.md",
    "apps/api/app/adapters/base.py",
    "apps/api/app/adapters/capabilities.py",
    "apps/api/app/adapters/registry.py",
    "apps/api/app/adapters/wildberries.py",
    "apps/api/app/adapters/yandex_market.py",
    "apps/api/app/services/marketplace_account_service.py",
    "apps/api/app/services/marketplace_scheduler_service.py",
    "apps/api/app/services/reply_execution_service.py",
    "apps/api/app/services/scheduled_sync_service.py",
    "apps/api/app/services/sync_service.py",
    "apps/api/app/tests/test_marketplace_capability_dispatch.py",
    "apps/api/app/tests/test_marketplace_scheduler_contract.py",
    "apps/api/app/tests/test_marketplace_sync_pagination.py",
    "apps/api/app/tests/test_yandex_market_adapter_contract.py",
    "apps/api/app/tests/test_yandex_market_adapter_normalization.py",
    "apps/api/app/tests/test_yandex_market_service_contract.py",
    "apps/web/app/app/integrations/yandex-market/page.tsx",
    "apps/web/components/integrations/IntegrationsWorkspace.tsx",
    "apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx",
    "apps/web/tests/unit/integrations-workspace.test.tsx",
    "docs/integrations/yandex-market.md"
) | Sort-Object -Unique

git add -- $ExpectedPaths
if ($LASTEXITCODE -ne 0) { throw "exact git add failed: $LASTEXITCODE" }

git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "staged diff check failed: $LASTEXITCODE" }

$StagedPaths = @(git diff --cached --name-only) | ForEach-Object { $_.Replace('\', '/') } | Sort-Object -Unique
if ($LASTEXITCODE -ne 0) { throw "staged path read failed: $LASTEXITCODE" }

$ScopeDiff = @(Compare-Object -ReferenceObject $ExpectedPaths -DifferenceObject $StagedPaths)
if ($ScopeDiff.Count -ne 0) {
    throw "Staged scope mismatch:`n$($ScopeDiff | Format-Table | Out-String)"
}

git diff --cached --stat
git diff --cached --name-status

Write-Host "STAGED SCOPE: PASS ($($StagedPaths.Count) paths)"
```

---

## 11. Commit и push development-ветки

Это рекомендуемый push сейчас. Он не объявляет релиз `0.1.104` закрытым.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
$FeatureBranch = "work/0.1.104-yandex-foundation"
Set-Location $Worktree

$CurrentBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "branch check failed: $LASTEXITCODE" }
if ($CurrentBranch -ne $FeatureBranch) { throw "Unexpected branch: $CurrentBranch" }

$Staged = @(git diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw "staged check failed: $LASTEXITCODE" }
if ($Staged.Count -eq 0) { throw "Nothing is staged" }

git commit -m "feat(yandex-market): add marketplace integration foundation"
if ($LASTEXITCODE -ne 0) { throw "git commit failed: $LASTEXITCODE" }

git push -u origin "HEAD:refs/heads/$FeatureBranch"
if ($LASTEXITCODE -ne 0) { throw "feature branch push failed: $LASTEXITCODE" }

$LocalSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "local SHA check failed: $LASTEXITCODE" }

$RemoteLine = @(git ls-remote --heads origin "refs/heads/$FeatureBranch")
if ($LASTEXITCODE -ne 0) { throw "remote SHA check failed: $LASTEXITCODE" }
if ($RemoteLine.Count -ne 1) { throw "Expected one remote feature ref, found $($RemoteLine.Count)" }

$RemoteSha = (($RemoteLine[0] -split '\s+')[0]).Trim()
if ($LocalSha -ne $RemoteSha) {
    throw "Local/remote feature SHA mismatch: local=$LocalSha remote=$RemoteSha"
}

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "final status failed: $LASTEXITCODE" }
if ($Status.Count -ne 0) { throw "Working tree is not clean after push" }

Write-Host "FEATURE PUSH: PASS"
Write-Host "BRANCH: $FeatureBranch"
Write-Host "SHA:    $LocalSha"
```

---

## 12. Внешняя проверка Яндекс Маркета до release

До push в `develop` необходимо проверить на тестовом/реальном кабинете без публикации секретов:

- создание аккаунта с `Api-Key` и положительным Business ID;
- validation и наличие scope `COMMUNICATION` или `ALL_METHODS`;
- получение минимум одной страницы отзывов;
- получение минимум одной страницы вопросов;
- pagination через `pageToken`;
- ручная синхронизация;
- scheduled sync;
- ответ на тестовый отзыв;
- ответ на тестовый вопрос;
- безопасное отображение 401/403/420/429/5xx;
- rotate/revoke credentials;
- отсутствие raw Api-Key в логах, API response, audit и UI.

Если runtime account отсутствует, development-ветку можно хранить в Git, но нельзя объявлять интеграцию production-ready.

---

## 13. Version bump до `0.1.104`

Выполнять только после внешнего runtime proof.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
Set-Location $Worktree

Set-Location ".\apps\web"
npm.cmd version 0.1.104 --no-git-tag-version
if ($LASTEXITCODE -ne 0) { throw "npm version failed: $LASTEXITCODE" }

Set-Location $Worktree

$Replacements = @(
    @{ Path = ".\apps\api\pyproject.toml"; Old = 'version = "0.1.103"'; New = 'version = "0.1.104"' },
    @{ Path = ".\apps\api\app\core\config.py"; Old = 'app_version: str = "0.1.103"'; New = 'app_version: str = "0.1.104"' },
    @{ Path = ".\.env.example"; Old = 'APP_VERSION=0.1.103'; New = 'APP_VERSION=0.1.104' },
    @{ Path = ".\infra\coolify\.env.production.example"; Old = 'APP_VERSION=0.1.103'; New = 'APP_VERSION=0.1.104' },
    @{ Path = ".\infra\docker\docker-compose.local.yml"; Old = 'APP_VERSION: 0.1.103'; New = 'APP_VERSION: 0.1.104' },
    @{ Path = ".\infra\docker\docker-compose.production.yml"; Old = 'APP_VERSION: 0.1.103'; New = 'APP_VERSION: 0.1.104' },
    @{ Path = ".\apps\web\app\api\health\route.ts"; Old = 'version: "0.1.103"'; New = 'version: "0.1.104"' },
    @{ Path = ".\scripts\check_integrity.py"; Old = 'EXPECTED_VERSION = "0.1.103"'; New = 'EXPECTED_VERSION = "0.1.104"' }
)

foreach ($Item in $Replacements) {
    $Content = Get-Content -LiteralPath $Item.Path -Raw
    $Occurrences = ([regex]::Matches($Content, [regex]::Escape($Item.Old))).Count
    if ($Occurrences -ne 1) {
        throw "Expected exactly one version anchor in $($Item.Path), found $Occurrences"
    }
    $Updated = $Content.Replace($Item.Old, $Item.New)
    Set-Content -LiteralPath $Item.Path -Value $Updated -NoNewline -Encoding utf8
}

& "C:\Work\respio\.venv\Scripts\python.exe" ".\scripts\check_integrity.py"
if ($LASTEXITCODE -ne 0) { throw "integrity check after version bump failed: $LASTEXITCODE" }

Write-Host "VERSION BUMP: PASS"
```

После bump повторить разделы 7–9 полностью.

Version scope:

```text
.env.example
apps/api/app/core/config.py
apps/api/pyproject.toml
apps/web/app/api/health/route.ts
apps/web/package.json
apps/web/package-lock.json
infra/coolify/.env.production.example
infra/docker/docker-compose.local.yml
infra/docker/docker-compose.production.yml
scripts/check_integrity.py
```

---

## 14. Release commit

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
Set-Location $Worktree

$VersionPaths = @(
    ".env.example",
    "apps/api/app/core/config.py",
    "apps/api/pyproject.toml",
    "apps/web/app/api/health/route.ts",
    "apps/web/package.json",
    "apps/web/package-lock.json",
    "infra/coolify/.env.production.example",
    "infra/docker/docker-compose.local.yml",
    "infra/docker/docker-compose.production.yml",
    "scripts/check_integrity.py"
)

git add -- $VersionPaths
if ($LASTEXITCODE -ne 0) { throw "version staging failed: $LASTEXITCODE" }

git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "version staged diff failed: $LASTEXITCODE" }

git commit -m "chore(release): bump MP Reply to 0.1.104"
if ($LASTEXITCODE -ne 0) { throw "release commit failed: $LASTEXITCODE" }

git push origin "HEAD:refs/heads/work/0.1.104-yandex-foundation"
if ($LASTEXITCODE -ne 0) { throw "updated feature push failed: $LASTEXITCODE" }
```

---

## 15. Push release в `develop`

Выполнять только после:

- external Yandex runtime proof;
- exact Ruff/Pyright/full pytest;
- frontend unit/typecheck/lint/build/E2E/a11y;
- `release-gate.ps1` PASS;
- `container-gate.ps1` PASS;
- version `0.1.104` во всех контрактах;
- clean tree.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Worktree = "C:\Work\respio-0.1.104-yandex"
$ExpectedOldDevelopSha = "179ae0c254df44d6e480357864f60d8fa70e603e"
Set-Location $Worktree

git fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch failed: $LASTEXITCODE" }

$RemoteDevelopLine = @(git ls-remote --heads origin refs/heads/develop)
if ($LASTEXITCODE -ne 0) { throw "remote develop lookup failed: $LASTEXITCODE" }
if ($RemoteDevelopLine.Count -ne 1) { throw "Expected one remote develop ref" }

$RemoteDevelopSha = (($RemoteDevelopLine[0] -split '\s+')[0]).Trim()
if ($RemoteDevelopSha -ne $ExpectedOldDevelopSha) {
    throw "origin/develop moved: expected=$ExpectedOldDevelopSha actual=$RemoteDevelopSha"
}

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "status failed: $LASTEXITCODE" }
if ($Status.Count -ne 0) { throw "Worktree is not clean" }

git push origin HEAD:develop
if ($LASTEXITCODE -ne 0) { throw "develop push failed: $LASTEXITCODE" }

$LocalSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw "local SHA failed: $LASTEXITCODE" }

$RemoteDevelopLine = @(git ls-remote --heads origin refs/heads/develop)
if ($LASTEXITCODE -ne 0) { throw "post-push remote lookup failed: $LASTEXITCODE" }
$RemoteSha = (($RemoteDevelopLine[0] -split '\s+')[0]).Trim()

if ($LocalSha -ne $RemoteSha) {
    throw "Local/remote develop SHA mismatch: local=$LocalSha remote=$RemoteSha"
}

Write-Host "DEVELOP PUSH: PASS"
Write-Host "SHA: $LocalSha"
```

Обновление основного checkout после успешного push:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Work\respio"

$Status = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "main status failed: $LASTEXITCODE" }
if ($Status.Count -ne 0) { throw "Main checkout is not clean" }

git pull --ff-only origin develop
if ($LASTEXITCODE -ne 0) { throw "main fast-forward failed: $LASTEXITCODE" }

git status --porcelain=v1 --untracked-files=all
if ($LASTEXITCODE -ne 0) { throw "final main status failed: $LASTEXITCODE" }
```

---

## 16. Новый handoff после release

Только после clean tree и совпадения local/remote SHA:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Work\respio"

node.exe ".\create-mpreply-next-chat-context-v4.mjs"
if ($LASTEXITCODE -ne 0) { throw "handoff export failed: $LASTEXITCODE" }
```

Архиватор должен сам проверить release evidence, clean tree, local/remote SHA, tracked files, integrity и секреты.

---

## 17. Что делать сейчас

Рекомендуемый порядок:

1. Проверить ZIP и internal manifest.
2. Создать worktree `work/0.1.104-yandex-foundation`.
3. Скопировать exact 27-path scope.
4. Запустить backend/frontend/full Docker gates.
5. Commit и push development-ветки.
6. Проверить Яндекс Маркет на реальном кабинете.
7. Закрыть найденные runtime gaps.
8. Bump `0.1.104`, повторить все gates.
9. Push `develop`.
10. Создать verified handoff.

После этого следующий проектный этап — Ozon adapter, затем расширение личного кабинета и отдельная Avito chat/conversation architecture.
