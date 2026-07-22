import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layoutSource = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
const siteConfigSource = readFileSync(resolve(root, "lib/site-config.ts"), "utf8");
const brandLogoSource = readFileSync(
  resolve(root, "components/public-site/BrandLogo.tsx"),
  "utf8",
);
const headerSource = readFileSync(
  resolve(root, "components/public-site/PublicHeader.tsx"),
  "utf8",
);
const footerSource = readFileSync(
  resolve(root, "components/public-site/PublicShell.tsx"),
  "utf8",
);
const canvasSource = readFileSync(
  resolve(root, "components/public-site/HeroProductFlowCanvas.tsx"),
  "utf8",
);

const requiredAssets = [
  "public/favicon-96x96.png",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "public/web-app-manifest-192x192.png",
  "public/web-app-manifest-512x512.png",
  "public/site.webmanifest",
  "public/logo/logo.avif",
  "public/logo/logo.webp",
  "public/logo/logo-canvas.avif",
  "public/logo/logo-canvas.webp",
];

describe("MPReply production rebrand contract", () => {
  it("uses the new brand and canonical production domain", () => {
    expect(siteConfigSource).toContain('name: "MPReply"');
    expect(siteConfigSource).toContain('"https://mpreply.ru"');
    const legacyBrand = ["Res", "pio"].join("");
    const legacyDomain = ["res", "pio", ".ru"].join("");
    expect(siteConfigSource).not.toContain(legacyBrand);
    expect(siteConfigSource).not.toContain(legacyDomain);
  });

  it("ships every supplied favicon and logo asset", () => {
    for (const relativePath of requiredAssets) {
      expect(existsSync(resolve(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("uses AVIF first with WebP fallback for horizontal and canvas logos", () => {
    expect(brandLogoSource).toContain('avif: "/logo/logo.avif"');
    expect(brandLogoSource).toContain('webp: "/logo/logo.webp"');
    expect(brandLogoSource).toContain('avif: "/logo/logo-canvas.avif"');
    expect(brandLogoSource).toContain('webp: "/logo/logo-canvas.webp"');
    expect(brandLogoSource).toContain('<source srcSet={asset.avif} type="image/avif" />');
    expect(brandLogoSource).toContain('src={asset.webp}');
  });

  it("uses the supplied horizontal logo in header and footer", () => {
    expect(headerSource).toContain("<BrandLogo");
    expect(headerSource).toContain('className="public-brand-logo"');
    expect(footerSource).toContain('className="public-footer-brand-logo"');
    expect(headerSource).not.toContain(">R<");
    expect(footerSource).not.toContain(">R<");
  });

  it("uses the supplied canvas logo without a duplicated Engine label", () => {
    expect(canvasSource).toContain('variant="canvas"');
    expect(canvasSource).toContain('alt="MPReply"');
    expect(canvasSource).not.toContain("MPReply Engine");
    expect(canvasSource).not.toContain(">R<");
  });

  it("installs the exact favicon and web-app manifest references", () => {
    expect(layoutSource).toContain('href="/favicon-96x96.png"');
    expect(layoutSource).toContain('href="/favicon.svg"');
    expect(layoutSource).toContain('href="/favicon.ico"');
    expect(layoutSource).toContain('href="/apple-touch-icon.png"');
    expect(layoutSource).toContain('content="MPReply"');
    expect(layoutSource).toContain('href="/site.webmanifest"');
  });
});
