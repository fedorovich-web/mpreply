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
const publicStyleSource = readFileSync(resolve(root, "styles/public-site.css"), "utf8");
const publicCopySources = {
  home: readFileSync(resolve(root, "app/page.tsx"), "utf8"),
  features: readFileSync(resolve(root, "app/features/page.tsx"), "utf8"),
  marketplaces: readFileSync(resolve(root, "app/marketplaces/page.tsx"), "utf8"),
  pricing: readFileSync(resolve(root, "app/pricing/page.tsx"), "utf8"),
  about: readFileSync(resolve(root, "app/about/page.tsx"), "utf8"),
  demo: readFileSync(resolve(root, "app/demo/page.tsx"), "utf8"),
};

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
    expect(siteConfigSource).toContain('name: "MP Reply"');
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

  it("integrates the brand copy into the footer grid without a Materials column", () => {
    expect(footerSource).not.toContain("public-footer-topline");
    expect(footerSource).not.toContain("<strong>Материалы</strong>");
    expect(footerSource).toContain('className="public-container public-footer-grid"');
    expect(footerSource).toContain('className="public-footer-brand"');
    expect(footerSource).toContain('<Link href="/contacts">Контакты</Link>');
  });

  it("does not duplicate the brand logo inside the product-flow Canvas", () => {
    expect(canvasSource).not.toContain("<BrandLogo");
    expect(canvasSource).not.toContain('variant="canvas"');
    expect(canvasSource).not.toContain("styles.logo");
    expect(canvasSource).toContain("Сверяет товар, отзывы и правила");
  });


  it("keeps the trial backdrop attached to the full viewport", () => {
    expect(publicStyleSource).toMatch(/\.public-trial-modal\[popover\] \{[\s\S]*?inset:\s*0 !important;[\s\S]*?width:\s*100dvw !important;[\s\S]*?height:\s*100dvh !important;/);
    expect(publicStyleSource).toMatch(/\.public-trial-modal\[popover\]::backdrop \{[\s\S]*?background:\s*var\(--public-v73-modal-backdrop\) !important;/);
    expect(publicStyleSource).toMatch(/\.public-trial-modal-backdrop \{[\s\S]*?background:\s*transparent !important;/);
  });

  it("uses the brand selectively instead of repeating it in every public block", () => {
    const limits: Record<keyof typeof publicCopySources, number> = {
      home: 3,
      features: 1,
      marketplaces: 1,
      pricing: 1,
      about: 3,
      demo: 1,
    };

    for (const [page, source] of Object.entries(publicCopySources) as Array<[keyof typeof publicCopySources, string]>) {
      const mentions = source.match(/MP Reply/g)?.length ?? 0;
      expect(mentions, `${page} repeats the brand too often`).toBeLessThanOrEqual(limits[page]);
    }
  });

  it("installs the exact favicon and web-app manifest references", () => {
    expect(layoutSource).toContain('href="/favicon-96x96.png"');
    expect(layoutSource).toContain('href="/favicon.svg"');
    expect(layoutSource).toContain('href="/favicon.ico"');
    expect(layoutSource).toContain('href="/apple-touch-icon.png"');
    expect(layoutSource).toContain('content="MP Reply"');
    expect(layoutSource).toContain('href="/site.webmanifest"');
  });
});
