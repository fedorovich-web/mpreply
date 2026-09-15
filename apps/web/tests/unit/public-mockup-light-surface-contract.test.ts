import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = readFileSync(join(root, "styles/public-mockup-brand-fidelity.css"), "utf8");

describe("approved public mockups stay on the light render surface", () => {
  it("pins light surface and text tokens even when the app theme is dark", () => {
    expect(css).toContain(".public-root:has(.mockup-page)");
    expect(css).toContain("--color-bg-page: #ffffff");
    expect(css).toContain("--color-bg-surface: #ffffff");
    expect(css).toContain("--color-public-page: #ffffff");
    expect(css).toContain("--color-text-primary: #071846");
    expect(css).toContain("--color-text-secondary: #50648a");
    expect(css).toContain("--color-border-subtle: #dceafa");
  });
});
