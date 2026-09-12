import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const home = readFileSync(join(root, "app/page.tsx"), "utf8");
const homeWorkspace = readFileSync(join(root, "components/public-site/HomeWorkspaceTabs.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const pagesCssPath = join(root, "styles/marketing-pages.css");
const pagesCss = existsSync(pagesCssPath) ? readFileSync(pagesCssPath, "utf8") : "";
const marketplacesCssPath = join(root, "styles/marketplaces-approved.css");
const marketplacesCss = existsSync(marketplacesCssPath) ? readFileSync(marketplacesCssPath, "utf8") : "";

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

  it("shows integrations as one routed MPReply workspace rather than isolated marketplace cards", () => {
    expect(layout).toContain('import "../styles/marketplaces-approved.css"');
    expect(marketplaces).toContain("marketplace-unified-scene");
    expect(marketplaces).toContain("marketplace-unified-window");
    expect(marketplaces).toContain("marketplace-unified-sources");
    expect(marketplaces).toContain("marketplace-unified-answer");
    expect(marketplacesCss).toContain(".marketplace-unified-scene");
    expect(marketplacesCss).toContain(".marketplace-unified-window");
  });

  it("uses the same layered product language on every marketplace detail route", () => {
    expect(marketplaceLanding).toContain("marketplace-detail-scene");
    expect(marketplaceLanding).toContain("marketplace-detail-window");
    expect(marketplaceLanding).toContain("marketplace-detail-draft");
    expect(marketplacesCss).toContain(".marketplace-detail-scene");
    expect(marketplacesCss).toContain(".marketplace-detail-window");
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

  it("uses article elements only for content with a real heading", () => {
    expect(home).not.toContain('<article className={`homepage-model-card');
    expect(home).not.toContain('<article className="homepage-result-card"');
    expect(homeWorkspace).not.toContain('<article className={`homepage-workspace-list-row');
    expect(homeWorkspace).not.toContain('<article className="homepage-workspace-answer"');
    expect(features).not.toContain('<article className="features-hero-draft"');
    expect(features).not.toContain('<article className="features-hero-review"');
  });
});