import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const englishPage = readFileSync(join(root, "app/en/page.tsx"), "utf8");
const heroScene = readFileSync(join(root, "components/public-site/HomeHeroScene.tsx"), "utf8");
const approvedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");
const heroAssetPath = join(root, "public/images/mpreply-hero.webp");

describe("approved RU/EN homepage contract", () => {
  it("keeps the approved homepage composition in both locale routes", () => {
    for (const source of [page, englishPage]) {
      expect(source).toContain("homepage-workspace-section");
      expect(source).toContain("homepage-models-section");
      expect(source).toContain("homepage-approved-process");
      expect(source).toContain("homepage-horizontal-process");
      expect(source).toContain("homepage-results-section");
      expect(source).toContain("homepage-approved-final-cta");
    }
  });

  it("keeps the approved optimized hero artwork", () => {
    expect(existsSync(heroAssetPath)).toBe(true);
    expect(heroScene).toContain('src="/images/mpreply-hero.webp"');
    expect(heroScene).toContain("quality={85}");
    expect(heroScene).not.toContain("unoptimized");
  });

  it("keeps Russian and English marketing copy on separate routes", () => {
    expect(page).toContain("ИИ для продавцов на маркетплейсах");
    expect(page).not.toContain('locale: "en"');
    expect(englishPage).toContain("AI for marketplace seller teams");
    expect(englishPage).toContain('<HomeApprovedShell locale="en">');
    expect(englishPage).not.toMatch(/[А-Яа-яЁё]/);
  });

  it("keeps homepage marketing grounded in verified product mechanics", () => {
    for (const source of [page, englishPage]) {
      for (const unsupported of [
        "GPT-5.6",
        "Claude Sonnet 5",
        "Gemini 3.8",
        "DeepSeek V4.1 Flash",
        "до 70%",
        "No card required",
        "Quick setup",
      ]) {
        expect(source).not.toContain(unsupported);
      }
      expect(source).toContain('"wildberries", "ozon", "yandex-market", "avito"');
      expect(source).toContain("quality={85}");
    }
    expect(page).toContain("Контекст обращения");
    expect(page).toContain("14 дней бесплатно");
    expect(englishPage).toContain("Message context");
    expect(englishPage).toContain("14-day trial");
  });

  it("keeps final homepage geometry in the approved stylesheet", () => {
    expect(approvedCss).toContain("--container-max-width: 1240px");
    expect(approvedCss).toContain(".homepage-horizontal-process");
    expect(approvedCss).toContain(".homepage-hero-scene");
    expect(approvedCss).toContain(".homepage-hero-image");
    expect(approvedCss).toContain(".homepage-cta-scene");
    expect(approvedCss).toContain("@media (max-width: 720px)");
  });
});
