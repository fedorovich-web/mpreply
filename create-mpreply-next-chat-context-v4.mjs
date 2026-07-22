#!/usr/bin/env node
/*
 * MPReply next-chat context archiver v4
 * Creates a clean ZIP context for a new ChatGPT thread.
 * No npm dependencies. Requires Node.js >= 18 and Python 3 available as `python` or `python3`.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const SCRIPT_VERSION = '4.0.0';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const keepStaging = args.has('--keep-staging');
const explicitRootArg = process.argv.find((arg) => arg.startsWith('--root='));
const explicitOutArg = process.argv.find((arg) => arg.startsWith('--out='));

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1024 * 1024 * 64,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function findRepoRoot(startDir) {
  if (explicitRootArg) return resolve(explicitRootArg.slice('--root='.length));

  const git = run('git', ['rev-parse', '--show-toplevel'], { cwd: startDir });
  if (git.ok && git.stdout.trim()) return resolve(git.stdout.trim());

  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, 'apps', 'web', 'package.json'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}

function normalizePath(pathValue) {
  return pathValue.split(sep).join('/');
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

function sha256Text(text) {
  const hash = createHash('sha256');
  hash.update(text, 'utf8');
  return hash.digest('hex');
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function timestampUtc() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function isEnvExample(rel) {
  const name = basename(rel).toLowerCase();
  return name.includes('.env') && (name.endsWith('.example') || name.endsWith('.sample') || name.endsWith('.template'));
}

const root = findRepoRoot(process.cwd());
const webPkgPath = join(root, 'apps', 'web', 'package.json');
const apiPkgPath = join(root, 'apps', 'api', 'pyproject.toml');
const webPkg = safeReadJson(webPkgPath);
const version = webPkg?.version || 'unknown';
const ts = timestampUtc();
const outDir = explicitOutArg ? resolve(explicitOutArg.slice('--out='.length)) : root;
const archiveBaseName = `mpreply-next-chat-context-${version}-${ts}`;
const stagingRoot = join(tmpdir(), `${archiveBaseName}-stage`);
const stagingProjectRoot = join(stagingRoot, archiveBaseName);
const zipPath = join(outDir, `${archiveBaseName}.zip`);
const shaPath = `${zipPath}.sha256`;

const hardExcludedDirs = new Set([
  '.git',
  'node_modules',
  '.next',
  'out',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
  '.pytest_cache',
  '.ruff_cache',
  '.mypy_cache',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  'test-results',
  'playwright-report',
  '.lighthouseci',
  'files',
]);

const excludedFileRegexes = [
  /(^|\/)before-.*\.(patch|zip|txt)$/i,
  /(^|\/)mpreply-.*\.(zip|patch|sha256)$/i,
  /(^|\/)mpreply-.*SHA256SUMS\.txt$/i,
  /(^|\/)PATCH_(MANIFEST|SHA256SUMS)\.json$/i,
  /(^|\/)PATCH_SHA256SUMS\.txt$/i,
  /(^|\/)FILELIST\.txt$/i,
  /(^|\/)README_PATCH_RU\.md$/i,
  /(^|\/)README_RU\.md$/i,
  /(^|\/)Thumbs\.db$/i,
  /(^|\/)\.DS_Store$/,
  /\.pyc$/,
  /\.pyo$/,
  /\.log$/i,
  /\.tmp$/i,
];

function shouldExclude(rel, stat) {
  const normalized = normalizePath(rel);
  const parts = normalized.split('/');

  for (const part of parts) {
    if (hardExcludedDirs.has(part)) return true;
  }

  if (stat.isFile()) {
    if (normalized.includes('.env') && !isEnvExample(normalized)) return true;
    if (excludedFileRegexes.some((rx) => rx.test(normalized))) return true;
    const sizeLimitBytes = 10 * 1024 * 1024;
    if (stat.size > sizeLimitBytes) return true;
  }

  return false;
}

function walk(dir, base = root, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(base, full);
    const normalized = normalizePath(rel);
    const st = statSync(full);
    if (shouldExclude(normalized, st)) continue;
    if (entry.isDirectory()) {
      walk(full, base, acc);
    } else if (entry.isFile()) {
      acc.push({ full, rel: normalized, size: st.size });
    }
  }
  return acc;
}

function gitOutput(label, cmdArgs) {
  const res = run('git', cmdArgs, { cwd: root });
  return [`$ git ${cmdArgs.join(' ')}`, res.ok ? res.stdout : `EXIT ${res.status}\n${res.stdout}${res.stderr}`].join('\n');
}

function collectPackageSnapshot() {
  const pkg = safeReadJson(webPkgPath) ?? {};
  const lock = safeReadJson(join(root, 'apps', 'web', 'package-lock.json')) ?? {};
  const apiPyproject = existsSync(apiPkgPath) ? readFileSync(apiPkgPath, 'utf8') : '';
  return {
    generatedAt: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    web: {
      packageJsonPath: 'apps/web/package.json',
      name: pkg.name ?? null,
      version: pkg.version ?? null,
      engines: pkg.engines ?? null,
      scripts: pkg.scripts ?? {},
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      overrides: pkg.overrides ?? {},
      lockfileVersion: lock.lockfileVersion ?? null,
    },
    api: {
      pyprojectPath: 'apps/api/pyproject.toml',
      detectedVersionLine: apiPyproject.split(/\r?\n/).find((line) => /^version\s*=/.test(line.trim())) ?? null,
    },
  };
}

function writeHandoffFiles(files) {
  const handoffDir = join(stagingProjectRoot, 'HANDOFF');
  ensureDir(handoffDir);

  const manifestLines = files
    .map(({ rel, full, size }) => `${sha256File(full)}  ${String(size).padStart(12, ' ')}  ${rel}`)
    .sort((a, b) => a.localeCompare(b));

  writeFileSync(join(handoffDir, 'FILE_MANIFEST_SHA256.txt'), manifestLines.join('\n') + '\n', 'utf8');
  writeFileSync(join(handoffDir, 'ARCHIVE_CONTENTS.txt'), files.map((f) => f.rel).sort().join('\n') + '\n', 'utf8');
  writeFileSync(join(handoffDir, 'PACKAGE_SNAPSHOT.json'), JSON.stringify(collectPackageSnapshot(), null, 2) + '\n', 'utf8');

  const gitSections = [
    gitOutput('top-level', ['rev-parse', '--show-toplevel']),
    gitOutput('status', ['status', '--short', '--branch']),
    gitOutput('branch', ['branch', '--show-current']),
    gitOutput('head', ['rev-parse', 'HEAD']),
    gitOutput('remote', ['remote', '-v']),
    gitOutput('log', ['log', '-20', '--oneline', '--decorate']),
    gitOutput('diff-check', ['diff', '--check']),
    gitOutput('diff-stat', ['diff', '--stat']),
    gitOutput('diff', ['diff']),
    gitOutput('cached-diff', ['diff', '--cached']),
    gitOutput('untracked', ['ls-files', '--others', '--exclude-standard']),
  ];
  writeFileSync(join(handoffDir, 'GIT_SNAPSHOT.txt'), gitSections.join('\n\n---\n\n'), 'utf8');

  const projectSnapshot = `# MPReply project snapshot\n\nGenerated: ${new Date().toISOString()}\nScript: create-mpreply-next-chat-context-v4.mjs ${SCRIPT_VERSION}\nRoot: ${root}\nWeb version: ${version}\nFiles included: ${files.length}\n\n## Required next-chat instruction\n\nDo not trust this archive without validation. Verify SHA-256, ZIP integrity, manifest hashes, package versions, Git snapshot, dependency tree, architecture, UI contracts, and quality gates before proposing patches.\n\n## Known active direction\n\nMove from public-site visual recovery to backend/product implementation: account workspace, seller onboarding, marketplace integrations, backend entitlements, answer ledger, moderation/autopublish settings, audit logs, billing, and production readiness.\n`;
  writeFileSync(join(handoffDir, 'PROJECT_SNAPSHOT.md'), projectSnapshot, 'utf8');

  const excluded = `# Exclusion policy\n\nExcluded generated/heavy/private files: .git, node_modules, .next, dist/build/out/coverage, .venv/venv, caches, test-results, playwright-report, .lighthouseci, real .env files, old patch archives, files/ payloads, temporary backup patches.\n\n.env.example / .env.production.example style templates are allowed.\n`;
  writeFileSync(join(handoffDir, 'EXCLUDED_FILES_POLICY.md'), excluded, 'utf8');
}

function copyFiles(files) {
  for (const file of files) {
    const dest = join(stagingProjectRoot, file.rel);
    ensureDir(dirname(dest));
    copyFileSync(file.full, dest);
  }
}

function makeZipWithPython() {
  const pythonCandidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  const script = `
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, dirs, files in os.walk(src):
        dirs.sort(); files.sort()
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, os.path.dirname(src)).replace(os.sep, '/')
            zf.write(full, rel)
`;
  for (const py of pythonCandidates) {
    const res = run(py, ['-c', script, stagingProjectRoot, zipPath], { cwd: root });
    if (res.ok) return { ok: true, python: py };
  }
  return { ok: false, python: null };
}

function verifyZipWithPython() {
  const script = `
import sys, zipfile
path = sys.argv[1]
with zipfile.ZipFile(path, 'r') as zf:
    bad = zf.testzip()
    if bad:
        print(bad)
        sys.exit(2)
print('OK')
`;
  for (const py of ['python3', 'python', 'py']) {
    const res = run(py, ['-c', script, zipPath], { cwd: root });
    if (res.ok) return true;
  }
  return false;
}

function main() {
  if (!existsSync(webPkgPath)) {
    console.error(`ERROR: apps/web/package.json not found from root: ${root}`);
    process.exit(2);
  }

  const files = walk(root).sort((a, b) => a.rel.localeCompare(b.rel));
  console.log(`MPReply context archiver v${SCRIPT_VERSION}`);
  console.log(`Root: ${root}`);
  console.log(`Web version: ${version}`);
  console.log(`Files selected: ${files.length}`);
  console.log(`Output: ${zipPath}`);

  if (dryRun) {
    for (const file of files) console.log(file.rel);
    return;
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  ensureDir(stagingProjectRoot);
  copyFiles(files);
  writeHandoffFiles(files);
  ensureDir(outDir);
  rmSync(zipPath, { force: true });
  rmSync(shaPath, { force: true });

  const zipped = makeZipWithPython();
  if (!zipped.ok) {
    console.error('ERROR: Python zip creation failed. Install Python 3 or run on a machine with python available.');
    process.exit(3);
  }

  const zipOk = verifyZipWithPython();
  if (!zipOk) {
    console.error('ERROR: ZIP integrity verification failed.');
    process.exit(4);
  }

  const sha = sha256File(zipPath);
  writeFileSync(shaPath, `${sha}  ${basename(zipPath)}\n`, 'utf8');

  const stats = statSync(zipPath);
  console.log(`ZIP created with ${zipped.python}: ${zipPath}`);
  console.log(`ZIP size: ${stats.size} bytes`);
  console.log(`SHA-256: ${sha}`);
  console.log(`SHA file: ${shaPath}`);

  if (!keepStaging) rmSync(stagingRoot, { recursive: true, force: true });
}

main();
