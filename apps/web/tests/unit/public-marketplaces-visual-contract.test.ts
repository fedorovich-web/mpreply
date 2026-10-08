import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const englishMarketplaces = readFileSync(join(root, "app/en/marketplaces/page.tsx"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const publicIcon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");

describe("approved marketplaces hero visual", () => {
  it("decodes the original Russian hero while keeping platform copy and actions live", async () => {
    const image = sharp(join(root, "public/images/approved/03-marketplaces-hero.avif"));
    expect(await image.metadata()).toMatchObject({ width: 1652, height: 952, compression: "av1" });
    await expect(image.raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
    expect(marketplaces).toContain('src="/images/approved/03-marketplaces-hero.avif"');
    expect(marketplaces).toContain("unoptimized");
    for (const name of ["Wildberries", "Ozon", "Яндекс Маркет", "Авито"]) {
      expect(marketplaces).toContain(name);
    }
    expect(marketplaces).toContain("marketplace-logo-grid");
  });

  it("keeps the English code-based connector and logo-card composition", () => {
    expect(englishMarketplaces).toContain("PublicBrandMark");
    for (const arm of ["l1", "l2", "l3", "l4"]) {
      expect(englishMarketplaces).toContain(`marketplace-hub-line ${arm}`);
      expect(finalCss).toContain(`.marketplace-hub-line.${arm}`);
    }
    expect(englishMarketplaces).toContain("marketplace-hub-logo-card");
    expect(englishMarketplaces).toContain("marketplace-hub-card-label");
  });

  it("keeps integration cards and secondary action legible", () => {
    expect(finalCss).toContain(".marketplace-logo-card li::before");
    expect(finalCss).toContain("background: var(--color-brand-soft)");
    expect(publicIcon).toContain('"play"');
    expect(marketplaces).toContain('name="play"');
  });
});
