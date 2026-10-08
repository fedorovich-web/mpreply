import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const render = readFileSync(join(root, "styles/public-mockup-render-tuning.css"), "utf8");
const pricing = readFileSync(join(root, "styles/public-pricing-integration-fidelity.css"), "utf8");
const finalDetails = readFileSync(join(root, "styles/public-mockup-final-details.css"), "utf8");

describe("pricing and demo live styles", () => {
  it("does not load the retired pre-mockup pricing/demo stylesheet", () => {
    expect(layout).not.toContain('pricing-demo-approved.css');
    expect(render).toContain(".mockup-page .pricing-mockup-hero");
    expect(render).toContain(".mockup-page .demo-mockup-hero");
    expect(render).toContain(".mockup-page .demo-process");
  });

  it("keeps the approved pricing composition in the scoped fidelity layer", () => {
    for (const selector of [
      ".pricing-approved-hero-grid",
      ".pricing-approved-market-card",
      ".pricing-plan-card-icon",
      ".pricing-approved-start-grid",
      ".pricing-approved-faq-layout",
    ]) {
      expect(pricing).toContain(selector);
    }
    expect(pricing).not.toContain(".pricing-approved-final-cta");
  });

  it("keeps responsive demo and pricing details in the live cascade", () => {
    expect(render).toContain("@media (max-width: 720px)");
    expect(finalDetails).toContain(".demo-process-event-icon");
    expect(finalDetails).toContain(".demo-scenario-popular");
    expect(pricing).toContain("@media (max-width: 520px)");
  });
});
