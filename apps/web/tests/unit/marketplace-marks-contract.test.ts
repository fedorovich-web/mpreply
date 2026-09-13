import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const home = readFileSync(join(root, "app/page.tsx"), "utf8");
const marketplaceOverview = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");

describe("marketplace visual marks", () => {
  it("owns marketplace marks in the shared configuration", () => {
    for (const mark of ["WB", "OZ", "М", "A"]) {
      expect(siteConfig).toContain(`mark: "${mark}"`);
    }
  });

  it("renders configured marks without route-specific branching", () => {
    for (const source of [home, marketplaceOverview, marketplaceLanding]) {
      expect(source).toContain("marketplace.mark");
      expect(source).not.toContain('marketplace.key === "yandex-market"');
      expect(source).not.toContain('marketplace.key === "avito"');
      expect(source).not.toContain("marketplace.shortName.slice");
    }
  });
});
