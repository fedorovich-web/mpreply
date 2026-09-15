import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const ctaCss = readFileSync(join(root, "styles/public-mockup-cta-fidelity.css"), "utf8");

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
});
