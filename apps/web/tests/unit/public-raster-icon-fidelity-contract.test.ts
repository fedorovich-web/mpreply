import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const cssPath = join(root, "styles/public-approved-raster-icons.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

const featureAssets = [
  "/images/mockups/features-icons/01-unified-inbox.webp",
  "/images/mockups/features-icons/02-ai-sparkles.webp",
  "/images/mockups/features-icons/03-quality-shield.webp",
  "/images/mockups/features-icons/04-auto-replies-lightning.webp",
  "/images/mockups/features-icons/05-templates-document.webp",
] as const;

describe("approved selective raster icon fidelity", () => {
  it("loads the dedicated raster icon fidelity layer after the mockup CSS stack", () => {
    expect(existsSync(cssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-approved-raster-icons.css"');
  });

  it("uses the five approved feature icon assets only on the first five tool cards", () => {
    expect(features).toContain("features-tool-grid");
    for (const asset of featureAssets) expect(css).toContain(`url("${asset}")`);
    expect(css).toContain(".features-tool-card:nth-child(-n+5) .mockup-icon-chip > svg");
    expect(css).toContain("display: none");
    expect(css).not.toContain(".features-tool-card:nth-child(6)");
    expect(css).not.toContain(".features-tool-card:nth-child(7)");
    expect(css).not.toContain(".features-tool-card:nth-child(8)");
  });

  it("fits raster artwork to the 44px render-tuned icon chip without cropping", () => {
    expect(css.match(/background-size: 44px 44px/g) ?? []).toHaveLength(3);
    expect(css).not.toContain("background-size: 54px 54px");
  });
});
