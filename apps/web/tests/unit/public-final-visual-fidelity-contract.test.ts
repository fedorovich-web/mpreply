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
  it("loads the shared final-details layer and the later page-scoped pricing refinement", () => {
    expect(layout).toContain('import "../styles/public-mockup-final-details.css"');
    expect(layout).toContain('import "../styles/public-pricing-integration-fidelity.css"');
  });

  it("keeps the pricing helper details from the approved mockup", () => {
    expect(pricing).toContain("pricing-hero-note");
    expect(pricing).toContain("pricing-custom-icon");
    expect(pricing).toContain('href="/help"');
    expect(pricing).toContain("Все вопросы");
    expect(pricing).toContain("pricing-market-compact");
    expect(pricing).toContain("pricing-market-name");
    expect(finalCss).toContain(".pricing-hero-note");
    expect(finalCss).toContain(".pricing-custom-icon");
    expect(pricingCss).toContain(".pricing-custom-icon > svg");
    expect(pricingCss).toContain(".pricing-custom-icon::before");
    expect(pricingCss).toContain(".pricing-custom-icon::after");
  });

  it("uses the lavender pill kicker treatment from the pricing render", () => {
    expect(finalCss).toContain(".pricing-mockup-hero .mockup-eyebrow");
    expect(finalCss).toContain(".mockup-page:has(.pricing-mockup-hero) .render-section-head .mockup-eyebrow");
    expect(finalCss).toContain(".pricing-faq-heading .mockup-eyebrow");
    expect(finalCss).toContain("::before");
  });

  it("renders the features benefit group as the soft rounded panel from the mockup", () => {
    expect(features).toContain("features-benefit-grid");
    expect(finalCss).toContain(":has(.features-benefit-grid)");
  });

  it("keeps the approved features workflow and benefit icon tones", () => {
    expect(features).toContain('index === 2 ? "purple" : ""');
    expect(features).toMatch(/\[\s*"star",\s*"blue",\s*"Выше рейтинг товаров"/);
  });

  it("uses the message bubble for reviews in the approved features sidebar", () => {
    expect(features).toContain('<span className="features-app-nav-item"><PublicIcon name="message" />Отзывы</span>');
    expect(features).not.toContain('<span className="features-app-nav-item"><PublicIcon name="star" />Отзывы</span>');
  });
});
