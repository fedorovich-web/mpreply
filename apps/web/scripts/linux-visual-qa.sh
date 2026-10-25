#!/usr/bin/env bash
set -eu

phase=${1:?capture or verify is required}
case "$phase" in capture|verify) ;; *) exit 64 ;; esac
trap 'qa_exit=$?; printf "QA_JOB_EXIT=%s\n" "$qa_exit"; sleep 1800' EXIT

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

node --input-type=module <<'EXPORT'
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
assert.equal(process.platform, 'linux');
const report = JSON.parse(await readFile('/qa/report.json', 'utf8'));
const captures = new Map();
function collect(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
    for (const attachment of result.attachments ?? []) {
      const match = /^home-(desktop|mobile)-observed\.png$/.exec(attachment.name);
      if (!match || !attachment.path) continue;
      assert(!captures.has(match[1]));
      const source = resolve('/qa/work', attachment.path);
      assert(source.startsWith('/qa/work' + sep));
      captures.set(match[1], source);
    }
  }
  for (const child of suite.suites ?? []) collect(child);
}
for (const suite of report.suites ?? []) collect(suite);
assert.equal(captures.size, 2);
const images = {};
for (const [viewport, source] of captures) {
  const name = `home-${viewport}-linux.png`;
  await copyFile(source, `/qa/export/${name}`);
  images[name] = createHash('sha256').update(await readFile(source)).digest('hex');
}
const sourceHash = createHash('sha256').update(await readFile('/source/e2e/visual.spec.ts')).digest('hex');
await writeFile('/qa/export/receipt.json', JSON.stringify({platform: process.platform, node: process.version,
  browser: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, visualExit: Number(process.env.QA_VISUAL_EXIT),
  stats: report.stats, sourceHash, images}, null, 2));
console.log('QA_VISUAL_EXIT=' + process.env.QA_VISUAL_EXIT);
console.log('QA_STATS=' + JSON.stringify(report.stats));
EXPORT

tar --directory=/qa/export --create --gzip --file=/qa/artifacts.tar.gz .
node --input-type=module <<'ENCODE'
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const archive = await readFile('/qa/artifacts.tar.gz');
const encoded = archive.toString('base64');
const pieces = encoded.match(/.{1,8192}/g);
console.log('QA_ARCHIVE_SHA256=' + createHash('sha256').update(archive).digest('hex'));
for (let i=0; i<pieces.length; i++) console.log(`QA_B64_${i}_${pieces.length}:${pieces[i]}`);
console.log('QA_ARTIFACTS_COMPLETE');
ENCODE

exit "$visual_exit"
