import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const mascotCss = readFileSync(join(root, "styles/public-mockup-mascot.css"), "utf8");

describe("approved public mascot asset", () => {
  it("uses the render-derived WebP mascot instead of the CSS placeholder", () => {
    expect(layout).toContain('import "../styles/public-mockup-mascot.css"');
    expect(mascotCss).toContain('/images/mpreply-mascot.webp');
    expect(mascotCss).toContain('.mockup-mascot::before');
    expect(mascotCss).toContain('display: none');
  });
});
