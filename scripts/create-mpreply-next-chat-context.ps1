<#
MPREPLY next-chat context archiver v2
Purpose:
  Build a compact ZIP for the next ChatGPT branch without touching Git index.
  This script NEVER runs git add/commit/checkout/renormalize.

Run from repository root:
  powershell -ExecutionPolicy Bypass -File .\scripts\create-mpreply-next-chat-context.ps1

Output:
  .handoff\mpreply-next-chat-context-YYYYMMDD-HHMMSS.zip
  .handoff\mpreply-next-chat-context-YYYYMMDD-HHMMSS.zip.sha256
#>

$ErrorActionPreference = "Stop"

function Find-RepoRoot {
  param([string]$Start)
  $current = Resolve-Path $Start
  while ($true) {
    if (Test-Path (Join-Path $current ".git")) { return $current.Path }
    if (Test-Path (Join-Path $current "apps\web\package.json")) { return $current.Path }
    $parent = Split-Path $current -Parent
    if ($parent -eq $current) { throw "Cannot find repository root. Run this from the repo or a child directory." }
    $current = $parent
  }
}

$Root = Find-RepoRoot -Start (Get-Location)
$Web = Join-Path $Root "apps\web"
if (!(Test-Path $Web)) { throw "Missing apps\web directory. Root detected as: $Root" }

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutDir = Join-Path $Root ".handoff"
$Stage = Join-Path $OutDir "_stage-$Stamp"
$Meta = Join-Path $Stage "_meta"
$Zip = Join-Path $OutDir "mpreply-next-chat-context-$Stamp.zip"
$ShaFile = "$Zip.sha256"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
New-Item -ItemType Directory -Force -Path $Meta | Out-Null

$ExcludeDirNames = @(
  ".git", ".next", ".turbo", "node_modules", "dist", "build", "out", "coverage",
  ".vercel", ".cache", "playwright-report", "test-results", ".handoff"
)

$IncludeFiles = @(
  "README.md",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "MPREPLY_SENIOR_HANDOFF_NEXT_CHAT_0.1.46_RU.md",

  "apps/web/package.json",
  "apps/web/package-lock.json",
  "apps/web/next.config.js",
  "apps/web/next.config.mjs",
  "apps/web/next.config.ts",
  "apps/web/tsconfig.json",
  "apps/web/eslint.config.mjs",
  "apps/web/postcss.config.mjs",
  "apps/web/vitest.config.ts",
  "apps/web/playwright.config.ts",

  "apps/web/app/page.tsx",
  "apps/web/app/layout.tsx",
  "apps/web/app/globals.css",

  "apps/web/e2e/public-site.spec.ts",
  "apps/web/tests/unit/hero-orbital-scene.test.ts",
  "apps/web/tests/unit/public-visual-recovery-contract.test.ts",
  "apps/web/tests/design/design-tokens.test.ts",

  "apps/web/scripts/validate-w3c-css.mjs",
  "apps/web/scripts/validate-w3c-html.mjs"
)

$IncludeDirs = @(
  "apps/web/components/public-site",
  "apps/web/styles",
  "apps/web/lib",
  "apps/web/public/brand",
  "apps/web/public/icons/hero",
  "apps/web/tests/unit",
  "apps/web/tests/design",
  "apps/web/e2e",
  "apps/web/scripts"
)

function Should-ExcludePath {
  param([string]$FullPath)
  $relative = Resolve-Path $FullPath -ErrorAction SilentlyContinue
  if ($null -eq $relative) { return $true }
  $parts = $relative.Path.Substring($Root.Length).TrimStart("\","/") -split "[\\/]+"
  foreach ($part in $parts) {
    if ($ExcludeDirNames -contains $part) { return $true }
  }
  return $false
}

function Copy-RelativeFile {
  param([string]$Rel)
  $src = Join-Path $Root $Rel
  if (!(Test-Path $src -PathType Leaf)) { return $false }
  if (Should-ExcludePath -FullPath $src) { return $false }

  $dst = Join-Path $Stage $Rel
  $dstDir = Split-Path $dst -Parent
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Force
  return $true
}

$Copied = New-Object System.Collections.Generic.HashSet[string]

foreach ($rel in $IncludeFiles) {
  if (Copy-RelativeFile -Rel $rel) { [void]$Copied.Add($rel.Replace("\","/")) }
}

foreach ($dirRel in $IncludeDirs) {
  $dir = Join-Path $Root $dirRel
  if (!(Test-Path $dir -PathType Container)) { continue }
  Get-ChildItem -LiteralPath $dir -Recurse -File | ForEach-Object {
    if (Should-ExcludePath -FullPath $_.FullName) { return }
    $rel = $_.FullName.Substring($Root.Length).TrimStart("\","/").Replace("\","/")
    if (Copy-RelativeFile -Rel $rel) { [void]$Copied.Add($rel) }
  }
}

# Git metadata: read-only commands only. No git add, no write operations.
Push-Location $Root
try {
  git status --short | Out-File -Encoding utf8 (Join-Path $Meta "git-status-short.txt")
  git status --porcelain=v1 | Out-File -Encoding utf8 (Join-Path $Meta "git-status-porcelain.txt")
  git diff -- apps/web/app/page.tsx apps/web/components/public-site apps/web/styles apps/web/package.json apps/web/package-lock.json | Out-File -Encoding utf8 (Join-Path $Meta "git-diff-hero.patch")
  git log --oneline -n 20 | Out-File -Encoding utf8 (Join-Path $Meta "git-log-last-20.txt")
  git ls-files apps/web/app/page.tsx apps/web/components/public-site apps/web/styles apps/web/tests apps/web/e2e apps/web/public/brand apps/web/public/icons apps/web/package.json apps/web/package-lock.json | Out-File -Encoding utf8 (Join-Path $Meta "git-ls-files-relevant.txt")
} catch {
  "Git metadata collection failed: $($_.Exception.Message)" | Out-File -Encoding utf8 (Join-Path $Meta "git-error.txt")
} finally {
  Pop-Location
}

# NPM metadata.
try {
  Push-Location $Web
  npm pkg get scripts version dependencies devDependencies | Out-File -Encoding utf8 (Join-Path $Meta "npm-pkg-summary.json")
} catch {
  "npm metadata collection failed: $($_.Exception.Message)" | Out-File -Encoding utf8 (Join-Path $Meta "npm-error.txt")
} finally {
  Pop-Location
}

# Required file gate.
$Required = @(
  "apps/web/app/page.tsx",
  "apps/web/package.json",
  "apps/web/package-lock.json",
  "apps/web/components/public-site/HeroProductFlowCanvas.tsx",
  "apps/web/components/public-site/HeroProductFlowCanvas.module.css",
  "apps/web/styles/tokens.css",
  "apps/web/styles/public-site.css"
)

$MissingRequired = @()
foreach ($rel in $Required) {
  if (!(Test-Path (Join-Path $Stage $rel))) { $MissingRequired += $rel }
}

if ($MissingRequired.Count -gt 0) {
  $MissingRequired | Out-File -Encoding utf8 (Join-Path $Meta "MISSING_REQUIRED.txt")
  throw "Archive is incomplete. Missing required files:`n$($MissingRequired -join "`n")"
}

# Manifest with hashes.
$ManifestPath = Join-Path $Meta "archive-manifest.tsv"
"sha256`tbytes`tpath" | Out-File -Encoding utf8 $ManifestPath
Get-ChildItem -LiteralPath $Stage -Recurse -File |
  Where-Object { $_.FullName -ne $ManifestPath } |
  Sort-Object FullName |
  ForEach-Object {
    $rel = $_.FullName.Substring($Stage.Length).TrimStart("\","/").Replace("\","/")
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
    "$hash`t$($_.Length)`t$rel" | Out-File -Encoding utf8 -Append $ManifestPath
  }

# Human README inside archive.
@"
MPREPLY next-chat context archive

Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Root: $Root

This archive intentionally contains:
- relevant Hero source files
- styles and tokens
- public brand/icon assets
- unit/design/e2e test files related to public Hero
- package manifests
- read-only git metadata under _meta/

This archive intentionally excludes:
- node_modules
- .next
- .turbo
- dist/build/out
- coverage
- .git
- .handoff staging folders

Important:
- This script does not run git add/commit/checkout.
- CRLF/LF warnings are handled by repository Git attributes/config, not by this archiver.
"@ | Out-File -Encoding utf8 (Join-Path $Stage "README_CONTEXT_RU.txt")

# Create ZIP.
if (Test-Path $Zip) { Remove-Item -Force $Zip }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip -Force -CompressionLevel Optimal

$ZipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Zip).Hash.ToLowerInvariant()
"$ZipHash  $(Split-Path $Zip -Leaf)" | Out-File -Encoding ascii $ShaFile

Remove-Item -Recurse -Force $Stage

Write-Host "Created: $Zip"
Write-Host "SHA:     $ShaFile"
Write-Host "Files:   $($Copied.Count) source files + _meta"
