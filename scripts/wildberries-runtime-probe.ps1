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
    $OutputPath = Join-Path $Repository ".handoff\wildberries-runtime-verification.json"
}

$ApiKey = $env:WILDBERRIES_API_KEY
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    if ($NoPrompt) {
        throw "Wildberries API key is required"
    }
    $ApiKey = Read-SecretPlainText -Prompt "Wildberries API key"
}
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "Wildberries API key is required"
}

if ($Mode -eq "write-review" -and [string]::IsNullOrWhiteSpace($ReviewId)) {
    if ($NoPrompt) {
        throw "Review ID is required in write-review mode"
    }
    $ReviewId = Read-Host -Prompt "Review ID for write probe"
}

if ($Mode -eq "write-question" -and [string]::IsNullOrWhiteSpace($QuestionId)) {
    if ($NoPrompt) {
        throw "Question ID is required in write-question mode"
    }
    $QuestionId = Read-Host -Prompt "Question ID for write probe"
}

if ($Mode -ne "read-only") {
    if ([string]::IsNullOrWhiteSpace($ReplyText)) {
        if ($NoPrompt) {
            throw "Reply text is required in write mode"
        }
        $ReplyText = Read-Host -Prompt "Reply text for the write probe"
    }
    if ([string]::IsNullOrWhiteSpace($ReplyText)) {
        throw "Reply text is required in write mode"
    }
    if ([string]::IsNullOrWhiteSpace($Confirmation)) {
        if ($NoPrompt) {
            throw "Exact write confirmation phrase is required"
        }
        $Confirmation = Read-Host -Prompt "Type I_UNDERSTAND_WILDBERRIES_WRITE"
    }
    if ($Confirmation -ne "I_UNDERSTAND_WILDBERRIES_WRITE") {
        throw "Exact write confirmation phrase is required"
    }
}

$PreviousApiKey = $env:WILDBERRIES_API_KEY
$PreviousReviewId = $env:WILDBERRIES_REVIEW_ID
$PreviousQuestionId = $env:WILDBERRIES_QUESTION_ID
$PreviousReplyText = $env:WILDBERRIES_REPLY_TEXT
$PreviousGitSha = $env:MPREPLY_GIT_SHA
$GitSha = (& git -C $Repository rev-parse HEAD).Trim()
Assert-LastExitCode "Read Git SHA"
if ($GitSha -notmatch "^[0-9a-f]{40}$") {
    throw "Unexpected Git SHA: $GitSha"
}

try {
    $env:WILDBERRIES_API_KEY = $ApiKey
    $env:WILDBERRIES_REVIEW_ID = $ReviewId
    $env:WILDBERRIES_QUESTION_ID = $QuestionId
    $env:WILDBERRIES_REPLY_TEXT = $ReplyText
    $env:MPREPLY_GIT_SHA = $GitSha

    $Arguments = @(
        "-m",
        "app.tools.wildberries_runtime_probe",
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

    Write-Host "`n=== WILDBERRIES RUNTIME PROBE ==="
    Write-Host "Mode:       $Mode"
    Write-Host "Max pages:  $MaxPages"
    Write-Host "Evidence:   $OutputPath"
    Write-Host "Credentials are not printed or passed as command-line arguments."

    Push-Location (Join-Path $Repository "apps\api")
    try {
        & $Python @Arguments
        Assert-LastExitCode "Wildberries runtime probe"
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
    if (-not [string]::IsNullOrWhiteSpace($ReviewId) -and $RawEvidence.Contains($ReviewId)) {
        throw "Runtime evidence contains the unmasked Review ID"
    }
    if (-not [string]::IsNullOrWhiteSpace($QuestionId) -and $RawEvidence.Contains($QuestionId)) {
        throw "Runtime evidence contains the unmasked Question ID"
    }
    if (-not [string]::IsNullOrWhiteSpace($ReplyText) -and $RawEvidence.Contains($ReplyText)) {
        throw "Runtime evidence contains the reply text"
    }

    $Evidence = $RawEvidence | ConvertFrom-Json
    if ($Evidence.provider -ne "wildberries") {
        throw "Unexpected marketplace in runtime evidence"
    }
    if ($Evidence.status -ne "PASS") {
        throw "Runtime probe did not pass: $($Evidence.status)"
    }

    Write-Host "`nWILDBERRIES RUNTIME PROBE: $($Evidence.status)" -ForegroundColor Green
    Write-Host "Evidence: $OutputPath"
}
finally {
    $env:WILDBERRIES_API_KEY = $PreviousApiKey
    $env:WILDBERRIES_REVIEW_ID = $PreviousReviewId
    $env:WILDBERRIES_QUESTION_ID = $PreviousQuestionId
    $env:WILDBERRIES_REPLY_TEXT = $PreviousReplyText
    $env:MPREPLY_GIT_SHA = $PreviousGitSha
    $ApiKey = $null
    $ReplyText = $null
    $GitSha = $null
}
