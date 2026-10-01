import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const integrations = readFileSync(join(root, "components/integrations/IntegrationsWorkspace.tsx"), "utf8");
const routes = ["app/demo/page.tsx", "app/en/demo/page.tsx"].map((path) => readFileSync(join(root, path), "utf8"));

describe("demo workspace marketplace assets", () => {
  it("uses the real integration catalog and supplied marketplace marks", () => {
    for (const asset of ["01-wildberries.avif", "02-ozon.avif", "03-yandex-market.avif", "04-avito.avif"]) {
      expect(integrations).toContain("/images/icons/final/" + asset);
      expect(existsSync(join(root, "public/images/icons/final", asset))).toBe(true);
    }
    expect(integrations).toContain("src={marketplace.icon}");
    expect(integrations).toContain('className="integration-market-logo"');
  });
  it("does not keep a second marketplace journey on the demo entry routes", () => {
    for (const source of routes) {
      expect(source).toContain("<DemoEntry");
      expect(source).not.toMatch(/compactSrc|demo-journey|demo-marketplace-compact/);
    }
  });
});
