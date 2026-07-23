import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
const publicStyleSource = readFileSync(resolve(process.cwd(), "styles/public-site.css"), "utf8");
const heroSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.tsx"),
  "utf8",
);
const heroStyleSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.module.css"),
  "utf8",
);

describe("MPReply public visual recovery contract", () => {
  it("preserves the approved marketplace Hero copy and CTAs without the old proof pills", () => {
    expect(pageSource).toContain("ИИ для маркетплейсов");
    expect(pageSource).toContain("Автоответы для");
    expect(pageSource).toContain("отзывов, вопросов");
    expect(pageSource).toContain("и чатов");
    expect(pageSource).toContain("MP Reply анализирует обращение покупателя");
    expect(pageSource).toContain("Начать бесплатный тест");
    expect(pageSource).toContain("Посмотреть процесс");
    expect(pageSource).not.toContain("Интеграция за дни, не месяцы");
  });

  it("forces the intended compact H1 title lines to avoid long inline headings", () => {
    expect(pageSource.match(/home-hero-title-line/g)).toHaveLength(3);
    expect(publicStyleSource).toMatch(/\.home-hero-title-line\s*\{[^}]*display:\s*block;/s);
    expect(publicStyleSource).toMatch(/\.home-hero-title-line\s*\{[^}]*white-space:\s*normal !important;/s);
  });

  it("uses product-native Hero content instead of cosmic or generic AI metaphors", () => {
    expect(heroSource).toContain("На широкую стопу подойдёт?");
    expect(heroSource).toContain("Кроссовки для ходьбы");
    expect(heroSource).toContain("Ответ проверен по данным");
    expect(heroSource).toContain("Лучше взять 41 размер.");
    expect(`${heroSource}\n${heroStyleSource}`).not.toMatch(/orbit|planet|sphere|cosmic|galaxy|starfield/i);
  });



  it("does not approve the broken 1440px single-column Hero fold", () => {
    expect(publicStyleSource).toContain("MPReply 0.1.85 · Hero visual baseline recovery");
    expect(publicStyleSource).toContain("@media (max-width: 1120px)");
    expect(publicStyleSource).toMatch(/@media \(max-width: 1120px\) \{[\s\S]*?\.home-hero-layout \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
    const brokenCollapseIndex = publicStyleSource.search(/@media \(max-width: 1450px\) \{\s*\.home-hero-layout \{\s*grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
    const recoveryIndex = publicStyleSource.indexOf("MPReply 0.1.85 · Hero visual baseline recovery");
    expect(brokenCollapseIndex).toBeGreaterThanOrEqual(0);
    expect(recoveryIndex).toBeGreaterThan(brokenCollapseIndex);
    expect(heroStyleSource).toContain("MPReply 0.1.85 · compact desktop scene sizes");
    expect(heroStyleSource).toMatch(/@media \(max-width: 1500px\) and \(min-width: 1121px\) \{[\s\S]*?\.scene \{[\s\S]*?width:\s*clamp\(43rem, 55vw, 50\.5rem\);/);
  });

  it("retains bounded rendering and complete lifecycle controls", () => {
    expect(heroSource).toContain("ResizeObserver");
    expect(heroSource).toContain("window.requestAnimationFrame");
    expect(heroSource).toContain("window.cancelAnimationFrame");
    expect(heroSource).toContain("removeEventListener");
    expect(heroSource).toContain("resizeObserver.disconnect()");
    expect(heroSource).toContain("mediaQuery.removeEventListener");
  });
});
