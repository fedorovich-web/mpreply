import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const englishPricing = readFileSync(join(root, "app/en/pricing/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-pricing-integration-fidelity.css"), "utf8");

describe("approved pricing visual", () => {
  it("uses the approved split hero with the raster mascot and marketplace card", () => {
    expect(pricing).toContain("pricing-approved-hero-grid");
    expect(pricing).toContain("pricing-approved-hero-scene");
    expect(pricing).toContain('src="/images/mpreply-mascot.webp"');
    expect(pricing).toContain("pricing-approved-market-card");
    for (const asset of [
      "wildberries-compact.webp",
      "ozon-compact.webp",
      "yandex-market-compact.webp",
      "avito-compact.webp",
    ]) {
      expect(pricing).toContain(asset);
    }
    expect(pricing).not.toContain("<svg");
  });

  it("keeps three plan cards with compact raster icon treatments and a highlighted middle plan", () => {
    expect(pricing).toContain("pricing-card-grid");
    expect(pricing).toContain("pricing-plan-card-icon");
    expect(pricing).toContain("pricing-card-popular");
    expect(pricing).toContain('const planIcons = ["send", "users", "chart"] as const');
    expect(css).toContain(".pricing-plan-card-icon");
    expect(css).toContain(".pricing-card-popular");
  });

  it("follows the approved comparison, start-benefits, FAQ, and compact CTA sequence", () => {
    expect(pricing).toContain("pricing-comparison");
    expect(pricing).toContain("pricing-approved-start-grid");
    expect(pricing).toContain("pricing-approved-faq-layout");
    expect(pricing).toContain("pricing-approved-final-cta");
    expect(pricing).not.toContain("pricing-final-logo-cloud");
    expect(pricing).not.toContain("pricing-final-review");
    expect(pricing).not.toContain("pricing-final-answer");
    expect(pricing).not.toContain("pricing-custom-strip");

    expect(css).toContain(".pricing-approved-start-grid");
    expect(css).toContain(".pricing-approved-faq-layout");
    expect(css).toContain(".pricing-approved-final-cta");
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
      "pricing-approved-final-cta",
    ]) {
      expect(pricing).toContain(className);
      expect(englishPricing).toContain(className);
    }

    for (const slug of ["wildberries", "ozon", "yandex-market", "avito"]) {
      expect(englishPricing).toContain(`path: "/en/marketplaces/${slug}"`);
    }
  });

  it("loads the scoped pricing fidelity layer without the retired violet brand family", () => {
    expect(layout).toContain('import "../styles/public-pricing-integration-fidelity.css"');
    expect(css).not.toMatch(/#5148e8|#635bff|#5964ff|rgb\(81 72 232|rgb\(99 91 255/i);
    expect(css).toContain("@media (max-width: 520px)");
  });
});
