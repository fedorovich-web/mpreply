import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const foundation = read("styles/marketing-site.css");
const layout = read("app/layout.tsx");

describe("marketing site foundation", () => {
  it("keeps common public surfaces and controls beneath the approved blue layers", () => {
    for (const selector of [".public-root {", ".public-root .public-header {", ".public-root .button-primary {", ".public-root .button-secondary {"]) {
      expect(foundation).toContain(selector);
    }
    for (const layer of ["public-inner-blue-reference.css", "homepage-reference-restore.css"]) {
      expect(layout.indexOf(layer)).toBeGreaterThan(layout.indexOf("marketing-site.css"));
      expect(read("styles/" + layer)).toContain("--color-brand-primary: #0b68f6");
    }
    expect(read("styles/public-compact-footer.css")).toContain(".home-reference-footer");
    expect(layout).toContain('import "../styles/public-compact-footer.css"');
  });

  it("does not revive retired homepage and theme selectors", () => {
    for (const retired of ["homepage-hero-product", "homepage-hero-feed", "homepage-hero-draft", "homepage-ai-orbit", "homepage-process-flow", "homepage-process-step", "homepage-outcomes", "homepage-faq-layout", "theme-toggle", "button-ghost", "public-brand-copy small"]) {
      expect(foundation).not.toContain(retired);
    }
  });
});
