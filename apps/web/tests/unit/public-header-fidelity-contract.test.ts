import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const header = readFileSync(join(root, "components/public-site/PublicHeader.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const css = readFileSync(join(root, "styles/public-header-fidelity.css"), "utf8");

describe("approved mockup header fidelity", () => {
  it("uses the render CTA wording on desktop and mobile", () => {
    expect(header).toContain("Попробовать бесплатно");
    expect(header).not.toContain("Создать аккаунт");
  });

  it("matches compact mockup header chrome without changing routing logic", () => {
    expect(css).toContain(":has(.mockup-page)");
    expect(css).toContain(".public-login-link");
    expect(css).toContain('[aria-current="page"]');
    expect(css).toContain("width: 32px");
    expect(css).toContain("min-height: 34px");
  });

  it("loads header fidelity after other public layers", () => {
    expect(layout).toContain('import "../styles/public-header-fidelity.css"');
  });
});
