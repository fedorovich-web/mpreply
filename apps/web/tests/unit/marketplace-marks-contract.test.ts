import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const home = readFileSync(join(root, "app/page.tsx"), "utf8");
const overview = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const landing = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");

describe("marketplace visual identity", () => {
  it("retains the shared accessible marketplace identities", () => {
    for (const mark of ["WB", "OZ", "М", "A"]) expect(siteConfig).toContain('mark: "' + mark + '"');
    for (const key of ["wildberries", "ozon", "yandex-market", "avito"]) expect(siteConfig).toContain('key: "' + key + '"');
  });
  it("renders supplied marks by catalog key rather than synthesizing letter logos", () => {
    for (const source of [home, overview, landing]) {
      for (const asset of ["01-wildberries.avif", "02-ozon.avif", "03-yandex-market.avif", "04-avito.avif"]) expect(source).toContain("/images/icons/final/" + asset);
      expect(source).not.toContain("marketplace.shortName.slice");
      expect(source).not.toContain("marketplace.mark");
    }
    expect(home).toContain("src={homeMarketplaceLogos[marketplace.key]}");
    expect(overview).toContain("src={integration.logo}");
    expect(landing).toContain("const logo = marketplaceLogos[marketplace.key]");
  });
});
