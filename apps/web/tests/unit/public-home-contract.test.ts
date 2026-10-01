import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const englishPage = readFileSync(join(root, "app/en/page.tsx"), "utf8");
const approvedCss = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");
const restoreCss = readFileSync(join(root, "styles/homepage-reference-restore.css"), "utf8");
const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");

describe("approved RU/EN homepage contract", () => {
  it("keeps the approved homepage composition in both locale routes", () => {
    for (const source of [page, englishPage]) {
      for (const section of ["homepage-workspace-section", "homepage-models-section", "homepage-approved-process", "homepage-horizontal-process", "homepage-results-section", "homepage-approved-final-cta"]) expect(source).toContain(section);
      expect(source).toContain("HomeWorkspaceTabs");
    }
  });
  it("serves fully decodable original AVIF hero and CTA art without another lossy encode", async () => {
    for (const [asset, width, height] of [["01-home-hero.avif", 1481, 1062], ["04-marketplaces-cta.avif", 1448, 1086]] as const) {
      for (const source of [page, englishPage]) {
        expect(source).toContain('src="/images/approved/' + asset + '"');
        expect(source).toContain("width={" + width + "}");
        expect(source).toContain("height={" + height + "}");
        expect(source).toContain("unoptimized");
      }
      const image = sharp(join(root, "public/images/approved", asset));
      expect(await image.metadata()).toMatchObject({ width, height, compression: "av1", hasAlpha: true });
      await expect(image.raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
    }
  });
  it("keeps Russian and English live copy and shared shells on separate routes", () => {
    expect(page).toContain("Автоответы");
    expect(page).toContain("<PublicShell home>");
    expect(page).not.toContain('locale: "en"');
    expect(englishPage).toContain("AI-assisted replies");
    expect(englishPage).toContain('<PublicShell home locale="en">');
    expect(englishPage).not.toMatch(/[А-Яа-яЁё]/);
  });
  it("keeps supported platform coverage, current trial and review path visible", () => {
    for (const source of [page, englishPage]) {
      expect(source).toContain('"wildberries", "ozon", "yandex-market", "avito"');
      expect(source).toContain("350");
      expect(source).not.toMatch(/до 70%|GPT-5\.6|OpenRouter/);
    }
    expect(page).toContain("автоматически или после проверки");
    expect(page).toContain("14 дней бесплатно");
    expect(englishPage).toContain("review before sending");
    expect(englishPage).toContain("14-day trial");
  });
  it("keeps shared 1240px containers and responsive approved hero/CTA geometry", () => {
    expect(tokens).toContain("--container-max-width: 1240px");
    expect(approvedCss).toContain(".homepage-horizontal-process");
    for (const selector of [".home-reference-hero-art", ".home-reference-hero-art img", ".home-reference-cta-art", ".home-reference-cta-art img"]) expect(restoreCss).toContain(selector);
    expect(restoreCss).not.toContain(".home-reference-socials");
    expect(approvedCss).not.toContain(".homepage-hero-scene");
    expect(approvedCss).not.toContain(".homepage-cta-scene");
    expect(approvedCss).toContain("@media (max-width: 760px)");
  });
});
