import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const finalCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const pricingCss = readFileSync(join(root, "styles/public-pricing-integration-fidelity.css"), "utf8");

describe("final approved render details", () => {
  it("loads the shared final-details layer and page-scoped pricing refinement", () => {
    expect(layout).toContain('import "../styles/public-mockup-final-details.css"');
    expect(layout).toContain('import "../styles/public-pricing-integration-fidelity.css"');
  });
  it("decodes the supplied original pricing hero while keeping plans and FAQ code-driven", async () => {
    expect(pricing).toContain('src="/images/approved/05-pricing-hero.avif"');
    expect(pricing).toContain("pricing-card-grid");
    expect(pricing).toContain("pricing-faq");
    expect(pricing).toContain('<summary className="pricing-faq-summary">');
    expect(pricingCss).toContain(".pricing-approved-market-card");
    expect(pricingCss).toContain(".pricing-approved-note");
    const image = sharp(join(root, "public/images/approved/05-pricing-hero.avif"));
    expect(await image.metadata()).toMatchObject({ width: 1794, height: 877, compression: "av1" });
    await expect(image.raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
    for (const retired of ["pricing-hero-note", "pricing-custom-icon", "pricing-custom-strip", "pricing-faq-heading"]) {
      expect(pricing).not.toContain(retired);
      expect(finalCss).not.toContain("." + retired);
    }
  });
  it("keeps the approved headings free of retired eyebrow ornaments", () => {
    expect(pricing).not.toContain("mockup-eyebrow");
    expect(features).not.toContain("mockup-eyebrow");
    expect(finalCss).not.toContain(".pricing-mockup-hero .mockup-eyebrow");
    expect(finalCss).not.toContain(".mockup-page:has(.pricing-mockup-hero) .render-section-head .mockup-eyebrow");
  });
  it("renders the features benefit group as the approved shared panel", () => {
    expect(features).toContain("features-benefit-grid");
    expect(finalCss).toContain(":has(.features-benefit-grid)");
  });
  it("keeps current feature benefits and the original queue illustration", () => {
    expect(features).toMatch(/\[\s*"star",\s*"blue",\s*"Контекст перед ответом"/);
    expect(features).toContain('src="/images/approved/02-features-hero.avif"');
    expect(features).toContain("supplied-hero-image");
    expect(features).not.toContain("Выше рейтинг товаров");
  });
});
