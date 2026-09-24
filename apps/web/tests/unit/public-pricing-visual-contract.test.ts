import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const ctaCss = readFileSync(join(root, "styles/public-mockup-cta-fidelity.css"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const integrationsCssPath = join(root, "styles/public-pricing-integration-fidelity.css");
const integrationsCss = existsSync(integrationsCssPath) ? readFileSync(integrationsCssPath, "utf8") : "";

describe("approved pricing final CTA visual", () => {
  it("uses marketplace logos, review card and sparkle instead of the generic mascot", () => {
    expect(pricing).toContain("pricing-final-logo-cloud");
    expect(pricing).toContain("pricing-final-logo-chip");
    expect(pricing).toContain("pricing-final-sparkle");
    expect(pricing).toContain('name="sparkles"');
    expect(pricing).not.toContain('<div className="mockup-mascot"');
  });

  it("positions the decorative composition inside the pricing CTA", () => {
    expect(ctaCss).toContain(".pricing-final-logo-cloud");
    expect(ctaCss).toContain(".pricing-final-sparkle");
  });

  it("uses compact official marketplace marks in integration chips and CTA decoration", () => {
    expect(existsSync(integrationsCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-pricing-integration-fidelity.css"');
    for (const asset of [
      "wildberries-compact.webp",
      "ozon-compact.webp",
      "yandex-market-compact.webp",
      "avito-compact.webp",
    ]) {
      expect(pricing).toContain(asset);
    }
    expect(pricing).toContain("pricing-market-compact");
    expect(pricing).toContain("pricing-market-name");
    expect(integrationsCss).toContain(".pricing-market-compact");
    expect(integrationsCss).toContain(".pricing-final-logo-chip");
    expect(ctaCss).not.toContain('img[src$="wildberries.webp"]');
    expect(ctaCss).not.toContain('img[src$="ozon.webp"]');
    expect(ctaCss).not.toContain('img[src$="yandex-market.webp"]');
    expect(finalCss).not.toContain("marketplace-detail-logo-small");
    expect(finalCss).not.toContain("approved full wordmark assets without duplicate text labels");
  });

  it("keeps Professional body values dark while retaining branded checkmarks", () => {
    expect(integrationsCss).toContain(".pricing-comparison tbody td:nth-child(3)");
    expect(integrationsCss).toContain("color: #52688d");
    expect(pricing).toContain("pricing-comparison-check");
    expect(integrationsCss).toContain(".pricing-comparison-check");
    expect(integrationsCss).toContain("color: var(--color-brand-primary)");
  });

  it("draws the individual-plan padlock shown in the approved render", () => {
    expect(pricing).toContain("pricing-custom-icon");
    expect(integrationsCss).toContain(".pricing-custom-icon > .public-icon-image");
    expect(integrationsCss).toContain("display: none");
    expect(integrationsCss).toContain(".pricing-custom-icon::before");
    expect(integrationsCss).toContain(".pricing-custom-icon::after");
  });

  it("renders FAQ chevrons at the right like the approved render", () => {
    expect(pricing).toContain("pricing-faq-summary");
    expect(pricing).toContain("pricing-faq-chevron");
    expect(integrationsCss).toContain(".pricing-faq-summary");
    expect(integrationsCss).toContain(".pricing-faq-chevron");
  });

  it("splits the CTA review and reply into separate cards", () => {
    expect(pricing).toContain("pricing-final-review");
    expect(pricing).toContain("pricing-final-answer");
    expect(pricing).not.toContain("pricing-final-bubble");
    expect(ctaCss).not.toContain(".pricing-final-bubble");
    expect(integrationsCss).toContain(".pricing-final-review");
    expect(integrationsCss).toContain(".pricing-final-answer");
  });
});
