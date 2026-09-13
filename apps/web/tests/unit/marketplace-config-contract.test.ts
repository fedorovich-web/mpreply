import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const marketplacesPage = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");

describe("marketplace public configuration", () => {
  it("derives readiness from one shared product truth instead of per-marketplace duplicate state", () => {
    expect(siteConfig).toContain('const marketplaceStatusLabel = "Интеграция готова"');
    expect(siteConfig).not.toContain("export const marketplaceStatusLabel");
    expect(siteConfig.match(/Интеграция готова/g)).toHaveLength(1);
    expect(siteConfig).not.toContain('status: "supported"');
    expect(siteConfig).toContain("statusLabel: marketplaceStatusLabel");
    expect(marketplacesPage).toContain("marketplace.statusLabel");
    expect(marketplaceLanding).toContain("marketplace.statusLabel");
  });
});
