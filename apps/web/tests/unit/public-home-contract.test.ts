import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const marketingCssPath = join(root, "styles/marketing-site.css");
const marketingCss = existsSync(marketingCssPath) ? readFileSync(marketingCssPath, "utf8") : "";
const approvedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");
const heroArtwork = join(root, "public/images/mpreply-hero-ui.webp");
const ctaArtwork = join(root, "public/images/mpreply-cta-ui.webp");

describe("public homepage redesign contract", () => {
  it("contains the approved product-story sections", () => {
    expect(page).toContain("homepage-workspace-section");
    expect(page).toContain("homepage-models-section");
    expect(page).toContain("homepage-approved-process");
    expect(page).toContain("homepage-horizontal-process");
    expect(page).toContain("homepage-results-section");
    expect(page).toContain("homepage-final-cta");
  });

  it("keeps the approved AI model strip and does not fabricate traction claims", () => {
    for (const model of ["GPT-5.6", "Claude Sonnet 5", "Gemini 3.8", "DeepSeek V4.1 Flash"]) {
      expect(page).toContain(model);
    }
    expect(page).not.toMatch(/50K\+|50к|довольных клиентов|3\+\s*(?:года|лет)|-70%|до\s*70%|14\s*дн(?:ей|я)\s*бесплатно/i);
  });

  it("keeps public marketplace readiness aligned with implemented integrations", () => {
    expect(siteConfig).not.toContain('"planned"');
    expect(siteConfig).not.toContain("Планируется");
    expect(siteConfig).toContain("Wildberries");
    expect(siteConfig).toContain("Ozon");
    expect(siteConfig).toContain("Яндекс Маркет");
    expect(siteConfig).toContain("Авито");
    expect(siteConfig).toContain("Интеграция готова");
  });

  it("uses generated WebP artwork without a competing hero wave background", () => {
    expect(existsSync(heroArtwork)).toBe(true);
    expect(existsSync(ctaArtwork)).toBe(true);
    expect(page).toContain("/images/mpreply-hero-ui.webp");
    expect(page).toContain("/images/mpreply-cta-ui.webp");
    expect(approvedCss).not.toContain("mpreply-hero-waves.webp");
    expect(approvedCss).toContain("mpreply-cta-waves.webp");
  });

  it("uses the approved blue system and spacious section rhythm", () => {
    expect(marketingCss).toContain(".public-root");
    expect(marketingCss).toContain("--color-brand-primary: #2563eb");
    expect(marketingCss).toContain("--color-brand-accent: #0ea5e9");
    expect(approvedCss).toContain("--homepage-section-pad");
    expect(approvedCss).toContain(".homepage-horizontal-process");
  });
});
