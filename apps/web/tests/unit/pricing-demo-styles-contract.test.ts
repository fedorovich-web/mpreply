import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "styles/pricing-demo-approved.css"), "utf8");

describe("pricing and demo styles", () => {
  it("uses the defined muted surface token", () => {
    expect(css).not.toContain("var(--color-bg-muted)");
    expect(css).toContain("var(--color-surface-muted)");
  });
});
