import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const contacts = readFileSync(join(root, "app/contacts/page.tsx"), "utf8");
const header = readFileSync(join(root, "components/public-site/PublicHeader.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const notFoundPath = join(root, "app/not-found.tsx");
const notFound = existsSync(notFoundPath) ? readFileSync(notFoundPath, "utf8") : "";
const renderCssPath = join(root, "styles/public-contact-404-render.css");
const renderCss = existsSync(renderCssPath) ? readFileSync(renderCssPath, "utf8") : "";

describe("public render fidelity contract", () => {
  it("keeps the contact page composition aligned with the supplied render", () => {
    for (const marker of [
      'className="contacts-render-page"',
      "Свяжитесь с нами",
      "Техническая поддержка",
      "Запросить демо",
      "Подключение",
      "Общие вопросы",
      "Напишите нам",
      "Единый адрес поддержки",
      "Безопасность",
      "Готовы обсудить подключение?",
      "<ContactMailForm",
    ]) {
      expect(contacts).toContain(marker);
    }
  });

  it("keeps contact truth while matching the render", () => {
    expect(contacts).toContain("siteConfig.contactEmail");
    expect(contacts).not.toContain("Telegram");
    expect(contacts).not.toContain("VK");
    expect(contacts).not.toContain("YouTube");
    expect(contacts).not.toContain("до 2 часов");
  });

  it("implements the supplied 404 composition as a real app-router not-found page", () => {
    expect(existsSync(notFoundPath)).toBe(true);
    for (const marker of [
      "404",
      "Страница не найдена",
      "/images/mpreply-404-illustration.webp",
      'href="/"',
      'href="/features"',
      'href="/pricing"',
      'href="/marketplaces"',
      'href="/help"',
      'href="/contacts"',
    ]) {
      expect(notFound).toContain(marker);
    }
  });

  it("uses the inner-page render CTA in the shared public header", () => {
    expect(header).toContain('const headerCtaLabel = "Попробовать бесплатно"');
  });

  it("loads the render-specific contact/404 CSS after the canonical inner blue layer and before homepage restore", () => {
    const innerBlue = 'import "../styles/public-inner-blue-reference.css";';
    const renderImport = 'import "../styles/public-contact-404-render.css";';
    const homepage = 'import "../styles/homepage-reference-restore.css";';
    expect(renderCss).toContain(".contacts-render-page");
    expect(renderCss).toContain(".not-found-render-page");
    expect(renderCss).toContain("#0b68f6");
    expect(layout.indexOf(renderImport)).toBeGreaterThan(layout.indexOf(innerBlue));
    expect(layout.indexOf(renderImport)).toBeLessThan(layout.indexOf(homepage));
  });
});
