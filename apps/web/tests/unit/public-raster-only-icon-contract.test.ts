import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const icon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");
const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

describe("public image format policy", () => {
  it("keeps runtime raster assets in public free of PNG and JPEG files", () => {
    const publicFiles = listFiles(join(root, "public"));
    const forbiddenRasterFiles = publicFiles.filter((file) => /\.(?:png|jpe?g)$/i.test(file));
    expect(forbiddenRasterFiles).toEqual([]);
  });

  it("locks Next image optimization to WebP at quality 85", () => {
    expect(nextConfig).toContain('formats: ["image/webp"]');
    expect(nextConfig).toContain("qualities: [85]");
  });

  it("renders public UI icons from WebP assets only", () => {
    expect(icon).toContain("iconSources");
    expect(icon).toContain("public-icon-image");
    expect(icon).toContain("backgroundImage");
    expect(icon).not.toContain("<svg");
    expect(icon).not.toContain("SVGProps");
    expect(icon.match(/\.webp"/g)?.length ?? 0).toBeGreaterThanOrEqual(20);
  });

  it("keeps render-specific approved icon overrides raster-only", () => {
    expect(css).toContain("> .public-icon-image");
    expect(css).not.toContain("> svg");
    expect(css).toContain("background-size: 44px 44px");
  });
});
