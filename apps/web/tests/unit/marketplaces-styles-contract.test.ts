import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-mockup-fidelity.css"), "utf8");
const blue = readFileSync(join(root, "styles/public-inner-blue-reference.css"), "utf8");

describe("marketplaces shared stylesheet", () => {
  it("uses the active mockup stack and does not resurrect the retired unified-feed stylesheet", () => {
    expect(existsSync(join(root, "styles/marketplaces-approved.css"))).toBe(false);
    expect(layout).not.toContain("marketplaces-approved.css");
    expect(layout).toContain('import "../styles/public-mockup-fidelity.css"');
    expect(css).toContain(".marketplace-logo-grid");
    expect(css).toContain(".marketplace-connect-steps");
  });
  it("normalizes generic marketplace chrome through the final blue brand layer", () => {
    expect(blue).toContain("--color-brand-primary: #0b68f6");
    expect(blue).toContain("--color-brand-soft: #eaf4ff");
    expect(blue).toContain(".marketplace-hub-core");
    expect(blue).not.toMatch(/#(?:5148e8|635bff|5964ff)/i);
    expect(layout.indexOf('import "../styles/public-inner-blue-reference.css"')).toBeGreaterThan(layout.indexOf('import "../styles/public-mockup-fidelity.css"'));
  });
  it("keeps responsive marketplace grids composed at tablet and mobile widths", () => {
    expect(css).toContain("@media (max-width: 1040px)");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("grid-template-columns: 1fr");
  });
});
