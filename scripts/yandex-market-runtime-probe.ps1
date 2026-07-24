param(
    [string]$Repository = "",
    [ValidateSet("read-only", "write-review", "write-question")]
    [string]$Mode = "read-only",
    [ValidateRange(1, 5)]
    [int]$MaxPages = 2,
    [string]$OutputPath = "",
    [string]$ReviewId = "",
    [string]$QuestionId = "",
    [string]$ReplyText = "",
    [string]$Confirmation = ""
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

$Python = Join-Path $Repository ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    throw "Project Python not found: $Python"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $Repository ".handoff\yandex-market-runtime-verification.json"
}

$ApiKey = $env:YANDEX_MARKET_API_KEY
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = Read-SecretPlainText -Prompt "Yandex Market Api-Key"
}
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "Yandex Market Api-Key is required"
}

$BusinessId = $env:YANDEX_MARKET_BUSINESS_ID
if ([string]::IsNullOrWhiteSpace($BusinessId)) {
    $BusinessId = Read-Host -Prompt "Yandex Market Business ID"
}
if ($BusinessId -notmatch "^[1-9][0-9]*$") {
    throw "Yandex Market Business ID must be a positive integer"
}

if ($Mode -eq "write-review") {
    if ([string]::IsNullOrWhiteSpace($ReviewId)) {
        $ReviewId = Read-Host -Prompt "Review ID for write probe"
    }
    if ($ReviewId -notmatch "^[1-9][0-9]*$") {
        throw "Review ID must be a positive integer"
    }
}

if ($Mode -eq "write-question") {
    if ([string]::IsNullOrWhiteSpace($QuestionId)) {
        $QuestionId = Read-Host -Prompt "Question ID for write probe"
    }
    if ($QuestionId -notmatch "^[1-9][0-9]*$") {
        throw "Question ID must be a positive integer"
    }
}

if ($Mode -ne "read-only") {
    if ([string]::IsNullOrWhiteSpace($ReplyText)) {
        $ReplyText = Read-Host -Prompt "Reply text for the write probe"
    }
    if ([string]::IsNullOrWhiteSpace($ReplyText)) {
        throw "Reply text is required in write mode"
    }
    if ([string]::IsNullOrWhiteSpace($Confirmation)) {
        $Confirmation = Read-Host -Prompt "Type I_UNDERSTAND_YANDEX_MARKET_WRITE"
    }
    if ($Confirmation -ne "I_UNDERSTAND_YANDEX_MARKET_WRITE") {
        throw "Exact write confirmation phrase is required"
    }
}

$PreviousApiKey = $env:YANDEX_MARKET_API_KEY
$PreviousBusinessId = $env:YANDEX_MARKET_BUSINESS_ID
$PreviousReviewId = $env:YANDEX_MARKET_REVIEW_ID
$PreviousQuestionId = $env:YANDEX_MARKET_QUESTION_ID
$PreviousReplyText = $env:YANDEX_MARKET_REPLY_TEXT

try {
    $env:YANDEX_MARKET_API_KEY = $ApiKey
    $env:YANDEX_MARKET_BUSINESS_ID = $BusinessId
    $env:YANDEX_MARKET_REVIEW_ID = $ReviewId
    $env:YANDEX_MARKET_QUESTION_ID = $QuestionId
    $env:YANDEX_MARKET_REPLY_TEXT = $ReplyText

    $Arguments = @(
        "-m",
        "app.tools.yandex_market_runtime_probe",
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

    Write-Host "`n=== YANDEX MARKET RUNTIME PROBE ==="
    Write-Host "Mode:       $Mode"
    Write-Host "Max pages:  $MaxPages"
    Write-Host "Evidence:   $OutputPath"
    Write-Host "Credentials are not printed or passed as command-line arguments."

    Push-Location (Join-Path $Repository "apps\api")
    try {
        & $Python @Arguments
        Assert-LastExitCode "Yandex Market runtime probe"
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
        throw "Runtime evidence was not created: $OutputPath"
    }

    $RawEvidence = Get-Content -LiteralPath $OutputPath -Raw
    if ($RawEvidence.Contains($ApiKey)) {
        throw "Runtime evidence contains the raw API key"
    }
    if ($RawEvidence.Contains($BusinessId)) {
        throw "Runtime evidence contains the unmasked Business ID"
    }

    $Evidence = $RawEvidence | ConvertFrom-Json
    if ($Evidence.marketplace -ne "yandex_market") {
        throw "Unexpected marketplace in runtime evidence"
    }
    if ($Evidence.overall_status -notin @("pass", "pending", "skipped")) {
        throw "Runtime probe did not pass: $($Evidence.overall_status)"
    }

    Write-Host "`nYANDEX MARKET RUNTIME PROBE: $($Evidence.overall_status.ToString().ToUpperInvariant())" -ForegroundColor Green
    Write-Host "Evidence: $OutputPath"
}
finally {
    $env:YANDEX_MARKET_API_KEY = $PreviousApiKey
    $env:YANDEX_MARKET_BUSINESS_ID = $PreviousBusinessId
    $env:YANDEX_MARKET_REVIEW_ID = $PreviousReviewId
    $env:YANDEX_MARKET_QUESTION_ID = $PreviousQuestionId
    $env:YANDEX_MARKET_REPLY_TEXT = $PreviousReplyText
    $ApiKey = $null
    $ReplyText = $null
}
