import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const detail = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const cssPath = join(root, "styles/public-mockup-cta-fidelity.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
const decorativeCssPath = join(root, "styles/public-mockup-decorative-fidelity.css");
const decorativeCss = existsSync(decorativeCssPath) ? readFileSync(decorativeCssPath, "utf8") : "";

describe("approved horizontal public CTA strips", () => {
  it("keeps the leading send tile only on renders that actually show it", () => {
    expect(features).toContain("mockup-cta-strip features-cta-strip");
    expect(features).not.toContain("mockup-cta-strip-icon");

    for (const page of [marketplaces, detail, demo]) {
      expect(page).toContain("mockup-cta-strip");
      expect(page).toContain("mockup-cta-strip-icon");
      expect(page).toContain('name="send"');
    }
  });

  it("keeps the CTA visual contract in a final override", () => {
    expect(existsSync(cssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-mockup-cta-fidelity.css"');
    expect(css).toContain("grid-template-columns: 56px minmax(0, 1fr) auto");
    expect(css).toContain(".mockup-page .features-cta-strip");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(css).toContain(".mockup-cta-strip-side");
    expect(css).toContain("@media (max-width: 720px)");
  });

  it("renders trust ticks as soft circular badges like the approved renders", () => {
    expect(css).toContain(".mockup-page .mockup-trust-row span::before");
    expect(css).toContain("display: inline-grid");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain("background: #eeedff");
    expect(css).toContain("color: var(--color-brand-primary)");
  });

  it("uses the fast-connect glyph for the third hero trust item only on marketplaces and demo", () => {
    expect(css).toContain(".marketplaces-mockup-hero .mockup-trust-row span:nth-child(3)::before");
    expect(css).toContain(".demo-mockup-hero .mockup-trust-row span:nth-child(3)::before");
    expect(css).toContain("content: ''");
    expect(css).toContain("linear-gradient(90deg, var(--color-brand-primary) 0 0)");
  });

  it("draws the handwritten CTA arrows shown on marketplaces and demo", () => {
    expect(existsSync(decorativeCssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-mockup-decorative-fidelity.css"');
    expect(decorativeCss).toContain(".marketplace-cta-note::before");
    expect(decorativeCss).toContain(".demo-cta-note::before");
    expect(decorativeCss).toContain("border-top: 2px solid var(--color-brand-primary)");
    expect(decorativeCss).toContain("transform: rotate(-24deg)");
  });
});
