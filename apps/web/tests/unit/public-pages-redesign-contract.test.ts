import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const home = readFileSync(join(root, "app/page.tsx"), "utf8");
const homeWorkspace = readFileSync(join(root, "components/public-site/HomeWorkspaceTabs.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const resources = readFileSync(join(root, "app/resources/page.tsx"), "utf8");
const contacts = readFileSync(join(root, "app/contacts/page.tsx"), "utf8");
const help = readFileSync(join(root, "app/help/page.tsx"), "utf8");
const privacy = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
const terms = readFileSync(join(root, "app/terms/page.tsx"), "utf8");
const authForm = readFileSync(join(root, "components/auth/AuthForm.tsx"), "utf8");
const authCss = readFileSync(join(root, "styles/auth.css"), "utf8");
const pagesCssPath = join(root, "styles/marketing-pages.css");
const pagesCss = existsSync(pagesCssPath) ? readFileSync(pagesCssPath, "utf8") : "";
const marketplacesCssPath = join(root, "styles/marketplaces-approved.css");
const marketplacesCss = existsSync(marketplacesCssPath) ? readFileSync(marketplacesCssPath, "utf8") : "";
const marketplaceDetailCssPath = join(root, "styles/marketplace-detail-approved.css");
const marketplaceDetailCss = existsSync(marketplaceDetailCssPath) ? readFileSync(marketplaceDetailCssPath, "utf8") : "";
const pricingDemoCssPath = join(root, "styles/pricing-demo-approved.css");
const pricingDemoCss = existsSync(pricingDemoCssPath) ? readFileSync(pricingDemoCssPath, "utf8") : "";
const resourcesContactsCssPath = join(root, "styles/resources-contacts-approved.css");
const resourcesContactsCss = existsSync(resourcesContactsCssPath) ? readFileSync(resourcesContactsCssPath, "utf8") : "";
const helpLegalCssPath = join(root, "styles/help-legal-approved.css");
const helpLegalCss = existsSync(helpLegalCssPath) ? readFileSync(helpLegalCssPath, "utf8") : "";

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
    expect(layout).toContain('import "../styles/marketplace-detail-approved.css"');
    expect(marketplaceLanding).toContain("marketplace-detail-scene");
    expect(marketplaceLanding).toContain("marketplace-detail-window");
    expect(marketplaceLanding).toContain("marketplace-detail-draft");
    expect(marketplaceDetailCss).toContain(".marketplace-detail-scene");
    expect(marketplaceDetailCss).toContain(".marketplace-detail-window");
  });

  it("uses a product-usage composition on pricing without inventing public prices", () => {
    expect(layout).toContain('import "../styles/pricing-demo-approved.css"');
    expect(pricing).toContain("pricing-plan-scene");
    expect(pricing).toContain("pricing-plan-usage");
    expect(pricing).toContain("pricing-plan-scale");
    expect(pricing).not.toMatch(/₽|руб(?:лей|ля)?|\$\d|€\d/i);
    expect(pricingDemoCss).toContain(".pricing-plan-scene");
  });

  it("turns the demo hero into a visible question-to-review product flow", () => {
    expect(demo).toContain("demo-product-scene");
    expect(demo).toContain("demo-product-question");
    expect(demo).toContain("demo-product-draft");
    expect(demo).toContain("demo-product-review");
    expect(pricingDemoCss).toContain(".demo-product-scene");
  });

  it("gives the resources route an editorial composition instead of a plain note list", () => {
    expect(layout).toContain('import "../styles/resources-contacts-approved.css"');
    expect(resources).toContain("resource-editorial-scene");
    expect(resources).toContain("resource-featured-card");
    expect(resources).toContain("resource-topic-grid");
    expect(resourcesContactsCss).toContain(".resource-editorial-scene");
    expect(resourcesContactsCss).toContain(".resource-featured-card");
  });

  it("makes support email the primary contact action without inventing response-time promises", () => {
    expect(contacts).toContain("contact-support-scene");
    expect(contacts).toContain("contact-support-email");
    expect(contacts).toContain("siteConfig.contactEmail");
    expect(contacts).toContain("mailto:");
    expect(contacts).not.toMatch(/ответим за|ответ в течение|24\s*час/i);
    expect(resourcesContactsCss).toContain(".contact-support-scene");
  });

  it("turns help into a task-oriented support map with concrete troubleshooting paths", () => {
    expect(layout).toContain('import "../styles/help-legal-approved.css"');
    expect(help).toContain("help-hero-scene");
    expect(help).toContain("help-path-list");
    expect(help).toContain("help-troubleshooting-flow");
    expect(help).toContain("siteConfig.contactEmail");
    expect(help).toContain("Wildberries, Ozon, Яндекс Маркет и Авито");
    expect(help).not.toMatch(/ответим за|ответ в течение|24\s*час/i);
    expect(helpLegalCss).toContain(".help-hero-scene");
    expect(helpLegalCss).toContain(".help-troubleshooting-flow");
  });

  it("adds readable anchored legal layouts without changing the draft substance", () => {
    expect(privacy).toContain("legal-approved-layout");
    expect(privacy).toContain('id="privacy-data"');
    expect(privacy).toContain("До production-запуска требуется юридическая финализация.");
    expect(terms).toContain("legal-approved-layout");
    expect(terms).toContain('id="terms-acceptable-use"');
    expect(terms).toContain("Не является финальной офертой.");
    expect(helpLegalCss).toContain(".legal-toc");
    expect(helpLegalCss).toContain(".legal-approved-document");
  });

  it("keeps footer routes for help and legal documents wired to real pages", () => {
    expect(publicShell).toContain('href="/help"');
    expect(publicShell).toContain('href="/privacy"');
    expect(publicShell).toContain('href="/terms"');
    expect(publicShell).toContain("siteConfig.contactEmail");
  });

  it("keeps auth behavior intact while presenting a real product workspace beside the form", () => {
    expect(authForm).toContain("auth-shell");
    expect(authForm).toContain("auth-product-panel");
    expect(authForm).toContain("auth-preview-queue");
    expect(authForm).toContain("auth-preview-draft");
    expect(authForm).toContain('apiRequest(`/api/auth/${mode}`');
    expect(authForm).toContain('requestedNext?.startsWith("/app/")');
    expect(authForm).not.toMatch(/14\s*дн|бесплатн(?:ый|ых)\s+период/i);
    expect(authCss).toContain(".auth-product-panel");
    expect(authCss).toContain(".auth-preview-queue");
  });

  it("sends marketplace-connect auth intent directly to integrations", () => {
    expect(authForm).toContain('intent === "connect-marketplace"');
    expect(authForm).toContain('"/app/integrations"');
    expect(authForm).not.toContain('mode === "register" && intent === "connect-marketplace"');
  });

  it("preserves safe next and marketplace intent when switching auth mode", () => {
    expect(authForm).toContain("const alternateAuthHref");
    expect(authForm).toContain('query.set("next", requestedNext)');
    expect(authForm).toContain('query.set("intent", "connect-marketplace")');
    expect(authForm).toContain("href={alternateAuthHref}");
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