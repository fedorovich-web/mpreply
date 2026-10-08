import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const landing = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const hero = readFileSync(join(root, "styles/public-detail-hero-fidelity.css"), "utf8");
const render = readFileSync(join(root, "styles/public-mockup-render-tuning.css"), "utf8");

describe("marketplace detail live stylesheet contract", () => {
  it("uses the current mockup renderer instead of the removed pre-redesign scene stylesheet", () => {
    expect(layout).not.toContain('marketplace-detail-approved.css');
    expect(landing).toContain("marketplace-detail-mockup-hero");
    expect(landing).toContain("marketplace-detail-render");
    expect(render).toContain(".mockup-page .marketplace-detail-mockup-hero");
    expect(render).toContain(".mockup-page .detail-market-card");
    expect(render).toContain(".mockup-page .detail-app-window");
    expect(render).toContain(".mockup-page .detail-ai-card");
  });

  it("keeps the approved Wildberries product crop isolated from Ozon and Yandex", () => {
    expect(landing).toContain("useApprovedProductCrop");
    expect(landing).toContain("is-${marketplace.key}");
    expect(hero).toContain(".detail-product-thumb.is-product.is-wildberries");
    expect(hero).toContain('url("/images/mockups/product-shoe.webp")');
    expect(hero).toContain(".detail-product-thumb.is-product:not(.is-wildberries)");
  });

  it("keeps production raster references on WebP", () => {
    expect(hero).toContain(".webp");
    expect(hero).not.toMatch(/\.(png|jpe?g)[\"')]/i);
  });
});
