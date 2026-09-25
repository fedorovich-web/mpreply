import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");

const approvedRasterAssets = [
  "features-icons/01-unified-inbox.webp",
  "features-icons/02-ai-sparkles.webp",
  "features-icons/03-quality-shield.webp",
  "features-icons/04-auto-replies-lightning.webp",
  "features-icons/05-assignment-workflow.webp",
  "wildberries-icons/01-history-actions.webp",
  "wildberries-icons/02-more-speed.webp",
  "wildberries-icons/03-team-transparency.webp",
  "wildberries-icons/04-draft-review.webp",
  "wildberries-icons/05-analytics.webp",
  "demo-icons/01-receive-chat.webp",
  "demo-icons/02-context-document.webp",
  "demo-icons/03-ai-sparkles.webp",
  "demo-icons/04-review-send.webp",
  "demo-icons/05-unified-queue-team.webp",
] as const;

describe("approved public raster asset integrity", () => {
  it("keeps every CSS-backed approved raster asset present in public and referenced by the fidelity layer", () => {
    for (const asset of approvedRasterAssets) {
      const publicPath = `/images/mockups/${asset}`;
      expect(css).toContain(`url(\"${publicPath}\")`);
      expect(existsSync(join(root, "public", publicPath))).toBe(true);
    }
  });

  it("keeps the approved raster set intentionally limited to the 15 handoff assets", () => {
    expect(approvedRasterAssets).toHaveLength(15);
    expect(css.match(/background-image:\s*url\(/g) ?? []).toHaveLength(15);
  });

  it("scopes every raster mapping to approved mockup pages so dashboard and homepage icon chips cannot inherit it", () => {
    const rasterBlocks = css.match(/[^{}]+\{[^{}]*background-image:\s*url\([^{}]*\}/g) ?? [];
    expect(rasterBlocks).toHaveLength(15);
    for (const block of rasterBlocks) expect(block.trim()).toMatch(/^\.mockup-page/);
    expect(css).not.toMatch(/^\.mockup-icon-chip\b/m);
  });
});
