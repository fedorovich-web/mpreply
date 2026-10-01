import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const icon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");
const assets = [...icon.matchAll(/"(\/images\/icons\/final\/[^"\s]+\.avif)"/g)].map((match) => match[1]);

describe("supplied public raster asset integrity", () => {
  it("decodes every mapped AVIF icon with transparent square intrinsic dimensions", async () => {
    expect(assets).toHaveLength(18);
    expect(new Set(assets).size).toBe(18);
    for (const asset of assets) {
      const image = sharp(join(root, "public", asset.slice(1)));
      const metadata = await image.metadata();
      expect(metadata.compression, asset).toBe("av1");
      expect(metadata.hasAlpha, asset).toBe(true);
      expect(metadata.width, asset).toBe(metadata.height);
      expect(metadata.width, asset).toBeGreaterThanOrEqual(128);
      await expect(image.raw().toBuffer(), asset).resolves.toBeInstanceOf(Buffer);
    }
  });
  it("owns artwork in PublicIcon instead of positional CSS image substitutions", () => {
    expect(icon).toContain("backgroundImage:");
    expect(icon).toContain("iconSources[name]");
    expect(css).not.toContain("background-image:");
    expect(css).not.toMatch(/nth-child\(|\/images\/mockups\//);
  });
  it("keeps artwork contained and scopes larger card geometry to public mockup pages", () => {
    expect(css).toContain("background-size: contain");
    const blocks = css.match(/[^{}]+\{[^{}]*(?:width: (?:40|44|50)px)[^{}]*\}/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const selectors = block.slice(0, block.indexOf("{"));
      for (const selector of selectors.split(",")) expect(selector.trim()).toMatch(/^\.mockup-page\b/);
    }
  });
});
