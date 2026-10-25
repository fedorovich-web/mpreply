#!/usr/bin/env bash
set -eu

phase=${1:?capture or verify is required}
case "$phase" in capture|verify) ;; *) exit 64 ;; esac
trap 'qa_exit=$?; printf "QA_JOB_EXIT=%s\n" "$qa_exit"; sleep 3600' EXIT

if [ "${QA_PREPARED:-0}" != 1 ]; then
mkdir -p /qa/work/lib /qa/home /qa/browser /qa/export
cp -a /source/e2e /qa/work/
cp /source/lib/site-config.ts /source/lib/i18n.ts /qa/work/lib/
cp /source/playwright.config.ts /qa/work/
cd /qa/work
npm init --yes >/dev/null
npm install --ignore-scripts --no-audit --no-fund --save-exact @playwright/test@1.61.1
curl --fail --silent --show-error --connect-timeout 5 --max-time 10 --output /qa/public-home.html --write-out 'QA_PUBLIC_HTTP=%{http_code}\n' https://mpreply.ru/

curl --fail --location --retry 2 --output /qa/brave.zip https://github.com/brave/brave-browser/releases/download/v1.98.60/brave-browser-1.98.60-linux-amd64.zip
echo '0e49b5f84597fbbefdc8d791900d170d4f3792dc5d38056f6a3e35100706cdc7  /qa/brave.zip' | sha256sum --check --strict
python3 -m zipfile -e /qa/brave.zip /qa/browser
chmod -R u+rx /qa/browser

cat > playwright.remote-qa.config.ts <<'CONFIG'
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  workers: 1,
  retries: 0,
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}',
  outputDir: './results',
  reporter: [['line'], ['json', {outputFile: '/qa/report.json'}]],
  use: {...base.use, baseURL: 'https://mpreply.ru', trace: 'off', video: 'off'},
  webServer: undefined,
});
CONFIG
fi

cd /qa/work
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/qa/browser/brave
"$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" --version

set +e
if [ "$phase" = capture ]; then
  npx playwright test e2e/visual.spec.ts --config=playwright.remote-qa.config.ts --project=chromium --grep 'home (desktop|mobile) visual baseline$'
else
  npx playwright test e2e/visual.spec.ts --config=playwright.remote-qa.config.ts --project=chromium
fi
visual_exit=$?
set -e
export QA_VISUAL_EXIT=$visual_exit

node --input-type=module <<'SUMMARY'
import {readFile} from 'node:fs/promises';
const r=JSON.parse(await readFile('/qa/report.json','utf8'));
console.log('QA_FULL_STATS='+JSON.stringify(r.stats));
console.log('QA_FULL_COMPLETE');
SUMMARY
exit "$visual_exit"
