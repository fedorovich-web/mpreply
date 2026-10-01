import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const englishFeatures = readFileSync(join(root, "app/en/features/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const heroCss = readFileSync(join(root, "styles/public-supplied-heroes.css"), "utf8");
const sidebarCss = readFileSync(join(root, "styles/public-features-sidebar-fidelity.css"), "utf8");

describe("approved features hero", () => {
  it("decodes the original AVIF and serves it beside live copy and actions", async () => {
    const image = sharp(join(root, "public/images/approved/02-features-hero.avif"));
    expect(await image.metadata()).toMatchObject({ width: 1671, height: 941, compression: "av1" });
    await expect(image.raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
    expect(features).toContain('src="/images/approved/02-features-hero.avif"');
    expect(features).toContain("unoptimized");
    expect(features).toContain("Все возможности MPReply");
    expect(features).toContain('href="/demo"');
    expect(features).toContain("features-tool-grid");
  });

  it("keeps the English code-based scene and its sidebar styles", () => {
    expect(englishFeatures).toContain("features-app-sidebar");
    expect(englishFeatures).toContain("features-app-main");
    expect(sidebarCss).toContain(".features-app-nav-item");
    expect(layout).toContain('import "../styles/public-features-sidebar-fidelity.css"');
  });

  it("sizes supplied imagery without cropping at mobile widths", () => {
    expect(layout).toContain('import "../styles/public-supplied-heroes.css"');
    expect(heroCss).toContain("width: 100%");
    expect(heroCss).toContain("height: auto");
    expect(heroCss).toContain("object-fit: contain");
  });
});
