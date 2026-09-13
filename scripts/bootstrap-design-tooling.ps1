param([switch]$SkipBrowser, [switch]$AllBrowsers)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Web = Join-Path $Root "apps\web"
function Run-Step([string]$Title,[scriptblock]$Command){ Write-Host "`n=== $Title ===" -ForegroundColor Cyan; $global:LASTEXITCODE=0; & $Command; $code=$global:LASTEXITCODE; if($code -ne 0){ throw "$Title failed with exit code $code. Bootstrap stopped." } }
$NpmCommand=Get-Command npm.cmd -ErrorAction SilentlyContinue; if($null -eq $NpmCommand){$NpmCommand=Get-Command npm -ErrorAction Stop}; $Npm=$NpmCommand.Source
$NpxCommand=Get-Command npx.cmd -ErrorAction SilentlyContinue; if($null -eq $NpxCommand){$NpxCommand=Get-Command npx -ErrorAction Stop}; $Npx=$NpxCommand.Source
Push-Location $Web
try {
  Run-Step "npm clean install" { & $Npm ci }
  Run-Step "Frontend dependency audit" { & $Npm audit --audit-level=high }
  Run-Step "Impeccable version" { & $Npx impeccable --version }
  Run-Step "Playwright version" { & $Npx playwright --version }
  Run-Step "Lighthouse CI version" { & $Npx lhci --version }
  if(-not $SkipBrowser){ if($AllBrowsers){ Run-Step "Install Playwright browsers" { & $Npx playwright install chromium firefox webkit } } else { Run-Step "Install Playwright Chromium" { & $Npx playwright install chromium } } }
} finally { Pop-Location }
Write-Host "`nDesign tooling bootstrap completed." -ForegroundColor Green
