import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const homepage = readFileSync(join(root, "app/page.tsx"), "utf8");
const homepageReference = readFileSync(join(root, "styles/homepage-reference-restore.css"), "utf8");
const blueReferencePath = join(root, "styles/public-inner-blue-reference.css");
const blueReference = existsSync(blueReferencePath) ? readFileSync(blueReferencePath, "utf8") : "";

const homepagePalette = [
  "#0b68f6",
  "#0757d7",
  "#eaf4ff",
  "linear-gradient(110deg, #0d6cf7 0%, #0674ff 58%, #0a5fe8 100%)",
] as const;

describe("inner public blue reference contract", () => {
  it("keeps the approved homepage isolated and untouched by the inner-page layer", () => {
    expect(homepage).toContain("<HomeApprovedShell>");
    expect(homepageReference).toContain(".homepage-reference-root");
    expect(blueReference).toContain(".public-root:not(.homepage-reference-root)");
    expect(blueReference).not.toContain(".homepage-reference-root {");
  });

  it("uses the exact homepage brand family on inner public pages", () => {
    for (const token of homepagePalette) {
      expect(homepageReference).toContain(token);
      expect(blueReference).toContain(token);
    }
  });

  it("loads the inner-page blue guard after all public fidelity layers but before the homepage reference", () => {
    const innerImport = 'import "../styles/public-inner-blue-reference.css";';
    const lastSharedImport = 'import "../styles/public-approved-raster-icons.css";';
    const homepageImport = 'import "../styles/homepage-reference-restore.css";';

    expect(layout).toContain(innerImport);
    expect(layout.indexOf(innerImport)).toBeGreaterThan(layout.indexOf(lastSharedImport));
    expect(layout.indexOf(innerImport)).toBeLessThan(layout.indexOf(homepageImport));
  });

  it("overrides old violet public accents in the late fidelity layer", () => {
    for (const legacy of ["#5148e8", "#635bff", "#5964ff", "rgb(81 72 232", "rgb(99 91 255"]) {
      expect(blueReference).not.toContain(legacy);
    }
  });

  it("covers shared chrome, heroes, CTAs, pricing and mockup accents", () => {
    for (const selector of [
      ".public-brand-mark",
      ".button-primary",
      ".mockup-hero",
      ".marketplace-detail-mockup-hero",
      ".pricing-mockup-hero",
      ".demo-mockup-hero",
      ".mockup-cta-strip",
      ".pricing-card.is-popular",
      ".pricing-popular",
      ".features-app-nav strong",
      ".marketplace-hub-line",
      ".public-header-cta",
    ]) {
      expect(blueReference).toContain(selector);
    }
  });
});
