import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const pricingCss = readFileSync(join(root, "styles/public-pricing-integration-fidelity.css"), "utf8");

describe("final approved render details", () => {
  it("loads the shared final-details layer and the live page-scoped pricing refinement", () => {
    expect(layout).toContain('import "../styles/public-mockup-final-details.css"');
    expect(layout).toContain('import "../styles/public-pricing-integration-fidelity.css"');
  });

  it("uses the current pricing hero helpers instead of retired pricing widgets", () => {
    expect(pricing).toContain("pricing-approved-market-card");
    expect(pricing).toContain("pricing-approved-note");
    expect(pricing).toContain("pricing-market-compact");
    expect(pricing).toContain('href="/help"');
    expect(pricing).toContain("Все вопросы");
    expect(pricingCss).toContain(".pricing-approved-market-card");
    expect(pricingCss).toContain(".pricing-approved-note");
    for (const retired of ["pricing-hero-note", "pricing-custom-icon", "pricing-custom-strip", "pricing-faq-heading"]) {
      expect(pricing).not.toContain(retired);
      expect(finalCss).not.toContain(`.${retired}`);
    }
  });

  it("keeps pricing kickers on live hero and section headings", () => {
    expect(finalCss).toContain(".pricing-mockup-hero .mockup-eyebrow");
    expect(finalCss).toContain(".mockup-page:has(.pricing-mockup-hero) .render-section-head .mockup-eyebrow");
    expect(finalCss).toContain("::before");
  });

  it("renders the features benefit group as one soft rounded panel", () => {
    expect(features).toContain("features-benefit-grid");
    expect(finalCss).toContain(":has(.features-benefit-grid)");
  });

  it("keeps current grounded feature benefit and sidebar treatments", () => {
    expect(features).toMatch(/\[\s*"star",\s*"blue",\s*"Единый стандарт обработки"/);
    expect(features).toContain('<span className="features-app-nav-item"><PublicIcon name="message" />Отзывы</span>');
    expect(features).toContain('<span className="features-app-nav-item"><PublicIcon name="shield-check" />На проверке</span>');
    expect(features).not.toContain("Выше рейтинг товаров");
    expect(features).not.toContain(">Шаблоны</span>");
  });
});
