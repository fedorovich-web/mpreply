import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const cssPath = join(root, "styles/public-approved-raster-icons.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

const assets = [
  "/images/mockups/wildberries-icons/01-history-actions.webp",
  "/images/mockups/wildberries-icons/02-more-speed.webp",
  "/images/mockups/wildberries-icons/03-team-transparency.webp",
  "/images/mockups/wildberries-icons/04-templates.webp",
  "/images/mockups/wildberries-icons/05-analytics.webp",
] as const;

describe("approved Wildberries raster icon fidelity", () => {
  it("keeps the shared marketplace landing component and scopes raster overrides to Wildberries", () => {
    expect(detail).toContain("marketplace-detail-logo");
    expect(css).toContain(':has(.marketplace-detail-logo[src$="/wildberries.webp"])');
    for (const asset of assets) expect(css).toContain(`url("${asset}")`);
  });

  it("replaces only history plus the four daily-benefit icons", () => {
    expect(css).toContain(".marketplace-detail-tools .detail-tool-card:nth-child(4) .mockup-icon-chip");
    expect(css).toContain(".marketplace-detail-benefits .detail-benefit-card .mockup-icon-chip");
    expect(css).toContain(".marketplace-detail-tools .detail-tool-card:nth-child(4) .mockup-icon-chip > svg");
    expect(css).toContain(".marketplace-detail-benefits .detail-benefit-card .mockup-icon-chip > svg");
    expect(css).not.toContain(".marketplace-detail-tools .detail-tool-card:nth-child(1) .mockup-icon-chip");
    expect(css).not.toContain(".marketplace-detail-tools .detail-tool-card:nth-child(2) .mockup-icon-chip");
    expect(css).not.toContain(".marketplace-detail-tools .detail-tool-card:nth-child(3) .mockup-icon-chip");
  });
});
