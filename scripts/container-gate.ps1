param(
    [switch]$KeepRunning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $Root "infra\docker\docker-compose.local.yml"
$DockerCommand = Get-Command docker -ErrorAction Stop
$Docker = $DockerCommand.Source
$ComposeAttempted = $false
$HandoffDir = Join-Path $Root ".handoff"
$ResultPath = Join-Path $HandoffDir "container-gate-result.json"

New-Item -ItemType Directory -Force -Path $HandoffDir | Out-Null
Remove-Item -LiteralPath $ResultPath -Force -ErrorAction SilentlyContinue

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $NodeCommand) {
    $NodeCommand = Get-Command node -ErrorAction Stop
}
$Node = $NodeCommand.Source

function Run-NativeStep([string]$Title, [scriptblock]$Command) {
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Command
    $exitCode = $global:LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Title failed with exit code $exitCode. Container gate stopped."
    }
}

function Assert-HttpHealth([string]$Title, [string]$Uri) {
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -ne 200) {
        throw "$Title failed with HTTP $($response.StatusCode)."
    }
    Write-Host "$Uri -> HTTP 200" -ForegroundColor Green
}

try {
    Run-NativeStep "Docker daemon" {
        & $Docker info --format "{{.ServerVersion}}"
    }

    Run-NativeStep "Local Compose validation" {
        & $Docker compose -f $ComposeFile config --quiet
    }

    $ComposeAttempted = $true
    Run-NativeStep "Build and start local stack" {
        & $Docker compose -f $ComposeFile up --build --detach --wait --wait-timeout 240
    }

    Assert-HttpHealth "API readiness" "http://127.0.0.1:8000/health/ready"
    Assert-HttpHealth "Web readiness" "http://127.0.0.1:3000/api/health"

    Run-NativeStep "Container status" {
        & $Docker compose -f $ComposeFile ps
    }

    Run-NativeStep "Container evidence" {
        & $Node (Join-Path $Root "scripts\write-release-result.mjs") `
            --kind=container `
            --status=PASS `
            --source=scripts/container-gate.ps1 `
            --out=.handoff/container-gate-result.json
    }

    Write-Host "`nContainer gate passed." -ForegroundColor Green
    Write-Host "Evidence: $ResultPath" -ForegroundColor Green
}
catch {
    if ($ComposeAttempted) {
        Write-Host "`n=== Container logs after failure ===" -ForegroundColor Yellow
        & $Docker compose -f $ComposeFile logs --tail 200
    }
    throw
}
finally {
    if ($ComposeAttempted -and -not $KeepRunning) {
        Write-Host "`n=== Stopping local stack ===" -ForegroundColor Cyan
        & $Docker compose -f $ComposeFile down --remove-orphans
    }
}
