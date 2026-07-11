param([switch]$SkipInstall,[switch]$SkipBrowserInstall,[switch]$IncludeVisual,[switch]$AllBrowsers)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root=Split-Path -Parent $PSScriptRoot
$Web=Join-Path $Root "apps\web"
function Run-Step([string]$Title,[scriptblock]$Command){ Write-Host "`n=== $Title ===" -ForegroundColor Cyan; $global:LASTEXITCODE=0; & $Command; $code=$global:LASTEXITCODE; if($code -ne 0){ throw "$Title failed with exit code $code. Web design gate stopped." } }
$NpmCommand=Get-Command npm.cmd -ErrorAction SilentlyContinue; if($null -eq $NpmCommand){$NpmCommand=Get-Command npm -ErrorAction Stop}; $Npm=$NpmCommand.Source
$NpxCommand=Get-Command npx.cmd -ErrorAction SilentlyContinue; if($null -eq $NpxCommand){$NpxCommand=Get-Command npx -ErrorAction Stop}; $Npx=$NpxCommand.Source
Push-Location $Web
try {
  if(-not $SkipInstall){ Run-Step "Frontend clean install" { & $Npm ci } }
  Run-Step "Frontend security audit" { & $Npm audit --audit-level=high }
  Run-Step "Impeccable anti-pattern scan" { & $Npm run design:detect }
  Run-Step "Frontend typecheck" { & $Npm run typecheck }
  Run-Step "Frontend lint" { & $Npm run lint }
  Run-Step "Frontend production build" { & $Npm run build }
  if(-not $SkipBrowserInstall){ if($AllBrowsers){ Run-Step "Install Playwright browsers" { & $Npx playwright install chromium firefox webkit } } else { Run-Step "Install Playwright Chromium" { & $Npx playwright install chromium } } }
  Run-Step "Playwright public-site E2E" { & $Npm run test:e2e }
  Run-Step "Playwright accessibility scan" { & $Npm run test:a11y }
  Run-Step "Lighthouse CI" { & $Npm run lighthouse }
  if($IncludeVisual){ Run-Step "Playwright visual regression" { & $Npm run test:visual } }
} finally { Pop-Location }
Write-Host "`nAll web-design-gate checks passed." -ForegroundColor Green
