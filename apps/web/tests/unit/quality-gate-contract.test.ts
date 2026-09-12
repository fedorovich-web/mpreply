import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");
const workflow = readFileSync(join(repoRoot, ".github", "workflows", "quality-gate.yml"), "utf8");
const releaseGate = readFileSync(join(repoRoot, "scripts", "release-gate.ps1"), "utf8");
const webDesignGate = readFileSync(join(repoRoot, "scripts", "web-design-gate.ps1"), "utf8");
const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");

describe("objective frontend quality gates", () => {
  it("requires visual regression in CI and local release gates", () => {
    expect(workflow).toContain("npm run test:visual");
    expect(releaseGate).toContain("& $Npm run test:visual");
    expect(webDesignGate).toContain('& $Npm run test:visual');
    expect(webDesignGate).not.toMatch(/if\s*\(\s*\$IncludeVisual\s*\).*test:visual/s);
  });

  it("does not reintroduce subjective Impeccable blocking checks", () => {
    for (const source of [workflow, releaseGate, webDesignGate, packageJson]) {
      expect(source).not.toContain("design:detect");
    }
  });
});
