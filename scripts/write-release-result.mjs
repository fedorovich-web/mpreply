#!/usr/bin/env node

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const index = arg.indexOf("=");
    return index === -1 ? [arg.replace(/^--/, ""), "true"] : [arg.slice(2, index), arg.slice(index + 1)];
  }),
);

function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function runNpm(commandArgs, cwd) {
  if (process.platform !== "win32") return run("npm", commandArgs, cwd);
  const commandProcessor = process.env.ComSpec || process.env.COMSPEC || "cmd.exe";
  const commandLine = ["npm.cmd", ...commandArgs].join(" ");
  return run(commandProcessor, ["/d", "/s", "/c", commandLine], cwd);
}

function requireValue(name) {
  const value = args.get(name);
  if (!value || value === "true") {
    throw new Error(`Missing --${name}=...`);
  }
  return value;
}

function findRoot() {
  const explicit = args.get("root");
  if (explicit && explicit !== "true") return resolve(explicit);
  const git = run("git", ["rev-parse", "--show-toplevel"], process.cwd());
  if (!git.ok || !git.stdout) throw new Error("Cannot resolve Git repository root");
  return resolve(git.stdout);
}

function commandVersion(command, commandArgs, cwd) {
  const result = run(command, commandArgs, cwd);
  return result.ok ? result.stdout.split(/\r?\n/, 1)[0] : null;
}

const kind = requireValue("kind");
if (!new Set(["project-quality", "container"]).has(kind)) {
  throw new Error(`Unsupported result kind: ${kind}`);
}

const status = requireValue("status");
if (status !== "PASS") throw new Error("Only PASS evidence may be written by this success-path helper");

const root = findRoot();
const packageJson = JSON.parse(readFileSync(join(root, "apps", "web", "package.json"), "utf8"));
const head = run("git", ["rev-parse", "HEAD"], root);
const branch = run("git", ["branch", "--show-current"], root);
if (!head.ok || !head.stdout || !branch.ok || !branch.stdout) {
  throw new Error("Cannot resolve release branch and HEAD");
}

const requiredChecks =
  kind === "project-quality"
    ? [
        "repository-integrity",
        "repository-tooling-tests",
        "backend-imports",
        "backend-pip-check",
        "backend-ruff",
        "backend-pyright",
        "backend-pytest",
        "backend-compileall",
        "alembic-heads",
        "frontend-npm-ci",
        "frontend-dependency-tree",
        "frontend-npm-audit",
        "frontend-unit",
        "frontend-design-tokens",
        "frontend-typecheck",
        "frontend-lint",
        "frontend-design-detect",
        "frontend-css-syntax",
        "frontend-build",
        "frontend-w3c",
        "frontend-e2e",
        "frontend-a11y",
      ]
    : ["docker-daemon", "compose-config", "local-stack-build", "api-readiness", "web-readiness", "container-status"];

const outputArg = requireValue("out");
const output = isAbsolute(outputArg) ? outputArg : resolve(root, outputArg);
mkdirSync(dirname(output), { recursive: true });

const result = {
  schemaVersion: 1,
  kind,
  status,
  allPassed: true,
  generatedAt: new Date().toISOString(),
  source: args.get("source") ?? null,
  repository: {
    root,
    branch: branch.stdout,
    head: head.stdout,
  },
  release: {
    name: packageJson.name ?? null,
    version: packageJson.version ?? null,
  },
  requiredChecks,
  toolchain: {
    node: process.version,
    npm: (() => {
      const result = runNpm(["--version"], root);
      return result.ok ? result.stdout.split(/\r?\n/, 1)[0] : null;
    })(),
    python:
      commandVersion(process.platform === "win32" ? "python" : "python3", ["--version"], root) ??
      commandVersion("python", ["--version"], root),
    git: commandVersion("git", ["--version"], root),
    docker: commandVersion("docker", ["--version"], root),
  },
};

const temporary = `${output}.tmp-${process.pid}`;
writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
renameSync(temporary, output);
console.log(`Release evidence written: ${output}`);
