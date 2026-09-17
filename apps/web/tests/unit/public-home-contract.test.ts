import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const heroScene = readFileSync(join(root, "components/public-site/HomeHeroScene.tsx"), "utf8");
const homeWorkspace = readFileSync(join(root, "components/public-site/HomeWorkspaceTabs.tsx"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const heroAssetPath = join(root, "public/images/mpreply-hero.webp");
const heroArtworkCssPath = join(root, "styles/homepage-hero-artwork.css");
const fidelityCssPath = join(root, "styles/homepage-fidelity.css");
const globalsCss = readFileSync(join(root, "styles/globals.css"), "utf8");
const marketingCss = readFileSync(join(root, "styles/marketing-site.css"), "utf8");
const marketingPagesCss = readFileSync(join(root, "styles/marketing-pages.css"), "utf8");
const publicSiteCss = readFileSync(join(root, "styles/public-site.css"), "utf8");
const approvedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");

describe("public homepage redesign contract", () => {
  it("contains the approved product-story sections", () => {
    expect(page).toContain("homepage-workspace-section");
    expect(page).toContain("homepage-models-section");
    expect(page).toContain("homepage-approved-process");
    expect(page).toContain("homepage-horizontal-process");
    expect(page).toContain("homepage-results-section");
    expect(page).toContain("homepage-approved-final-cta");
  });

  it("keeps the approved AI-section message without exposing unverified provider names", () => {
    expect(page).toContain("Используем лучшие нейросети");
    expect(page).toContain("для точных и естественных ответов");
    for (const capability of ["Контекст товара", "Стиль бренда", "Правила команды", "Контроль перед отправкой"]) {
      expect(page).toContain(capability);
    }
    expect(page).not.toMatch(/GPT-5\.6|Claude Sonnet 5|Gemini 3\.8|DeepSeek V4\.1 Flash|OpenAI|Anthropic/i);
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

  it("uses the approved optimized hero artwork while keeping the CTA scene semantic", () => {
    expect(page).toContain("<HomeHeroScene />");
    expect(existsSync(heroAssetPath)).toBe(true);
    expect(heroScene).toContain('import Image from "next/image"');
    expect(heroScene).toContain('src="/images/mpreply-hero.webp"');
    expect(heroScene).toContain("width={1448}");
    expect(heroScene).toContain("height={1086}");
    expect(heroScene).toContain("priority");
    expect(heroScene).toContain("quality={85}");
    expect(heroScene).toContain('sizes="(max-width: 480px) 118vw, (max-width: 720px) 112vw, (max-width: 1080px) 108vw, 58vw"');
    expect(heroScene).not.toContain("unoptimized");
    expect(heroScene).not.toContain("homepage-hero-window");
    expect(heroScene).not.toContain("homepage-hero-ai-card");
    expect(page).toContain("homepage-cta-scene");
  });

  it("keeps homepage selectors owned by the homepage stylesheet only", () => {
    for (const source of [globalsCss, marketingPagesCss, marketingCss, publicSiteCss]) {
      expect(source).not.toContain(".homepage-");
    }

    const legacyHeroSelectors = [
      "homepage-hero-window",
      "homepage-hero-ai-card",
      "homepage-hero-product",
      "homepage-hero-product-body",
      "homepage-hero-sidebar",
      "homepage-hero-feed",
      "homepage-hero-draft",
    ];
    for (const selector of legacyHeroSelectors) {
      for (const source of [approvedCss, globalsCss, marketingCss, marketingPagesCss, publicSiteCss]) {
        expect(source).not.toContain(selector);
      }
    }
  });

  it("does not keep obsolete class hooks from the superseded homepage markup", () => {
    expect(page).not.toContain('className="homepage-hero homepage-approved-hero"');
    expect(page).not.toContain("homepage-context-section");
    expect(page).not.toContain("homepage-process homepage-approved-process");
    expect(page).not.toContain("homepage-final-cta homepage-approved-final-cta");
    expect(page).not.toContain("homepage-section-heading homepage-section-heading-left");
    expect(homeWorkspace).not.toContain('className="homepage-workspace homepage-approved-workspace"');
  });

  it("keeps footer navigation attached to real routes without legacy footer markup or CSS", () => {
    expect(publicShell).toContain('href="/features"');
    expect(publicShell).toContain('href="/marketplaces"');
    expect(publicShell).not.toContain('href="/#safetygate"');
    expect(publicShell).not.toContain("public-footer-grid");
    expect(publicShell).not.toContain("public-footer-topline");
    expect(publicShell).not.toContain("public-footer-support");
    expect(publicSiteCss).not.toContain(".public-footer-grid");
    expect(publicSiteCss).not.toContain(".public-footer-topline");
  });

  it("uses supported as the only public marketplace readiness status style", () => {
    expect(publicSiteCss).toContain(".public-status-supported");
    expect(marketingPagesCss).not.toContain(".public-status-supported");
    for (const legacySelector of [".public-status-mvp", ".marketplace-readiness-row-mvp", ".integration-status-panel-mvp"]) {
      expect(publicSiteCss).not.toContain(legacySelector);
      expect(marketingPagesCss).not.toContain(legacySelector);
    }
  });

  it("keeps final homepage geometry in the approved layer without override stylesheets", () => {
    expect(existsSync(fidelityCssPath)).toBe(false);
    expect(existsSync(heroArtworkCssPath)).toBe(false);
    expect(layout).not.toContain('import "../styles/homepage-fidelity.css"');
    expect(layout).not.toContain('import "../styles/homepage-hero-artwork.css"');
    expect(approvedCss).toContain("--container-max-width: 1240px");
    expect(approvedCss).toContain("grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr)");
    expect(approvedCss).toContain("transform: scale(1.065)");
    expect(approvedCss).toContain("grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr)");
    expect(approvedCss).toContain("grid-template-columns: minmax(0, 1.18fr) minmax(24rem, 0.82fr)");
  });

  it("uses the authoritative violet public shell with hero artwork owned by the approved stylesheet", () => {
    expect(marketingCss).toContain(".public-root");
    expect(marketingCss).toContain("--color-brand-primary: #5148e8");
    expect(marketingCss).toContain("--color-brand-primary-hover: #443bcf");
    expect(marketingCss).toContain("--color-brand-accent: #5148e8");
    expect(marketingCss).toContain(
      "--gradient-public-blue: linear-gradient(110deg, #5148e8 0%, #635bff 58%, #5964ff 100%)",
    );
    expect(marketingCss).not.toContain("--color-brand-primary: #2563eb");
    expect(marketingCss).not.toContain("--color-brand-accent: #0ea5e9");
    expect(approvedCss).toContain("--homepage-section-pad");
    expect(approvedCss).toContain(".homepage-horizontal-process");
    expect(approvedCss).toContain(".homepage-hero-scene");
    expect(approvedCss).toContain(".homepage-hero-image");
    expect(approvedCss).toContain(".homepage-cta-scene");
    expect(approvedCss).toContain("@media (max-width: 720px)");
  });
});
