param(
    [string]$Repository = "",
    [ValidateSet("read-only", "write-review", "write-question")]
    [string]$Mode = "read-only",
    [ValidateRange(1, 5)]
    [int]$MaxPages = 2,
    [string]$OutputPath = "",
    [string]$ClientId = "",
    [string]$ReviewId = "",
    [string]$QuestionId = "",
    [string]$QuestionSku = "",
    [string]$ReplyText = "",
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

$Python = Join-Path $Repository "apps\api\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    throw "Project Python not found: $Python"
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $Repository ".handoff\ozon-runtime-verification.json"
}

$ApiKey = $env:OZON_API_KEY
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    if ($NoPrompt) {
        throw "Ozon API key is required"
    }
    $ApiKey = Read-SecretPlainText -Prompt "Ozon API key"
}
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "Ozon API key is required"
}

if ([string]::IsNullOrWhiteSpace($ClientId)) {
    $ClientId = $env:OZON_CLIENT_ID
}
if ([string]::IsNullOrWhiteSpace($ClientId)) {
    if ($NoPrompt) {
        throw "Ozon Client ID is required"
    }
    $ClientId = Read-Host -Prompt "Ozon Client ID"
}
if ([string]::IsNullOrWhiteSpace($ClientId)) {
    throw "Ozon Client ID is required"
}

if ($Mode -eq "write-review" -and [string]::IsNullOrWhiteSpace($ReviewId)) {
    if ($NoPrompt) {
        throw "Review ID is required in write-review mode"
    }
    $ReviewId = Read-Host -Prompt "Review ID for write probe"
}

if ($Mode -eq "write-question") {
    if ([string]::IsNullOrWhiteSpace($QuestionId)) {
        if ($NoPrompt) {
            throw "Question ID is required in write-question mode"
        }
        $QuestionId = Read-Host -Prompt "Question ID for write probe"
    }
    if ([string]::IsNullOrWhiteSpace($QuestionSku)) {
        $QuestionSku = $env:OZON_QUESTION_SKU
    }
    if ([string]::IsNullOrWhiteSpace($QuestionSku)) {
        if ($NoPrompt) {
            throw "Positive question SKU is required in write-question mode"
        }
        $QuestionSku = Read-Host -Prompt "Positive Ozon question SKU"
    }
    if ($QuestionSku -notmatch "^[1-9][0-9]*$") {
        throw "Ozon question SKU must be a positive integer"
    }
}

if ($Mode -ne "read-only") {
    if ([string]::IsNullOrWhiteSpace($ReplyText)) {
        if ($NoPrompt) {
            throw "Reply text is required in write mode"
        }
        $ReplyText = Read-SecretPlainText -Prompt "Reply text for the write probe"
    }
    if ([string]::IsNullOrWhiteSpace($ReplyText)) {
        throw "Reply text is required in write mode"
    }
    if ([string]::IsNullOrWhiteSpace($Confirmation)) {
        if ($NoPrompt) {
            throw "Exact write confirmation phrase is required"
        }
        $Confirmation = Read-Host -Prompt "Type I_UNDERSTAND_OZON_WRITE"
    }
    if ($Confirmation -ne "I_UNDERSTAND_OZON_WRITE") {
        throw "Exact write confirmation phrase is required"
    }
}

$PreviousApiKey = $env:OZON_API_KEY
$PreviousClientId = $env:OZON_CLIENT_ID
$PreviousReviewId = $env:OZON_REVIEW_ID
$PreviousQuestionId = $env:OZON_QUESTION_ID
$PreviousQuestionSku = $env:OZON_QUESTION_SKU
$PreviousReplyText = $env:OZON_REPLY_TEXT
$PreviousGitSha = $env:MPREPLY_GIT_SHA
$GitSha = (& git -C $Repository rev-parse HEAD).Trim()
Assert-LastExitCode "Read Git SHA"
if ($GitSha -notmatch "^[0-9a-f]{40}$") {
    throw "Unexpected Git SHA: $GitSha"
}

try {
    $env:OZON_API_KEY = $ApiKey
    $env:OZON_CLIENT_ID = $ClientId
    $env:OZON_REVIEW_ID = $ReviewId
    $env:OZON_QUESTION_ID = $QuestionId
    $env:OZON_QUESTION_SKU = $QuestionSku
    $env:OZON_REPLY_TEXT = $ReplyText
    $env:MPREPLY_GIT_SHA = $GitSha

    $Arguments = @(
        "-m",
        "app.tools.ozon_runtime_probe",
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

    Write-Host "`n=== OZON RUNTIME PROBE ==="
    Write-Host "Mode:       $Mode"
    Write-Host "Max pages:  $MaxPages"
    Write-Host "Evidence:   $OutputPath"
    Write-Host "Credentials and reply text are not printed or passed as command-line arguments."

    Push-Location (Join-Path $Repository "apps\api")
    try {
        & $Python @Arguments
        Assert-LastExitCode "Ozon runtime probe"
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
        throw "Runtime evidence was not created: $OutputPath"
    }
    $RawEvidence = Get-Content -LiteralPath $OutputPath -Raw
    foreach ($ForbiddenValue in @($ApiKey, $ClientId, $ReviewId, $QuestionId, $QuestionSku, $ReplyText)) {
        if (-not [string]::IsNullOrWhiteSpace($ForbiddenValue) -and $RawEvidence.Contains($ForbiddenValue)) {
            throw "Runtime evidence contains a forbidden raw value"
        }
    }
    $Evidence = $RawEvidence | ConvertFrom-Json
    if ($Evidence.provider -ne "ozon") {
        throw "Unexpected marketplace in runtime evidence"
    }
    if ($Evidence.status -ne "PASS") {
        throw "Runtime probe did not pass: $($Evidence.status)"
    }

    Write-Host "`nOZON RUNTIME PROBE: $($Evidence.status)" -ForegroundColor Green
    Write-Host "Evidence: $OutputPath"
}
finally {
    $env:OZON_API_KEY = $PreviousApiKey
    $env:OZON_CLIENT_ID = $PreviousClientId
    $env:OZON_REVIEW_ID = $PreviousReviewId
    $env:OZON_QUESTION_ID = $PreviousQuestionId
    $env:OZON_QUESTION_SKU = $PreviousQuestionSku
    $env:OZON_REPLY_TEXT = $PreviousReplyText
    $env:MPREPLY_GIT_SHA = $PreviousGitSha
    $ApiKey = $null
    $ReplyText = $null
    $GitSha = $null
}
