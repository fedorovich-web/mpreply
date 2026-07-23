#!/usr/bin/env node
/*
 * MP Reply next-chat context archiver v5.
 *
 * The archive is built exclusively from Git-tracked files and is emitted only
 * after clean-tree, local/remote SHA, dependency-tree, integrity and release-
 * evidence checks pass. No Git write command is executed.
 */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const SCRIPT_VERSION = "5.0.0";
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => !arg.includes("=")));
const options = new Map(
  argv
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const index = arg.indexOf("=");
      return [arg.slice(2, index), arg.slice(index + 1)];
    }),
);
const dryRun = flags.has("--dry-run");
const keepStaging = flags.has("--keep-staging");

function run(command, args, cwd, { encoding = "utf8" } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding,
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? (encoding ? "" : Buffer.alloc(0)),
    stderr: result.stderr ?? (encoding ? "" : Buffer.alloc(0)),
    error: result.error ?? null,
  };
}

function requireCommand(result, label) {
  if (result.ok) return result;
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
  const spawnError = result.error ? `\nspawn error: ${result.error.message}` : "";
  throw new Error(`${label} failed with exit ${result.status}:\n${stdout}${stderr}${spawnError}`.trim());
}

function runNpm(args, cwd) {
  if (process.platform !== "win32") return run("npm", args, cwd);
  const commandProcessor = process.env.ComSpec || process.env.COMSPEC || "cmd.exe";
  const commandLine = ["npm.cmd", ...args].join(" ");
  return run(commandProcessor, ["/d", "/s", "/c", commandLine], cwd);
}

function normalizePath(value) {
  return value.split(sep).join("/");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function timestampUtc() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function findRepoRoot() {
  const explicit = options.get("root");
  if (explicit) return resolve(explicit);
  const result = requireCommand(run("git", ["rev-parse", "--show-toplevel"], process.cwd()), "git rev-parse --show-toplevel");
  return resolve(result.stdout.trim());
}

function resolveEvidencePath(root, optionName, fallback) {
  const value = options.get(optionName) ?? fallback;
  return isAbsolute(value) ? value : resolve(root, value);
}

function readReleaseEvidence(path, expectedKind, expectedHead, expectedVersion) {
  const evidence = safeReadJson(path);
  if (!evidence) throw new Error(`Release evidence is missing or invalid JSON: ${path}`);
  const generatedAt = Date.parse(evidence.generatedAt ?? "");
  const ageMs = Date.now() - generatedAt;
  if (!Number.isFinite(generatedAt) || ageMs < -5 * 60_000 || ageMs > 24 * 60 * 60_000) {
    throw new Error(`Release evidence is stale or has an invalid timestamp: ${path}`);
  }
  if (
    evidence.schemaVersion !== 1 ||
    evidence.kind !== expectedKind ||
    evidence.status !== "PASS" ||
    evidence.allPassed !== true ||
    evidence.repository?.head !== expectedHead ||
    evidence.release?.version !== expectedVersion
  ) {
    throw new Error(`Release evidence does not match current HEAD/version or is not PASS: ${path}`);
  }
  return evidence;
}

const FORBIDDEN_PARTS = new Set([
  ".git",
  ".lighthouseci",
  ".mypy_cache",
  ".next",
  ".npm",
  ".pnpm-store",
  ".pytest_cache",
  ".qa-venv",
  ".ruff_cache",
  ".turbo",
  ".venv",
  "__pycache__",
  "blob-report",
  "build",
  "coverage",
  "dist",
  "lighthouse-report",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
]);

const FORBIDDEN_FILES = new Set([".coverage", "coverage.xml", "tsconfig.tsbuildinfo"]);
const PATCH_DEBRIS = [
  /(^|\/)before-.*\.(patch|zip|txt)$/i,
  /(^|\/)mpreply-.*\.(zip|patch|sha256)$/i,
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

function isAllowedTrackedEnv(path) {
  const lower = path.toLowerCase();
  if (!lower.includes(".env")) return true;
  return (
    lower === "infra/docker/.env.ci" ||
    lower.endsWith(".example") ||
    lower.endsWith(".sample") ||
    lower.endsWith(".template")
  );
}

function assertTrackedPathAllowed(path) {
  const parts = path.split("/");
  if (parts.some((part) => FORBIDDEN_PARTS.has(part) || part.endsWith(".egg-info"))) {
    throw new Error(`Generated artifact is tracked and cannot be exported: ${path}`);
  }
  if (FORBIDDEN_FILES.has(parts.at(-1))) throw new Error(`Generated artifact is tracked and cannot be exported: ${path}`);
  if (!isAllowedTrackedEnv(path)) throw new Error(`Tracked environment file is not an approved template/CI fixture: ${path}`);
  if (PATCH_DEBRIS.some((pattern) => pattern.test(path))) throw new Error(`Local patch/release debris is tracked: ${path}`);
}

function trackedFiles(root) {
  const result = requireCommand(run("git", ["ls-files", "-z"], root, { encoding: null }), "git ls-files");
  const paths = result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .sort((a, b) => a.localeCompare(b));
  if (paths.length === 0) throw new Error("Git tracked-file set is empty");
  const seen = new Set();
  return paths.map((rel) => {
    if (seen.has(rel)) throw new Error(`Duplicate tracked path: ${rel}`);
    seen.add(rel);
    assertTrackedPathAllowed(rel);
    const full = join(root, ...rel.split("/"));
    if (!existsSync(full)) throw new Error(`Tracked file is missing from the working tree: ${rel}`);
    const stats = lstatSync(full);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Tracked entry must be a regular non-symlink file: ${rel}`);
    if (stats.size > 25 * 1024 * 1024) throw new Error(`Tracked file exceeds the 25 MiB handoff limit: ${rel}`);
    return { rel, full, size: stats.size };
  });
}

function scanSecrets(files) {
  const highConfidencePatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  ];
  const findings = [];
  for (const file of files) {
    const bytes = readFileSync(file.full);
    if (bytes.includes(0)) continue;
    const content = bytes.toString("utf8");
    for (const pattern of highConfidencePatterns) {
      if (pattern.test(content)) findings.push(`${file.rel}: ${pattern}`);
    }
  }
  if (findings.length > 0) throw new Error(`Potential secret material found:\n${findings.join("\n")}`);
  return { status: "PASS", filesScanned: files.length, highConfidenceFindings: 0 };
}

function gitText(root, args) {
  const result = run("git", args, root);
  return {
    command: `git ${args.join(" ")}`,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function collectPreflight(root, version) {
  const branch = requireCommand(run("git", ["branch", "--show-current"], root), "git branch --show-current").stdout.trim();
  if (!branch) throw new Error("Detached HEAD is not allowed for final handoff export");
  const head = requireCommand(run("git", ["rev-parse", "HEAD"], root), "git rev-parse HEAD").stdout.trim();
  const upstream = requireCommand(
    run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], root),
    "git upstream resolution",
  ).stdout.trim();
  const status = requireCommand(run("git", ["status", "--porcelain=v1", "--untracked-files=all"], root), "git status").stdout;
  if (status.trim()) throw new Error(`Working tree is not clean:\n${status}`);
  requireCommand(run("git", ["diff", "--check"], root), "git diff --check");
  requireCommand(run("git", ["diff", "--cached", "--check"], root), "git diff --cached --check");

  const counts = requireCommand(run("git", ["rev-list", "--left-right", "--count", `HEAD...${upstream}`], root), "git ahead/behind").stdout
    .trim()
    .split(/\s+/)
    .map(Number);
  if (counts.length !== 2 || counts.some((value) => !Number.isInteger(value))) throw new Error("Cannot parse ahead/behind counts");
  const [ahead, behind] = counts;
  if (ahead !== 0 || behind !== 0) throw new Error(`Branch divergence detected: ahead=${ahead}, behind=${behind}`);

  const slash = upstream.indexOf("/");
  if (slash <= 0) throw new Error(`Cannot parse upstream remote from ${upstream}`);
  const remote = upstream.slice(0, slash);
  const remoteBranch = upstream.slice(slash + 1);
  const remoteUrl = requireCommand(run("git", ["remote", "get-url", remote], root), "git remote get-url").stdout.trim();
  const lsRemote = requireCommand(
    run("git", ["ls-remote", "--heads", remote, `refs/heads/${remoteBranch}`], root),
    "git ls-remote",
  ).stdout.trim();
  const remoteHead = lsRemote.split(/\s+/, 1)[0] ?? "";
  if (!remoteHead || remoteHead !== head) throw new Error(`Remote SHA mismatch: local=${head} remote=${remoteHead || "missing"}`);

  const dependencyTree = requireCommand(
    runNpm(["ls", "--package-lock-only", "--all"], join(root, "apps", "web")),
    "npm ls --package-lock-only --all",
  );

  let integrity = null;
  for (const python of process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"]) {
    const candidate = run(python, [join(root, "scripts", "check_integrity.py")], root);
    if (candidate.ok) {
      integrity = { command: `${python} scripts/check_integrity.py`, status: 0, stdout: candidate.stdout, stderr: candidate.stderr };
      break;
    }
  }
  if (!integrity) throw new Error("Repository integrity gate failed or Python is unavailable");

  const projectResultPath = resolveEvidencePath(root, "project-result", ".handoff/project-quality-result.json");
  const containerResultPath = resolveEvidencePath(root, "container-result", ".handoff/container-gate-result.json");
  const projectEvidence = readReleaseEvidence(projectResultPath, "project-quality", head, version);
  const containerEvidence = readReleaseEvidence(containerResultPath, "container", head, version);

  return {
    checkedAt: new Date().toISOString(),
    branch,
    head,
    upstream,
    remote,
    remoteBranch,
    remoteUrl,
    remoteHead,
    ahead,
    behind,
    clean: true,
    dependencyTree: {
      status: "PASS",
      command: "npm ls --package-lock-only --all",
      outputSha256: sha256Buffer(Buffer.from(dependencyTree.stdout, "utf8")),
    },
    integrity: {
      status: "PASS",
      command: integrity.command,
      output: integrity.stdout.trim(),
    },
    evidence: {
      project: projectEvidence,
      container: containerEvidence,
    },
  };
}

function packageSnapshot(root, version) {
  const packageJson = safeReadJson(join(root, "apps", "web", "package.json")) ?? {};
  const lock = safeReadJson(join(root, "apps", "web", "package-lock.json")) ?? {};
  const pyprojectPath = join(root, "apps", "api", "pyproject.toml");
  const pyproject = existsSync(pyprojectPath) ? readFileSync(pyprojectPath, "utf8") : "";
  return {
    generatedAt: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    releaseVersion: version,
    web: {
      packageJsonPath: "apps/web/package.json",
      name: packageJson.name ?? null,
      version: packageJson.version ?? null,
      engines: packageJson.engines ?? null,
      scripts: packageJson.scripts ?? {},
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
      overrides: packageJson.overrides ?? {},
      lockfileVersion: lock.lockfileVersion ?? null,
    },
    api: {
      pyprojectPath: "apps/api/pyproject.toml",
      detectedVersionLine: pyproject.split(/\r?\n/).find((line) => /^version\s*=/.test(line.trim())) ?? null,
    },
  };
}

function copyFiles(files, destinationRoot) {
  for (const file of files) {
    const destination = join(destinationRoot, ...file.rel.split("/"));
    ensureDir(dirname(destination));
    copyFileSync(file.full, destination);
  }
}

function writeAtomicJson(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
}

function writeHandoff(root, stagingProjectRoot, archiveBaseName, version, files, preflight, secretScan) {
  const handoff = join(stagingProjectRoot, "HANDOFF");
  ensureDir(handoff);
  const manifest = files
    .map((file) => `${sha256File(file.full)}  ${String(file.size).padStart(12, " ")}  ${file.rel}`)
    .join("\n");
  writeFileSync(join(handoff, "FILE_MANIFEST_SHA256.txt"), `${manifest}\n`, "utf8");
  writeFileSync(join(handoff, "ARCHIVE_CONTENTS.txt"), `${files.map((file) => file.rel).join("\n")}\n`, "utf8");
  writeAtomicJson(join(handoff, "PACKAGE_SNAPSHOT.json"), packageSnapshot(root, version));

  const gitCommands = [
    ["rev-parse", "--show-toplevel"],
    ["status", "--short", "--branch"],
    ["status", "--ignored", "--short"],
    ["branch", "--show-current"],
    ["rev-parse", "HEAD"],
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    ["remote", "-v"],
    ["log", "-20", "--oneline", "--decorate"],
    ["diff", "--check"],
    ["diff", "--stat"],
    ["diff"],
    ["diff", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const snapshot = gitCommands
    .map((args) => {
      const result = gitText(root, args);
      return `$ ${result.command}\nEXIT ${result.status}\n${result.stdout}${result.stderr}`;
    })
    .join("\n\n---\n\n");
  writeFileSync(join(handoff, "GIT_SNAPSHOT.txt"), `${snapshot}\n`, "utf8");

  writeFileSync(
    join(handoff, "PROJECT_SNAPSHOT.md"),
    `# MP Reply project snapshot\n\nGenerated: ${new Date().toISOString()}\nScript: create-mpreply-next-chat-context-v4.mjs ${SCRIPT_VERSION}\nRelease: ${version}\nBranch: ${preflight.branch}\nHEAD: ${preflight.head}\nRemote HEAD: ${preflight.remoteHead}\nFiles included: ${files.length}\n\nThe archive was created only after clean-tree, local/remote SHA, dependency-tree, repository-integrity, project-quality evidence and container evidence checks passed.\n`,
    "utf8",
  );
  writeFileSync(
    join(handoff, "EXCLUDED_FILES_POLICY.md"),
    "# Exclusion policy\n\nThe payload is the complete approved Git-tracked regular-file set. Git metadata, untracked/ignored files, dependency directories, caches, generated QA reports, build output, real environment files, local patch debris and *.egg-info are forbidden. The tracked CI fixture infra/docker/.env.ci and tracked *.env.example/sample/template files are allowed and scanned.\n",
    "utf8",
  );

  writeAtomicJson(join(handoff, "result.json"), {
    schemaVersion: 1,
    status: "PASS",
    generatedAt: new Date().toISOString(),
    archive: { baseName: archiveBaseName, scriptVersion: SCRIPT_VERSION, sourceFileCount: files.length },
    release: { version },
    git: preflight,
    security: { secretScan },
  });
}

function zipWithPython(root, stagingProjectRoot, zipPath) {
  const script = String.raw`
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(src)
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for current, dirs, files in os.walk(src):
        dirs.sort(); files.sort()
        for name in files:
            full = os.path.join(current, name)
            rel = os.path.relpath(full, base).replace(os.sep, "/")
            zf.write(full, rel)
`;
  for (const python of process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"]) {
    const result = run(python, ["-c", script, stagingProjectRoot, zipPath], root);
    if (result.ok) return python;
  }
  throw new Error("Python ZIP creation failed");
}

function verifyZip(root, zipPath, archiveBaseName) {
  const script = String.raw`
import hashlib, pathlib, stat, sys, zipfile
path = pathlib.Path(sys.argv[1])
prefix = sys.argv[2].rstrip("/") + "/"
forbidden = {".git", ".lighthouseci", ".next", ".venv", "__pycache__", "coverage", "dist", "node_modules", "out", "playwright-report", "test-results"}
with zipfile.ZipFile(path, "r") as zf:
    infos = zf.infolist()
    names = [info.filename for info in infos]
    if len(names) != len(set(names)):
        raise SystemExit("duplicate ZIP entries")
    for info in infos:
        name = info.filename.replace("\\", "/")
        pure = pathlib.PurePosixPath(name)
        if not name.startswith(prefix) or pure.is_absolute() or ".." in pure.parts or (pure.parts and ":" in pure.parts[0]):
            raise SystemExit(f"unsafe ZIP entry: {name}")
        if info.flag_bits & 0x1:
            raise SystemExit(f"encrypted ZIP entry: {name}")
        mode = (info.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode):
            raise SystemExit(f"symlink ZIP entry: {name}")
        rel_parts = pure.parts[1:]
        if any(part in forbidden or part.endswith(".egg-info") for part in rel_parts):
            raise SystemExit(f"generated artifact in ZIP: {name}")
    bad = zf.testzip()
    if bad:
        raise SystemExit(f"CRC failure: {bad}")
    control = prefix + "HANDOFF/"
    contents = zf.read(control + "ARCHIVE_CONTENTS.txt").decode("utf-8").splitlines()
    manifest_lines = zf.read(control + "FILE_MANIFEST_SHA256.txt").decode("utf-8").splitlines()
    payload = sorted(name[len(prefix):] for name in names if name.startswith(prefix) and not name.startswith(control))
    if payload != sorted(contents):
        raise SystemExit("ARCHIVE_CONTENTS does not match ZIP payload")
    parsed = {}
    for line in manifest_lines:
        digest, size, rel = line.split(maxsplit=2)
        parsed[rel] = (digest, int(size))
    if set(parsed) != set(contents):
        raise SystemExit("manifest path set mismatch")
    for rel in contents:
        data = zf.read(prefix + rel)
        digest, size = parsed[rel]
        if len(data) != size or hashlib.sha256(data).hexdigest() != digest:
            raise SystemExit(f"manifest mismatch: {rel}")
print("OK")
`;
  for (const python of process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"]) {
    const result = run(python, ["-c", script, zipPath, archiveBaseName], root);
    if (result.ok) return;
  }
  throw new Error("ZIP safety/manifest verification failed");
}

function main() {
  const root = findRepoRoot();
  const packagePath = join(root, "apps", "web", "package.json");
  const packageJson = safeReadJson(packagePath);
  if (!packageJson?.version) throw new Error(`Cannot read release version from ${packagePath}`);
  const version = packageJson.version;
  const preflight = collectPreflight(root, version);
  const files = trackedFiles(root);
  const secretScan = scanSecrets(files);
  const archiveBaseName = `mpreply-next-chat-context-${version}-${timestampUtc()}-${preflight.head.slice(0, 12)}`;
  const outputDirectory = resolve(options.get("out") ?? dirname(root));
  const stagingRoot = join(tmpdir(), `${archiveBaseName}-stage`);
  const stagingProjectRoot = join(stagingRoot, archiveBaseName);
  const zipPath = join(outputDirectory, `${archiveBaseName}.zip`);
  const shaPath = `${zipPath}.sha256`;

  console.log(`MP Reply context archiver v${SCRIPT_VERSION}`);
  console.log(`Root: ${root}`);
  console.log(`Release: ${version}`);
  console.log(`Branch/HEAD: ${preflight.branch} ${preflight.head}`);
  console.log(`Remote HEAD: ${preflight.remoteHead}`);
  console.log(`Tracked files selected: ${files.length}`);
  console.log(`Output: ${zipPath}`);

  if (dryRun) {
    for (const file of files) console.log(file.rel);
    return;
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  ensureDir(stagingProjectRoot);
  copyFiles(files, stagingProjectRoot);
  writeHandoff(root, stagingProjectRoot, archiveBaseName, version, files, preflight, secretScan);
  ensureDir(outputDirectory);
  rmSync(zipPath, { force: true });
  rmSync(shaPath, { force: true });

  const python = zipWithPython(root, stagingProjectRoot, zipPath);
  verifyZip(root, zipPath, archiveBaseName);
  const sha = sha256File(zipPath);
  writeFileSync(shaPath, `${sha}  ${basename(zipPath)}\n`, "utf8");

  console.log(`ZIP created with ${python}: ${zipPath}`);
  console.log(`ZIP size: ${statSync(zipPath).size} bytes`);
  console.log(`SHA-256: ${sha}`);
  console.log(`SHA file: ${shaPath}`);
  console.log("HANDOFF result: PASS");

  if (!keepStaging) rmSync(stagingRoot, { recursive: true, force: true });
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
