import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const icon = readFileSync(join(root, "components/public-site/PublicIcon.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-approved-raster-icons.css"), "utf8");

describe("public icon format policy", () => {
  it("renders public UI icons from WebP assets only", () => {
    expect(icon).toContain("iconSources");
    expect(icon).toContain("public-icon-image");
    expect(icon).toContain("backgroundImage");
    expect(icon).not.toContain("<svg");
    expect(icon).not.toContain("SVGProps");
    expect(icon.match(/\.webp"/g)?.length ?? 0).toBeGreaterThanOrEqual(20);
  });

  it("keeps render-specific approved icon overrides raster-only", () => {
    expect(css).toContain("> .public-icon-image");
    expect(css).not.toContain("> svg");
    expect(css).toContain("background-size: 44px 44px");
  });
});
