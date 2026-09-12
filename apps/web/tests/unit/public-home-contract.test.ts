import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const heroScene = readFileSync(join(root, "components/public-site/HomeHeroScene.tsx"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const heroAssetPath = join(root, "public/images/mpreply-hero.webp");
const heroArtworkCssPath = join(root, "styles/homepage-hero-artwork.css");
const heroArtworkCss = existsSync(heroArtworkCssPath) ? readFileSync(heroArtworkCssPath, "utf8") : "";
const marketingCssPath = join(root, "styles/marketing-site.css");
const marketingCss = existsSync(marketingCssPath) ? readFileSync(marketingCssPath, "utf8") : "";
const approvedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");

describe("public homepage redesign contract", () => {
  it("contains the approved product-story sections", () => {
    expect(page).toContain("homepage-workspace-section");
    expect(page).toContain("homepage-context-section");
    expect(page).toContain("homepage-approved-process");
    expect(page).toContain("homepage-horizontal-process");
    expect(page).toContain("homepage-results-section");
    expect(page).toContain("homepage-final-cta");
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
    expect(heroScene).toContain("sizes=");
    expect(heroScene).not.toContain("unoptimized");
    expect(heroScene).not.toContain("homepage-hero-window");
    expect(heroScene).not.toContain("homepage-hero-ai-card");
    expect(page).toContain("homepage-cta-scene");
  });

  it("keeps footer navigation attached to the current homepage process section", () => {
    expect(publicShell).toContain('href="/features"');
    expect(publicShell).toContain('href="/marketplaces"');
    expect(publicShell).not.toContain('href="/#safetygate"');
  });

  it("uses the approved blue system and a scoped hero artwork layer", () => {
    expect(marketingCss).toContain(".public-root");
    expect(marketingCss).toContain("--color-brand-primary: #2563eb");
    expect(marketingCss).toContain("--color-brand-accent: #0ea5e9");
    expect(approvedCss).toContain("--homepage-section-pad");
    expect(approvedCss).toContain(".homepage-horizontal-process");
    expect(approvedCss).toContain(".homepage-hero-scene");
    expect(approvedCss).toContain(".homepage-cta-scene");
    expect(layout).toContain('import "../styles/homepage-hero-artwork.css"');
    expect(heroArtworkCss).toContain(".homepage-hero-image");
    expect(heroArtworkCss).toContain("@media (max-width: 720px)");
    expect(heroArtworkCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});