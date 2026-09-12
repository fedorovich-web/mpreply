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

  it("uses buyer-facing workflow language instead of infrastructure jargon", () => {
    expect(features).toMatch(/От обращения покупателя до ответа|путь обработки каждого обращения/i);
    expect(features).toContain("Отзывы, вопросы и сообщения");
    expect(features).toContain("проверку сотруднику");
    expect(features).not.toMatch(/worker-backed|идемпотентности|application layer/i);
  });

  it("shows the features workflow as a layered product scene instead of a generic single card", () => {
    expect(features).toContain("features-hero-scene");
    expect(features).toContain("features-hero-message");
    expect(features).toContain("features-hero-draft");
    expect(features).toContain("features-hero-review");
    expect(pagesCss).toContain(".features-hero-scene");
    expect(pagesCss).toContain(".features-hero-draft");
  });
});