import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const packageJson = JSON.parse(read("apps/web/package.json")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const bootstrap = read("scripts/bootstrap-design-tooling.ps1");
const toolingDoc = read("docs/qa/frontend-design-tooling.md");

describe("frontend tooling contract", () => {
  it("does not invoke removed Impeccable package scripts or generated skill installation", () => {
    expect(bootstrap).not.toContain("design:detect");
    expect(bootstrap).not.toContain("impeccable:install");
    expect(bootstrap).not.toContain("SkipImpeccableSkills");
    expect(toolingDoc).not.toContain("design:detect");
    expect(toolingDoc).not.toContain("design:detect:json");
    expect(toolingDoc).not.toContain("impeccable:install");
    expect(toolingDoc).not.toContain("provider-skill installation");
  });

  it("documents only live frontend QA commands", () => {
    for (const command of [
      "test:unit",
      "test:design-tokens",
      "typecheck",
      "lint",
      "validate:css-syntax",
      "build",
      "validate:w3c",
      "test:e2e",
      "test:a11y",
      "test:visual",
      "lighthouse",
    ]) {
      expect(packageJson.scripts[command]).toBeTruthy();
      expect(toolingDoc).toContain(`\`${command}\``);
    }
  });

  it("keeps the removed design CLI out of the active project toolchain", () => {
    expect(packageJson.devDependencies).not.toHaveProperty("impeccable");
    expect(bootstrap).not.toMatch(/impeccable/i);
    expect(toolingDoc).not.toMatch(/impeccable/i);
    expect(toolingDoc).toContain("MPReply");
  });
});
