import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");

const approvedAssets = [
  "01-unified-inbox.webp",
  "02-ai-sparkles.webp",
  "03-quality-shield.webp",
  "04-auto-replies-lightning.webp",
  "05-templates-document.webp",
] as const;

describe("approved features card raster icons", () => {
  it("uses only the five approved render-derived assets for the matching capability cards", () => {
    for (const asset of approvedAssets) {
      expect(features).toContain(`/images/mockups/features-icons/${asset}`);
      expect(existsSync(join(root, "public/images/mockups/features-icons", asset))).toBe(true);
    }
  });

  it("keeps the remaining feature cards code-driven instead of rasterizing all UI icons", () => {
    expect(features).toContain('icon: "chart"');
    expect(features).toContain('icon: "users"');
    expect(features).toContain('icon: "clock"');
    expect(features).toContain("<PublicIcon name={tool.icon} />");
  });
});
