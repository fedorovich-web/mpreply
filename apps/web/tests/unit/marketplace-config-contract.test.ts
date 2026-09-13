import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const marketplacesPage = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");

describe("marketplace public configuration", () => {
  it("keeps readiness as one shared product truth instead of per-marketplace duplicate state", () => {
    expect(siteConfig).toContain('export const marketplaceStatusLabel = "Интеграция готова"');
    expect(siteConfig).not.toContain('status: "supported"');
    expect(siteConfig).not.toContain("statusLabel:");
    expect(marketplacesPage).toContain("marketplaceStatusLabel");
    expect(marketplaceLanding).toContain("marketplaceStatusLabel");
    expect(marketplacesPage).not.toContain("marketplace.statusLabel");
    expect(marketplaceLanding).not.toContain("marketplace.statusLabel");
  });
});
