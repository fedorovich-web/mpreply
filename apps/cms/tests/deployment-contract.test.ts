import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "../..");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function environmentKeys(source: string): Set<string> {
  return new Set(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.split("=", 1)[0]),
  );
}

describe("production CMS deployment contract", () => {
  const compose = readRepositoryFile("infra/docker/docker-compose.production.yml");
  const productionEnvironment = readRepositoryFile(
    "infra/coolify/.env.production.example",
  );
  const dockerfile = readRepositoryFile("apps/cms/Dockerfile");

  it("keeps internal services private and persists CMS state", () => {
    expect(compose).toContain("  cms:");
    expect(compose).not.toMatch(/^\s+ports:/mu);
    expect(compose).toContain("cms-media:/app/uploads");
    expect(compose).toContain("web-cache:/app/.next/cache");
    expect(compose).toContain("CMS_DATABASE_URL:");
  });

  it("runs the CMS as a non-root standalone image with a health check", () => {
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain("@img/sharp-libvips-linux-x64/lib");
    expect(dockerfile).toMatch(/^USER payload$/mu);
    expect(dockerfile).toContain("/api/health");
    expect(compose).toContain("http://127.0.0.1:3001/api/health");
  });

  it("lists every Compose variable in the Coolify inventory", () => {
    const referencedVariables = new Set(
      Array.from(compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/gu), (match) => match[1]),
    );
    const documentedVariables = environmentKeys(productionEnvironment);
    const missing = [...referencedVariables].filter(
      (variable) => !documentedVariables.has(variable),
    );

    expect(missing).toEqual([]);
  });

  it("supports database-managed LLM configuration without an environment key", () => {
    expect(compose).toContain("OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}");
  });
});
