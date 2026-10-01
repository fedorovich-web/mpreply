import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const englishMarketplaces = readFileSync(join(root, "app/en/marketplaces/page.tsx"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");

describe("marketplace hero hub connectors", () => {
  it("keeps connector arms for the English code scene and uses the supplied Russian artwork", () => {
    expect(marketplaces).toContain("/images/approved/03-marketplaces-hero.avif");
    expect(englishMarketplaces).toContain("marketplace-hub-line l1");
    expect(englishMarketplaces).toContain("marketplace-hub-line l2");
    expect(finalCss).toContain(".marketplace-hub-line");
    expect(finalCss).toContain("border-top: 2px dashed");
    expect(finalCss).toContain("background: none");
  });
});
