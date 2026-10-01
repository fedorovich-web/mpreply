import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const layout = read("app/layout.tsx");
const home = read("styles/homepage-reference-restore.css");
const inner = read("styles/public-inner-blue-reference.css");
const palette = ["#0b68f6", "#0757d7", "#eaf4ff", "linear-gradient(110deg, #0d6cf7 0%, #0674ff 58%, #0a5fe8 100%)"];

describe("shared public blue reference", () => {
  it("uses the shared shell with a homepage composition flag in both locales", () => {
    expect(read("app/page.tsx")).toContain("<PublicShell home>");
    expect(read("app/en/page.tsx")).toContain('<PublicShell home locale="en">');
    expect(read("components/public-site/PublicShell.tsx")).toContain('<PublicFooter locale={locale} />');
    expect(inner).toContain(".public-root:not(.homepage-reference-root)");
  });

  it("keeps the same approved blue palette on homepage and inner routes", () => {
    for (const color of palette) {
      expect(home).toContain(color);
      expect(inner).toContain(color);
    }
    for (const legacy of ["#5148e8", "#635bff", "#5964ff", "rgb(81 72 232", "rgb(99 91 255"]) {
      expect(inner).not.toContain(legacy);
      expect(home).not.toContain(legacy);
    }
  });

  it("applies the palette after the old public brand layer and before homepage restore", () => {
    const imports = Array.from(layout.matchAll(/import "\.\.\/styles\/([^"]+)";/g), (match) => match[1]);
    expect(imports.indexOf("public-inner-blue-reference.css")).toBeGreaterThan(imports.indexOf("public-mockup-brand-fidelity.css"));
    expect(imports.indexOf("public-inner-blue-reference.css")).toBeGreaterThan(imports.indexOf("public-header-fidelity.css"));
    expect(imports.indexOf("homepage-reference-restore.css")).toBeGreaterThan(imports.indexOf("public-inner-blue-reference.css"));
  });

  it("covers live shared actions, heroes, pricing comparison and integration accents", () => {
    for (const selector of [".button-primary", ".public-header-cta", ".mockup-hero", ".marketplace-detail-mockup-hero", ".pricing-mockup-hero", ".pricing-comparison", ".features-app-nav strong", ".marketplace-hub-line"]) {
      expect(inner).toContain(selector);
    }
    expect(inner).toContain("--marketplace-brand-override: initial");
  });
});
