import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const css = read("styles/public-site.css");

describe("public shared stylesheet", () => {
  it("keeps live layout and accessible navigation primitives", () => {
    for (const selector of [".public-container", ".public-header", ".public-mobile-navigation", ".public-mobile-menu-panel", ".skip-link"]) {
      expect(css).toContain(selector);
    }
    expect(read("styles/globals.css")).toContain("@import './public-site.css'");
    expect(read("styles/marketing-site.css")).toContain(".public-root .button-primary");
    expect(read("styles/public-compact-footer.css")).toContain(".home-reference-footer");
  });

  it("does not keep retired homepage, theme or planned marketplace CSS", () => {
    for (const retired of [".theme-toggle", ".public-hero-flow", ".hero-flow-canvas", ".hero-proof-row", ".signal-flow", ".operations-panel", ".feature-grid-editorial", ".public-status-planned", ".readiness-summary-planned", ".integration-status-panel-planned", ".faq-item"]) {
      expect(css).not.toContain(retired);
    }
  });
});
