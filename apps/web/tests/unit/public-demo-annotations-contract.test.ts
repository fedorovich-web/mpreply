import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const decorativeCss = readFileSync(join(root, "styles/public-mockup-decorative-fidelity.css"), "utf8");

describe("approved demo annotations", () => {
  it("keeps the hero and CTA handwritten notes from the render", () => {
    expect(demo).toContain("demo-hero-note");
    expect(demo).toContain("Быстрее и проще");
    expect(demo).toContain("demo-cta-note");
    expect(demo).toContain("Убедитесь в эффективности");
    expect(decorativeCss).toContain(".demo-hero-note");
    expect(decorativeCss).toContain(".demo-cta-note");
  });
});
