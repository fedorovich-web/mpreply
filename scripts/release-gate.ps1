Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root "apps\api"
$Web = Join-Path $Root "apps\web"
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
$VenvRuff = Join-Path $Root ".venv\Scripts\ruff.exe"
$VenvPytest = Join-Path $Root ".venv\Scripts\pytest.exe"
$VenvAlembic = Join-Path $Root ".venv\Scripts\alembic.exe"
$HandoffDir = Join-Path $Root ".handoff"
$ResultPath = Join-Path $HandoffDir "project-quality-result.json"

New-Item -ItemType Directory -Force -Path $HandoffDir | Out-Null
Remove-Item -LiteralPath $ResultPath -Force -ErrorAction SilentlyContinue

function Assert-File([string]$Path, [string]$Label) {
    if (-not (Test-Path $Path)) {
        throw "$Label not found: $Path"
    }
}

function Run-Step([string]$Title, [scriptblock]$Command) {
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan

    $global:LASTEXITCODE = 0
    & $Command
    $exitCode = $global:LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "$Title failed with exit code $exitCode. Release gate stopped."
    }
}

Assert-File $VenvPython "Python virtual environment"
Assert-File $VenvRuff "Ruff executable"
Assert-File $VenvPytest "Pytest executable"
Assert-File $VenvAlembic "Alembic executable"

$NpxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
if ($null -eq $NpxCommand) {
    $NpxCommand = Get-Command npx -ErrorAction Stop
}
$Npx = $NpxCommand.Source

$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($null -eq $NpmCommand) {
    $NpmCommand = Get-Command npm -ErrorAction Stop
}
$Npm = $NpmCommand.Source

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $NodeCommand) {
    $NodeCommand = Get-Command node -ErrorAction Stop
}
$Node = $NodeCommand.Source

Run-Step "Repository integrity" {
    & $VenvPython (Join-Path $Root "scripts\check_integrity.py")
}

Run-Step "Repository tooling tests" {
    & $VenvPython -m unittest discover -s (Join-Path $Root "scripts\tests") -p "test_*.py"
}

Push-Location $Api
try {
    Run-Step "Backend environment smoke test" {
        & $VenvPython -c "import fastapi, pydantic, sqlalchemy, httpx, dramatiq, redis, pytest; print('Backend imports OK')"
    }
    Run-Step "Backend dependency consistency" {
        & $VenvPython -m pip check
    }
    Run-Step "Backend Ruff" {
        & $VenvRuff check app alembic
    }
    Run-Step "Backend Pyright" {
        & $Npx --yes pyright@1.1.411 --pythonpath $VenvPython app
    }
    Run-Step "Backend tests" {
        & $VenvPytest -q
    }
    Run-Step "Backend compileall" {
        & $VenvPython -m compileall -q app alembic
    }
    Run-Step "Alembic heads" {
        & $VenvAlembic heads
    }
}
finally {
    Pop-Location
}

Push-Location $Web
try {
    Run-Step "Frontend clean install" {
        & $Npm ci
    }
    Run-Step "Frontend dependency tree" {
        & $Npm ls --all
    }
    Run-Step "Frontend security audit" {
        & $Npm audit --audit-level=high
    }
    Run-Step "Frontend unit tests" {
        & $Npm run test:unit
    }
    Run-Step "Design token tests" {
        & $Npm run test:design-tokens
    }
    Run-Step "Frontend typecheck" {
        & $Npm run typecheck
    }
    Run-Step "Frontend lint" {
        & $Npm run lint
    }
    Run-Step "Frontend design anti-pattern scan" {
        & $Npm run design:detect
    }
    Run-Step "Frontend CSS syntax validation" {
        & $Npm run validate:css-syntax
    }
    Run-Step "Frontend production build" {
        & $Npm run build
    }
    Run-Step "Frontend W3C HTML and CSS validation" {
        & $Npm run validate:w3c
    }
    Run-Step "Frontend critical E2E" {
        & $Npm run test:e2e
    }
    Run-Step "Frontend accessibility" {
        & $Npm run test:a11y
    }
}
finally {
    Pop-Location
}

Run-Step "Release evidence" {
    & $Node (Join-Path $Root "scripts\write-release-result.mjs") `
        --kind=project-quality `
        --status=PASS `
        --source=scripts/release-gate.ps1 `
        --out=.handoff/project-quality-result.json
}

Write-Host "`nAll release-gate checks passed." -ForegroundColor Green
Write-Host "Evidence: $ResultPath" -ForegroundColor Green
Write-Host "Run .\scripts\container-gate.ps1 separately when Docker Desktop is available." -ForegroundColor DarkGray
