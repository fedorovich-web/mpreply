import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  it("reserves PNG for the supplied browser icons and forbids JPEG page assets", () => {
    const publicFiles = listFiles(join(root, "public"));
    const forbiddenRasterFiles = publicFiles.filter((file) => /\.(?:png|jpe?g)$/i.test(file));
    const browserIconPaths = ["apple-touch-icon.png", "favicon-96x96.png", "web-app-manifest-192x192.png", "web-app-manifest-512x512.png"]
      .map((file) => join(root, "public", file));
    expect(forbiddenRasterFiles.sort()).toEqual(browserIconPaths.sort());
  });

  it("locks Next image optimization to WebP at quality 85", () => {
    expect(nextConfig).toContain('formats: ["image/webp"]');
    expect(nextConfig).toContain("qualities: [85]");
  });

  it("uses the supplied AVIF icons and the corrected vector play control", () => {
    expect(icon).toContain("iconSources");
    expect(icon).toContain("public-icon-image");
    expect(icon).toContain("backgroundImage");
    expect(icon).toContain('if (name === "play")');
    expect(icon).toContain('<circle cx="12" cy="12" r="9" />');
    expect(icon).not.toContain("SVGProps");
    const sources = [...icon.matchAll(/"(\/images\/icons\/final\/[^"\s]+\.avif)"/g)]
      .map((match) => match[1]);
    expect(sources).toHaveLength(18);
    for (const source of sources) {
      expect(existsSync(join(root, "public", source.slice(1))), `${source} must exist`).toBe(true);
    }
  });

  it("keeps every WebP asset structurally intact", () => {
    const webpFiles = listFiles(join(root, "public")).filter((file) => file.endsWith(".webp"));
    expect(webpFiles.length).toBeGreaterThan(0);
    const invalid = webpFiles.filter((file) => {
      const bytes = readFileSync(file);
      return bytes.length < 12
        || bytes.toString("ascii", 0, 4) !== "RIFF"
        || bytes.toString("ascii", 8, 12) !== "WEBP"
        || bytes.readUInt32LE(4) + 8 !== bytes.length;
    });
    expect(invalid.map((file) => file.slice(root.length + 1))).toEqual([]);
  });

  it("fits supplied icon art without cropping and scales the play vector to its control", () => {
    expect(css).toContain("> .public-icon-image");
    expect(css).toContain(".public-icon-image > svg");
    expect(css).toContain("background-size: contain");
    expect(css).toContain("width: 44px");
  });
});
