import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("marketplace public configuration", () => {
  it("derives readiness from one shared product truth without forcing a retired status badge into approved renders", () => {
    expect(siteConfig).toContain('const marketplaceStatusLabel = "Интеграция готова"');
    expect(siteConfig).not.toContain("export const marketplaceStatusLabel");
    expect(siteConfig.match(/Интеграция готова/g)).toHaveLength(1);
    expect(siteConfig).not.toContain('status: "supported"');
    expect(siteConfig).toContain("statusLabel: marketplaceStatusLabel");
  });
});
