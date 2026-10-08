import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const notFound = readFileSync(join(root, "app/not-found.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/public-contact-404-render.css"), "utf8");

describe("404 original illustration integration", () => {
  it("uses the two supplied transparent illustration parts", () => {
    expect(notFound).toContain('src="/images/approved/03-404-robot.avif"');
    expect(notFound).toContain('src="/images/approved/03-404-number.avif"');
    expect(notFound).toContain("not-found-render-robot");
    expect(notFound).toContain("not-found-render-number");
    expect(notFound).toContain("unoptimized");
  });
  it("fully decodes the original robot and number at their intrinsic dimensions", async () => {
    for (const [asset, width] of [["03-404-robot.avif", 1000], ["03-404-number.avif", 872]] as const) {
      const image = sharp(join(root, "public/images/approved", asset));
      expect(await image.metadata()).toMatchObject({ width, height: 941, compression: "av1", hasAlpha: true });
      await expect(image.raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
    }
  });
  it("does not compose mascot substitutes or duplicate the graphical number in text", () => {
    for (const retired of ["mpreply-mascot.webp", "not-found-render-signs", "not-found-render-cloud", "not-found-render-code", ">404</"]) expect(notFound).not.toContain(retired);
  });
  it("keeps localized page copy and recovery actions as real HTML", () => {
    expect(notFound).toContain('<h1>{t.title}</h1>');
    expect(notFound).toContain('title: "Страница не найдена"');
    expect(notFound).toContain('title: "Page not found"');
    expect(notFound).toContain('href={path("/")}');
    expect(notFound).toContain('href={path("/contacts")}');
    expect(notFound).toContain("<PublicShell locale={locale}>");
  });
  it("contains illustration sizing and intentionally stacks copy before art on mobile", () => {
    expect(styles).toContain(".not-found-render-asset");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toMatch(/\.not-found-render-copy\s*\{[^}]*order:\s*1/s);
    expect(styles).toMatch(/\.not-found-render-scene\s*\{[^}]*order:\s*2/s);
  });
});
