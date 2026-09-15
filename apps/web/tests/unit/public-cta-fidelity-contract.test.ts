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

describe("approved horizontal public CTA strips", () => {
  it("uses one strip composition on features, marketplaces, detail and demo", () => {
    for (const page of [features, marketplaces, detail, demo]) {
      expect(page).toContain("mockup-cta-strip");
      expect(page).toContain("mockup-cta-strip-icon");
      expect(page).toContain('name="send"');
    }
  });

  it("keeps the CTA visual contract in a final override", () => {
    expect(existsSync(cssPath)).toBe(true);
    expect(layout).toContain('import "../styles/public-mockup-cta-fidelity.css"');
    expect(css).toContain("grid-template-columns: 56px minmax(0, 1fr) auto");
    expect(css).toContain(".mockup-cta-strip-side");
    expect(css).toContain("@media (max-width: 720px)");
  });
});
