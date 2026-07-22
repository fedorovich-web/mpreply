#!/usr/bin/env bash
set -euo pipefail

# MPREPLY next-chat context archiver v2
# Read-only Git usage only: no git add/commit/checkout/renormalize.

find_repo_root() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.git" || -f "$dir/apps/web/package.json" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo "Cannot find repository root. Run this from the repo or a child directory." >&2
  return 1
}

ROOT="$(find_repo_root)"
WEB="$ROOT/apps/web"
[[ -d "$WEB" ]] || { echo "Missing apps/web directory. Root: $ROOT" >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/.handoff"
STAGE="$OUT_DIR/_stage-$STAMP"
META="$STAGE/_meta"
ZIP="$OUT_DIR/mpreply-next-chat-context-$STAMP.zip"
SHA_FILE="$ZIP.sha256"

rm -rf "$STAGE"
mkdir -p "$META" "$OUT_DIR"

exclude_path() {
  local p="$1"
  case "$p" in
    */.git/*|*/.next/*|*/.turbo/*|*/node_modules/*|*/dist/*|*/build/*|*/out/*|*/coverage/*|*/.vercel/*|*/.cache/*|*/playwright-report/*|*/test-results/*|*/.handoff/*) return 0 ;;
    *) return 1 ;;
  esac
}

copy_rel() {
  local rel="$1"
  local src="$ROOT/$rel"
  [[ -f "$src" ]] || return 1
  exclude_path "$src" && return 1
  mkdir -p "$(dirname "$STAGE/$rel")"
  cp -p "$src" "$STAGE/$rel"
  return 0
}

include_files=(
  "README.md"
  "package.json"
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
  "MPREPLY_SENIOR_HANDOFF_NEXT_CHAT_0.1.46_RU.md"
  "apps/web/package.json"
  "apps/web/package-lock.json"
  "apps/web/next.config.js"
  "apps/web/next.config.mjs"
  "apps/web/next.config.ts"
  "apps/web/tsconfig.json"
  "apps/web/eslint.config.mjs"
  "apps/web/postcss.config.mjs"
  "apps/web/vitest.config.ts"
  "apps/web/playwright.config.ts"
  "apps/web/app/page.tsx"
  "apps/web/app/layout.tsx"
  "apps/web/app/globals.css"
  "apps/web/e2e/public-site.spec.ts"
  "apps/web/tests/unit/hero-orbital-scene.test.ts"
  "apps/web/tests/unit/public-visual-recovery-contract.test.ts"
  "apps/web/tests/design/design-tokens.test.ts"
  "apps/web/scripts/validate-w3c-css.mjs"
  "apps/web/scripts/validate-w3c-html.mjs"
)

include_dirs=(
  "apps/web/components/public-site"
  "apps/web/styles"
  "apps/web/lib"
  "apps/web/public/brand"
  "apps/web/public/icons/hero"
  "apps/web/tests/unit"
  "apps/web/tests/design"
  "apps/web/e2e"
  "apps/web/scripts"
)

copied=0
for rel in "${include_files[@]}"; do
  if copy_rel "$rel"; then copied=$((copied+1)); fi
done

for dir in "${include_dirs[@]}"; do
  [[ -d "$ROOT/$dir" ]] || continue
  while IFS= read -r -d '' file; do
    exclude_path "$file" && continue
    rel="${file#$ROOT/}"
    if copy_rel "$rel"; then copied=$((copied+1)); fi
  done < <(find "$ROOT/$dir" -type f -print0)
done

(
  cd "$ROOT"
  git status --short > "$META/git-status-short.txt" 2>&1 || true
  git status --porcelain=v1 > "$META/git-status-porcelain.txt" 2>&1 || true
  git diff -- apps/web/app/page.tsx apps/web/components/public-site apps/web/styles apps/web/package.json apps/web/package-lock.json > "$META/git-diff-hero.patch" 2>&1 || true
  git log --oneline -n 20 > "$META/git-log-last-20.txt" 2>&1 || true
  git ls-files apps/web/app/page.tsx apps/web/components/public-site apps/web/styles apps/web/tests apps/web/e2e apps/web/public/brand apps/web/public/icons apps/web/package.json apps/web/package-lock.json > "$META/git-ls-files-relevant.txt" 2>&1 || true
)

(
  cd "$WEB"
  npm pkg get scripts version dependencies devDependencies > "$META/npm-pkg-summary.json" 2>&1 || true
)

required=(
  "apps/web/app/page.tsx"
  "apps/web/package.json"
  "apps/web/package-lock.json"
  "apps/web/components/public-site/HeroProductFlowCanvas.tsx"
  "apps/web/components/public-site/HeroProductFlowCanvas.module.css"
  "apps/web/styles/tokens.css"
  "apps/web/styles/public-site.css"
)

missing=()
for rel in "${required[@]}"; do
  [[ -f "$STAGE/$rel" ]] || missing+=("$rel")
done

if (( ${#missing[@]} > 0 )); then
  printf "%s\n" "${missing[@]}" > "$META/MISSING_REQUIRED.txt"
  echo "Archive is incomplete. Missing required files:" >&2
  printf " - %s\n" "${missing[@]}" >&2
  exit 1
fi

manifest="$META/archive-manifest.tsv"
printf "sha256\tbytes\tpath\n" > "$manifest"
while IFS= read -r -d '' file; do
  [[ "$file" == "$manifest" ]] && continue
  rel="${file#$STAGE/}"
  if command -v sha256sum >/dev/null 2>&1; then
    hash="$(sha256sum "$file" | awk '{print $1}')"
  else
    hash="$(shasum -a 256 "$file" | awk '{print $1}')"
  fi
  bytes="$(wc -c < "$file" | tr -d ' ')"
  printf "%s\t%s\t%s\n" "$hash" "$bytes" "$rel" >> "$manifest"
done < <(find "$STAGE" -type f -print0 | sort -z)

cat > "$STAGE/README_CONTEXT_RU.txt" <<EOF
MPREPLY next-chat context archive

Created: $(date '+%Y-%m-%d %H:%M:%S')
Root: $ROOT

Contains relevant Hero source, styles, tokens, public assets, tests, package manifests, and read-only git metadata.
Excludes node_modules, .next, .turbo, dist/build/out, coverage, .git, and .handoff staging folders.

This script never runs git add/commit/checkout.
EOF

rm -f "$ZIP" "$SHA_FILE"
(
  cd "$STAGE"
  zip -qr "$ZIP" .
)

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ZIP" | awk '{print $1 "  " FILENAME}' FILENAME="$(basename "$ZIP")" > "$SHA_FILE"
else
  shasum -a 256 "$ZIP" | awk '{print $1 "  " FILENAME}' FILENAME="$(basename "$ZIP")" > "$SHA_FILE"
fi

rm -rf "$STAGE"

echo "Created: $ZIP"
echo "SHA:     $SHA_FILE"
echo "Files:   $copied source files + _meta"
