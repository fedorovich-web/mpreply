import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexablePublicRoutes } from "../../lib/site-config";

const root = process.cwd();
const privacy = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
const privacyEn = readFileSync(join(root, "app/en/privacy/page.tsx"), "utf8");
const terms = readFileSync(join(root, "app/terms/page.tsx"), "utf8");
const termsEn = readFileSync(join(root, "app/en/terms/page.tsx"), "utf8");
const sitemap = readFileSync(join(root, "app/sitemap.ts"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const footer = readFileSync(join(root, "components/public-site/PublicFooter.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("public legal and global truth contract", () => {
  it("keeps legal pages explicitly draft-only until final legal review", () => {
    expect(privacy).toContain("Юридический черновик");
    expect(privacy).toContain("До коммерческого запуска требуется юридическая финализация");
    expect(privacyEn).toMatch(/legal draft/i);
    expect(privacyEn).toContain("Legal finalization is required before commercial launch");
    expect(terms).toMatch(/Черновик до заполнения реквизитов.*финальной юридической проверки/);
    expect(terms).toContain("Не является финальной офертой");
    expect(termsEn).toContain("Draft pending completion of the contracting-party details and final legal review");
    expect(termsEn).toContain("This is not a final commercial offer or contract");
  });

  it("keeps legal drafts out of indexing and the sitemap until finalization", () => {
    for (const source of [privacy, privacyEn, terms, termsEn]) {
      expect(source).toContain("indexable: false");
    }
    expect(sitemap).toContain("indexablePublicRoutes.flatMap");
    expect(indexablePublicRoutes).not.toContain("/privacy");
    expect(indexablePublicRoutes).not.toContain("/terms");
  });

  it("uses the verified support channel on legal pages", () => {
    expect(siteConfig).toContain('contactEmail: configuredContactEmail || "support@mpreply.ru"');
    expect(privacy).toContain("siteConfig.contactEmail");
    expect(privacyEn).toContain("siteConfig.contactEmail");
    expect(terms).toContain("siteConfig.contactEmail");
    expect(termsEn).toContain("siteConfig.contactEmail");
  });

  it("does not publish unverified support details in either footer", () => {
    for (const value of [
      "Пн — Пт, 9:00 — 18:00",
      "09:00–18:00",
      "Майкоп",
      "ул. Чкалова",
      "помещение 17А",
    ]) {
      expect(footer + publicShell).not.toContain(value);
    }
  });

  it("does not advertise placeholder public sections from the homepage footer", () => {
    for (const value of ["Статус сервисов", ">О нас<", ">Партнёрам<", ">Вакансии<", ">Кейсы<"]) {
      expect(footer).not.toContain(value);
    }
  });

  it("uses one shared footer with distinct real public routes", () => {
    expect(publicShell).toContain("<PublicFooter locale={locale} />");
    for (const value of [
      'className="home-reference-footer"',
      'className="public-container home-reference-footer-grid"',
      'href={path("/demo")}',
      'href={path("/help")}',
      'href={path("/contacts")}',
      'href={path("/privacy")}',
      'href={path("/terms")}',
    ]) {
      expect(footer).toContain(value);
    }
    expect(footer).not.toContain('href={`${path("/help")}#faq`}');
    expect(footer).not.toContain('href={`${path("/help")}#start`}');
  });

  it("does not turn legal drafts into technical telemetry documentation", () => {
    for (const value of ["Marketplace credentials", "AI usage:", "latency", "cost estimate", "tenant isolation"]) {
      expect(privacy).not.toContain(value);
    }
  });
});
