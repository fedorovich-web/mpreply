import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const brandCss = readFileSync(join(root, "styles/public-mockup-brand-fidelity.css"), "utf8");
const ctaCss = readFileSync(join(root, "styles/public-mockup-cta-fidelity.css"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");
const finalDetailsCss = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");
const featuresSidebarCss = readFileSync(join(root, "styles/public-features-sidebar-fidelity.css"), "utf8");
const detailCss = readFileSync(join(root, "styles/public-detail-hero-fidelity.css"), "utf8");
const pricingCss = readFileSync(join(root, "styles/public-pricing-integration-fidelity.css"), "utf8");
const headerCss = readFileSync(join(root, "styles/public-header-fidelity.css"), "utf8");
const footerCss = readFileSync(join(root, "styles/public-compact-footer.css"), "utf8");
const mascotCss = readFileSync(join(root, "styles/public-mockup-mascot.css"), "utf8");
const rasterCss = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");

const tokenizedLateLayers = [
  ctaCss,
  decorativeCss,
  finalDetailsCss,
  featuresSidebarCss,
  detailCss,
  pricingCss,
  headerCss,
  footerCss,
] as const;

describe("public handoff fidelity token usage", () => {
  it("defines the approved brand primitives once in the scoped brand layer", () => {
    expect(brandCss).toContain("--color-brand-primary: #5148e8");
    expect(brandCss).toContain("--color-brand-soft: #f0efff");
    expect(brandCss).toContain("--gradient-mpreply-action: linear-gradient(110deg, #5148e8 0%, #635bff 58%, #5964ff 100%)");
  });

  it("uses the shared primary token instead of repeating the brand hex in late fidelity layers", () => {
    for (const source of tokenizedLateLayers) {
      expect(source).not.toMatch(/#5148e8/i);
      expect(source).toContain("var(--color-brand-primary)");
    }
  });

  it("keeps non-color late layers from reintroducing a raw primary override", () => {
    for (const source of [mascotCss, rasterCss]) expect(source).not.toMatch(/#5148e8/i);
  });

  it("uses the shared brand-soft token for repeated approved lavender surfaces", () => {
    expect(finalDetailsCss).not.toMatch(/#f0efff/i);
    expect(finalDetailsCss).toContain("var(--color-brand-soft)");
  });

  it("uses the shared action gradient where the approved gradient is repeated", () => {
    for (const source of [ctaCss, decorativeCss, headerCss]) {
      expect(source).not.toContain("linear-gradient(110deg, #5148e8 0%, #635bff 58%, #5964ff 100%)");
      expect(source).toContain("var(--gradient-mpreply-action)");
    }
  });
});
