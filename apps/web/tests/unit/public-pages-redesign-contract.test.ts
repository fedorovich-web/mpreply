import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getHelpContent } from "../../lib/help-content";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const home = readFileSync(join(root, "app/page.tsx"), "utf8");
const homeWorkspace = readFileSync(join(root, "components/public-site/HomeWorkspaceTabs.tsx"), "utf8");
const marketplaceLanding = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const publicFooter = readFileSync(join(root, "components/public-site/PublicFooter.tsx"), "utf8");
const contactForm = readFileSync(join(root, "components/public-site/ContactMailForm.tsx"), "utf8");
const helpCenter = readFileSync(join(root, "components/public-site/HelpCenter.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const contacts = readFileSync(join(root, "app/contacts/page.tsx"), "utf8");
const help = readFileSync(join(root, "app/help/page.tsx"), "utf8");
const privacy = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
const terms = readFileSync(join(root, "app/terms/page.tsx"), "utf8");
const authForm = readFileSync(join(root, "components/auth/AuthForm.tsx"), "utf8");
const authCss = readFileSync(join(root, "styles/auth.css"), "utf8");
const mockupCss = readFileSync(join(root, "styles/public-mockup-fidelity.css"), "utf8");
const contactsRenderCss = readFileSync(join(root, "styles/public-contact-404-render.css"), "utf8");
const helpLegalCss = readFileSync(join(root, "styles/help-legal-approved.css"), "utf8");
const helpCenterCss = readFileSync(join(root, "styles/help-center.css"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("current public page composition", () => {
  it("loads the render-derived mockup layer for the approved inner pages", () => {
    expect(layout).toContain('import "../styles/public-mockup-fidelity.css"');
    expect(layout).toContain('import "../styles/public-mockup-render-tuning.css"');
    expect(layout).toContain('import "../styles/public-mockup-brand-fidelity.css"');
    expect(mockupCss).toContain("--public-section-padding-extra: 15px");
  });

  it("does not expose obsolete planned integration messaging", () => {
    expect(marketplaces).not.toMatch(/Планируется|production-ready|roadmap|MVP-интеграция|в разработке|скоро/i);
    expect(marketplaces).toContain("Wildberries, Ozon, Яндекс Маркет и Авито");
  });

  it("preserves the approved marketplace workflow and automatic-reply composition", () => {
    expect(marketplaces).toContain("Статусы и синхронизация");
    expect(marketplaces).toContain("Единая очередь обращений");
    expect(marketplaces).toContain("ИИ-автоответы");
    expect(marketplaces).toContain("Командная работа");
  });

  it("uses the approved marketplaces hub with four supported marketplace sources", () => {
    expect(marketplaces).toContain("marketplaces-mockup-hero");
    expect(marketplaces).toContain("marketplace-hub-scene");
    expect(marketplaces).toContain("marketplace-logo-grid");
    expect(marketplaces).toContain("marketplace-connect-steps");
    for (const asset of ["01-wildberries.avif", "02-ozon.avif", "03-yandex-market.avif", "04-avito.avif"]) {
      expect(marketplaces).toContain(asset);
    }
  });

  it("uses the approved marketplace detail composition on the shared landing component", () => {
    expect(marketplaceLanding).toContain("marketplace-detail-mockup-hero");
    expect(marketplaceLanding).toContain("marketplace-detail-tools");
    expect(marketplaceLanding).toContain("marketplace-detail-steps");
    expect(marketplaceLanding).toContain("marketplace-detail-benefits");
    expect(marketplaceLanding).toContain("marketplace-detail-faq");
  });

  it("keeps pricing as coded UI with the approved public plans and prices", () => {
    expect(pricing).toContain("pricing-mockup-hero");
    expect(pricing).toContain("pricing-card-grid");
    expect(pricing).toContain("pricing-comparison");
    expect(pricing).toContain("pricing-faq");
    for (const plan of ["Старт", "Команда", "Бизнес"]) expect(pricing).toContain(plan);
    for (const price of ["1 290 ₽", "3 490 ₽", "6 990 ₽"]) expect(pricing).toContain(price);
    expect(pricing).not.toMatch(/pricing[^\n]{0,40}\.(?:png|jpe?g|webp)/i);
  });

  it("enters the real read-only demo cabinet through the shared demo entry", () => {
    expect(demo).toContain('<DemoEntry locale="ru" />');
    expect(demo).toContain("index: false");
    expect(demo).not.toMatch(/demo-journey|demo-scenarios|demo-process|demo-team-tools/);
  });

  it("keeps the removed resources/blog route absent", () => {
    expect(existsSync(join(root, "app/resources/page.tsx"))).toBe(false);
    expect(siteConfig).not.toContain('href: "/resources"');
    expect(siteConfig).not.toContain('"/resources"');
    expect(publicShell).not.toContain('href="/resources"');
  });

  it("makes support email the primary contact action without inventing response-time promises", () => {
    expect(layout).toContain('import "../styles/public-contact-404-render.css"');
    expect(contacts).toContain("contacts-render-hero");
    expect(contacts).not.toContain("contacts-render-channel-grid");
    expect(contacts).not.toContain("contacts-render-final");
    expect(contacts).toContain("ContactMailForm");
    expect(contacts).toContain("siteConfig.contactEmail");
    expect(contactForm).toContain("mailto:${supportEmail}");
    expect(contactForm).toContain('id="contact-form"');
    expect(contacts).not.toMatch(/ответим за|ответ в течение|24\s*час/i);
    expect(contactsRenderCss).toContain(".contacts-render-page");
    expect(contactsRenderCss).not.toContain(".contacts-render-channel-grid");
  });

  it("keeps help task-oriented with concrete troubleshooting paths", () => {
    expect(layout).toContain('import "../styles/help-legal-approved.css"');
    expect(help).toContain('<HelpCenter locale="ru" />');
    expect(helpCenter).toContain("faq-hero-shortcuts");
    expect(helpCenter).toContain('role="tablist"');
    expect(helpCenter).toContain('role="tabpanel"');
    expect(helpCenter).toContain("faq-question-list");
    expect(helpCenter).toContain('localizedPath(locale, "/contacts")');
    for (const locale of ["ru", "en"] as const) {
      const { categories, questions } = getHelpContent(locale);
      expect(categories.map((category) => category.id)).toEqual(["popular", "start", "integrations", "messages", "ai", "team", "pricing", "problems"]);
      for (const category of categories) {
        for (const id of category.questions) expect(questions.some((question) => question.id === id)).toBe(true);
      }
      expect(questions.find((question) => question.id === "missing")?.link?.href).toBe("/contacts");
    }
    expect(help).not.toContain("help-hero-search");
    expect(help).not.toMatch(/ответим за|ответ в течение|24\s*час/i);
    expect(layout).toContain('import "../styles/help-center.css"');
    expect(helpCenterCss).toContain(".faq-hero-shortcuts");
    expect(helpCenterCss).toContain(".faq-question-list");
  });

  it("keeps readable anchored legal layouts without changing the draft substance", () => {
    expect(privacy).toContain("legal-approved-layout");
    expect(privacy).toContain('id="privacy-data"');
    expect(privacy).toContain("До коммерческого запуска требуется юридическая финализация.");
    expect(terms).toContain("legal-approved-layout");
    expect(terms).toContain('id="terms-acceptable-use"');
    expect(terms).toContain("Не является финальной офертой.");
    expect(helpLegalCss).toContain(".legal-toc");
    expect(helpLegalCss).toContain(".legal-approved-document");
  });

  it("keeps footer routes for help and legal documents wired to real pages", () => {
    expect(publicShell).toContain("<PublicFooter locale={locale} />");
    expect(publicFooter).toContain('href={path("/help")}');
    expect(publicFooter).toContain('href={path("/privacy")}');
    expect(publicFooter).toContain('href={path("/terms")}');
    expect(publicFooter).toContain("config.contactEmail");
  });

  it("keeps localized auth behavior intact with the approved product explanation beside the form", () => {
    expect(authForm).toContain("auth-shell");
    expect(authForm).toContain("auth-product-panel");
    expect(authForm).toContain("auth-product-copy");
    expect(authForm).toContain("Типовые сценарии можно автоматизировать, сложные — оставлять на проверку");
    expect(authForm).toContain('apiRequest(`/api/auth/${mode}`');
    expect(authForm).toContain("authErrorMessage");
    expect(authForm).not.toContain("mutation.error instanceof ApiError ? mutation.error.message");
    expect(authForm).toContain('const appPrefix = locale === "en" ? "/en/app/" : "/app/"');
    expect(authForm).toContain("requestedNext?.startsWith(appPrefix)");
    expect(authForm).not.toMatch(/14\s*дн|бесплатн(?:ый|ых)\s+период/i);
    expect(authCss).toContain(".auth-product-panel");
    expect(authCss).toContain(".auth-product-copy");
  });

  it("sends marketplace-connect auth intent directly to integrations", () => {
    expect(authForm).toContain('intent === "connect-marketplace"');
    expect(authForm).toContain("`${appRoot}/integrations`");
    expect(authForm).not.toContain('mode === "register" && intent === "connect-marketplace"');
  });

  it("preserves safe next and marketplace intent when switching auth mode", () => {
    expect(authForm).toContain("const alternateAuthHref");
    expect(authForm).toContain('query.set("next", safeRequestedNext)');
    expect(authForm).toContain('query.set("intent", "connect-marketplace")');
    expect(authForm).not.toContain("isLogin && !requestedNext");
    expect(authForm).toContain("href={alternateAuthHref}");
  });

  it("uses the current features composition and buyer-facing workflow language", () => {
    expect(features).toContain("features-mockup-hero");
    expect(features).toContain("features-tool-grid");
    expect(features).toContain("features-workflow");
    expect(features).toContain("features-benefit-grid");
    expect(features).toContain("обработки отзывов, вопросов и сообщений на маркетплейсах");
    expect(features).not.toMatch(/worker-backed|идемпотентности|application layer/i);
  });

  it("does not publish fabricated quantified feature savings", () => {
    expect(features).not.toMatch(/\d+\s*%[^\n]{0,80}времен/i);
    expect(features).not.toContain("До 70% меньше времени на ответы");
  });

  it("keeps homepage semantic cleanup intact without redesigning it", () => {
    expect(home).not.toContain('<article className={`homepage-model-card');
    expect(home).not.toContain('<article className="homepage-result-card"');
    expect(homeWorkspace).not.toContain('<article className={`homepage-workspace-list-row');
    expect(homeWorkspace).not.toContain('<article className="homepage-workspace-answer"');
  });
});
