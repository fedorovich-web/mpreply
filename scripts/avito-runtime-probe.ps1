param(
    [string]$Repository = "",
    [ValidateSet("read-only", "write-chat-message", "write-mark-read")]
    [string]$Mode = "read-only",
    [ValidateRange(1, 5)]
    [int]$MaxPages = 2,
    [string]$OutputPath = "",
    [string]$UserId = "",
    [string]$ChatId = "",
    [string]$InboundCreatedUnix = "",
    [string]$MessageText = "",
    [string]$Confirmation = "",
    [switch]$NoPrompt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
    param([Parameter(Mandatory = $true)][string]$Title)

    if ($LASTEXITCODE -ne 0) {
        throw "$Title failed with exit code $LASTEXITCODE"
    }
}

function Read-SecretPlainText {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    $SecureValue = Read-Host -Prompt $Prompt -AsSecureString
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
    }
}

if ([string]::IsNullOrWhiteSpace($Repository)) {
    $ScriptDirectory = Split-Path -Parent $PSCommandPath
    $Repository = Split-Path -Parent $ScriptDirectory
}
if (-not (Test-Path -LiteralPath $Repository -PathType Container)) {
    throw "Repository not found: $Repository"
}

$GitRoot = (& git -C $Repository rev-parse --show-toplevel).Trim()
Assert-LastExitCode "Read Git root"
$ExpectedRoot = [System.IO.Path]::GetFullPath($Repository).TrimEnd("\")
$ActualRoot = [System.IO.Path]::GetFullPath($GitRoot).TrimEnd("\")
if ($ActualRoot -ne $ExpectedRoot) {
    throw "Unexpected Git root: expected=$ExpectedRoot actual=$ActualRoot"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $Repository ".handoff\avito-runtime-verification.json"
}

$AccessToken = $env:AVITO_ACCESS_TOKEN
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    if ($NoPrompt) {
        throw "Avito access token is required"
    }
    $AccessToken = Read-SecretPlainText -Prompt "Avito access token"
}
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    throw "Avito access token is required"
}

if ([string]::IsNullOrWhiteSpace($UserId)) {
    $UserId = $env:AVITO_USER_ID
}
if ([string]::IsNullOrWhiteSpace($UserId)) {
    if ($NoPrompt) {
        throw "Avito user ID is required"
    }
    $UserId = Read-Host -Prompt "Avito user ID"
}
if ($UserId -notmatch "^[1-9][0-9]*$") {
    throw "Avito user ID must be a positive decimal integer"
}

if ($Mode -ne "read-only" -and [string]::IsNullOrWhiteSpace($ChatId)) {
    if ($NoPrompt) {
        throw "Avito chat ID is required in write mode"
    }
    $ChatId = Read-Host -Prompt "Avito chat ID for write probe"
}

if ($Mode -eq "write-chat-message") {
    if ([string]::IsNullOrWhiteSpace($InboundCreatedUnix)) {
        $InboundCreatedUnix = $env:AVITO_INBOUND_CREATED_UNIX
    }
    if ([string]::IsNullOrWhiteSpace($InboundCreatedUnix)) {
        if ($NoPrompt) {
            throw "Inbound created Unix timestamp is required in write-chat-message mode"
        }
        $InboundCreatedUnix = Read-Host -Prompt "Inbound created Unix timestamp"
    }
    if ($InboundCreatedUnix -notmatch "^[0-9]+$") {
        throw "Inbound created Unix timestamp must be a non-negative integer"
    }
    if ([string]::IsNullOrWhiteSpace($MessageText)) {
        if ($NoPrompt) {
            throw "Message text is required in write-chat-message mode"
        }
        $MessageText = Read-SecretPlainText -Prompt "Message text for the write probe"
    }
    if ([string]::IsNullOrWhiteSpace($Confirmation)) {
        if ($NoPrompt) {
            throw "Exact chat-write confirmation phrase is required"
        }
        $Confirmation = Read-Host -Prompt "Type I_UNDERSTAND_AVITO_CHAT_WRITE"
    }
    if ($Confirmation -ne "I_UNDERSTAND_AVITO_CHAT_WRITE") {
        throw "Exact chat-write confirmation phrase is required"
    }
}

if ($Mode -eq "write-mark-read") {
    if ([string]::IsNullOrWhiteSpace($Confirmation)) {
        if ($NoPrompt) {
            throw "Exact mark-read confirmation phrase is required"
        }
        $Confirmation = Read-Host -Prompt "Type I_UNDERSTAND_AVITO_MARK_READ"
    }
    if ($Confirmation -ne "I_UNDERSTAND_AVITO_MARK_READ") {
        throw "Exact mark-read confirmation phrase is required"
    }
}

$PreviousAccessToken = $env:AVITO_ACCESS_TOKEN
$PreviousUserId = $env:AVITO_USER_ID
$PreviousChatId = $env:AVITO_CHAT_ID
$PreviousInboundCreatedUnix = $env:AVITO_INBOUND_CREATED_UNIX
$PreviousMessageText = $env:AVITO_MESSAGE_TEXT
$PreviousGitSha = $env:MPREPLY_GIT_SHA
$GitSha = (& git -C $Repository rev-parse HEAD).Trim()
Assert-LastExitCode "Read Git SHA"
if ($GitSha -notmatch "^[0-9a-f]{40}$") {
    throw "Unexpected Git SHA: $GitSha"
}

try {
    $env:AVITO_ACCESS_TOKEN = $AccessToken
    $env:AVITO_USER_ID = $UserId
    $env:AVITO_CHAT_ID = $ChatId
    $env:AVITO_INBOUND_CREATED_UNIX = $InboundCreatedUnix
    $env:AVITO_MESSAGE_TEXT = $MessageText
    $env:MPREPLY_GIT_SHA = $GitSha

    $Arguments = @(
        "-m",
        "app.tools.avito_runtime_probe",
        "--mode",
        $Mode,
        "--max-pages",
        $MaxPages.ToString(),
        "--output",
        $OutputPath
    )
    if ($Mode -ne "read-only") {
        $Arguments += @("--confirmation", $Confirmation)
    }

    $Python = Join-Path $Repository "apps\api\.venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
        throw "Project Python not found: $Python"
    }

    Write-Host "`n=== AVITO RUNTIME PROBE ==="
    Write-Host "Mode:       $Mode"
    Write-Host "Max pages:  $MaxPages"
    Write-Host "Evidence:   $OutputPath"
    Write-Host "Credentials and message text are not printed or passed as command-line arguments."

    Push-Location (Join-Path $Repository "apps\api")
    try {
        & $Python @Arguments
        Assert-LastExitCode "Avito runtime probe"
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
        throw "Runtime evidence was not created: $OutputPath"
    }
    $RawEvidence = Get-Content -LiteralPath $OutputPath -Raw
    foreach ($ForbiddenValue in @($AccessToken, $UserId, $ChatId, $InboundCreatedUnix, $MessageText)) {
        if (-not [string]::IsNullOrWhiteSpace($ForbiddenValue) -and $RawEvidence.Contains($ForbiddenValue)) {
            throw "Runtime evidence contains a forbidden raw value"
        }
    }
    $Evidence = $RawEvidence | ConvertFrom-Json
    if ($Evidence.provider -ne "avito") {
        throw "Unexpected marketplace in runtime evidence"
    }
    if ($Evidence.status -ne "PASS") {
        throw "Runtime probe did not pass: $($Evidence.status)"
    }

    Write-Host "`nAVITO RUNTIME PROBE: $($Evidence.status)" -ForegroundColor Green
    Write-Host "Evidence: $OutputPath"
}
finally {
    $env:AVITO_ACCESS_TOKEN = $PreviousAccessToken
    $env:AVITO_USER_ID = $PreviousUserId
    $env:AVITO_CHAT_ID = $PreviousChatId
    $env:AVITO_INBOUND_CREATED_UNIX = $PreviousInboundCreatedUnix
    $env:AVITO_MESSAGE_TEXT = $PreviousMessageText
    $env:MPREPLY_GIT_SHA = $PreviousGitSha
    $AccessToken = $null
    $MessageText = $null
    $GitSha = $null
}
