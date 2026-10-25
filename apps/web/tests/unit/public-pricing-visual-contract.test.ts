import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const englishPricing = readFileSync(join(root, "app/en/pricing/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-pricing-integration-fidelity.css"), "utf8");

describe("approved pricing visual", () => {
  it("uses the supplied AVIF in the same split hero for both languages", () => {
    for (const source of [pricing, englishPricing]) {
      expect(source).toContain("pricing-approved-hero-grid");
      expect(source).toContain("pricing-approved-hero-scene");
      expect(source).toContain('src="/images/approved/05-pricing-hero.avif"');
      expect(source).toContain("unoptimized");
      expect(source).not.toContain("pricing-approved-market-card");
    }
    expect(pricing).not.toContain("<svg");
  });

  it("shows the fourth corporate plan while keeping Business a standard plan", () => {
    expect(pricing).toContain("pricing-card-grid");
    expect(pricing).toContain("pricing-plan-card-icon");
    expect(pricing).toContain("pricing-card-popular");
    expect(pricing).toContain('name: "Корпоративный"');
    expect(englishPricing).toContain('name: "Corporate"');
    expect(pricing).toContain('price: "По запросу"');
    expect(pricing).toContain('index === 3 ? "/contacts#contact-form" : appOrigin + "/auth/register?intent=connect-marketplace"');
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain(".pricing-plan-card-icon");
    expect(css).toContain(".pricing-card-popular");
  });

  it("keeps comparison, start-benefits and FAQ without the removed CTA strip", () => {
    expect(pricing).toContain("pricing-comparison");
    expect(pricing).toContain("pricing-approved-start-grid");
    expect(pricing).toContain("pricing-approved-faq-layout");
    expect(pricing).not.toContain("pricing-approved-final-cta");
    expect(englishPricing).not.toContain("pricing-approved-final-cta");
    expect(pricing).not.toContain("pricing-final-logo-cloud");
    expect(pricing).not.toContain("pricing-final-review");
    expect(pricing).not.toContain("pricing-final-answer");
    expect(pricing).not.toContain("pricing-custom-strip");

    expect(css).toContain(".pricing-approved-start-grid");
    expect(css).toContain(".pricing-approved-faq-layout");
    expect(css).not.toContain(".pricing-approved-final-cta");
  });

  it("keeps FAQ controls compact and aligned to the right", () => {
    expect(pricing).toContain("pricing-faq-summary");
    expect(pricing).toContain("pricing-faq-chevron");
    expect(css).toContain(".pricing-faq-summary");
    expect(css).toContain(".pricing-faq-chevron");
  });

  it("keeps RU and EN on the same composition and English marketplace links localized", () => {
    for (const className of [
      "pricing-approved-hero-grid",
      "pricing-card-grid",
      "pricing-comparison",
      "pricing-approved-start-grid",
      "pricing-approved-faq-layout",
    ]) {
      expect(pricing).toContain(className);
      expect(englishPricing).toContain(className);
    }

    expect(englishPricing).toContain('"/en/contacts#contact-form"');
    expect(englishPricing).toContain('"/en/auth/register?intent=connect-marketplace"');
  });

  it("loads the scoped pricing fidelity layer without the retired violet brand family", () => {
    expect(layout).toContain('import "../styles/public-pricing-integration-fidelity.css"');
    expect(css).not.toMatch(/#5148e8|#635bff|#5964ff|rgb\(81 72 232|rgb\(99 91 255/i);
    expect(css).toContain("@media (max-width: 520px)");
  });
});
