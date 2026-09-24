import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const cssPath = join(root, "styles/public-approved-raster-icons.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

const journeyAssets = [
  "/images/mockups/demo-icons/01-receive-chat.webp",
  "/images/mockups/demo-icons/02-context-document.webp",
  "/images/mockups/demo-icons/03-ai-sparkles.webp",
  "/images/mockups/demo-icons/04-review-send.webp",
] as const;

describe("approved demo raster icon fidelity", () => {
  it("uses approved raster icons on all four journey cards", () => {
    expect(demo).toContain("demo-journey-card");
    for (const asset of journeyAssets) expect(css).toContain(`url("${asset}")`);
    expect(css).toContain(".demo-journey .demo-journey-card .mockup-icon-chip > .public-icon-image");
    expect(css).toContain("display: none");
  });

  it("uses the approved unified-queue raster only on the first team tool", () => {
    expect(demo).toContain("demo-team-tool");
    expect(css).toContain('url("/images/mockups/demo-icons/05-unified-queue-team.webp")');
    expect(css).toContain(".demo-team-tools .demo-team-tool:nth-child(1) .mockup-icon-chip");
    expect(css).not.toContain(".demo-team-tools .demo-team-tool:nth-child(2) .mockup-icon-chip");
    expect(css).not.toContain(".demo-team-tools .demo-team-tool:nth-child(3) .mockup-icon-chip");
    expect(css).not.toContain(".demo-team-tools .demo-team-tool:nth-child(4) .mockup-icon-chip");
  });
});
