import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const pagesCssPath = join(root, "styles/marketing-pages.css");
const pagesCss = existsSync(pagesCssPath) ? readFileSync(pagesCssPath, "utf8") : "";

describe("public page redesign", () => {
  it("loads page-specific marketing compositions", () => {
    expect(layout).toContain('import "../styles/marketing-pages.css"');
    expect(pagesCss).toContain(".marketplace-cluster");
    expect(pagesCss).toContain(".marketplace-detail-story");
  });

  it("does not expose obsolete planned integration messaging", () => {
    expect(marketplaces).not.toMatch(/Планируется|production-ready|roadmap|MVP-интеграция/i);
    expect(marketplaces).toContain("Wildberries, Ozon, Яндекс Маркет и Авито");
  });

  it("uses buyer-facing feature language instead of infrastructure jargon", () => {
    expect(features).toContain("От входящего обращения до готового ответа");
    expect(features).not.toMatch(/worker-backed|идемпотентности|application layer/i);
  });
});
