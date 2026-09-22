import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const notFound = readFileSync(join(root, "app/not-found.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/public-contact-404-render.css"), "utf8");
const asset = readFileSync(join(root, "public/images/mpreply-404-illustration.webp"));

describe("404 illustration integration contract", () => {
  it("uses the dedicated optimized 404 illustration", () => {
    expect(notFound).toContain('src="/images/mpreply-404-illustration.webp"');
    expect(notFound).toContain('className="not-found-render-asset"');
  });

  it("keeps a complete WebP asset instead of a truncated binary", () => {
    expect(asset.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(asset.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(asset.byteLength).toBeGreaterThan(40_000);
  });

  it("does not compose the old mascot scene in HTML/CSS", () => {
    expect(notFound).not.toContain("mpreply-mascot.webp");
    expect(notFound).not.toContain("not-found-render-signs");
    expect(notFound).not.toContain("not-found-render-cloud");
  });

  it("keeps graphical 404 only inside the illustration", () => {
    expect(notFound).not.toContain("not-found-render-code");
    expect(notFound).not.toContain(">404</");
    expect(styles).not.toContain(".not-found-render-code");
  });

  it("keeps page copy and actions as real HTML", () => {
    expect(notFound).toContain("<h1>Страница не найдена</h1>");
    expect(notFound).toContain('href="/"');
    expect(notFound).toContain('href="/contacts"');
  });

  it("styles the single asset instead of the old scene fragments", () => {
    expect(styles).toContain(".not-found-render-asset");
  });
});
