import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const privacy = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
const privacyEn = readFileSync(join(root, "app/en/privacy/page.tsx"), "utf8");
const terms = readFileSync(join(root, "app/terms/page.tsx"), "utf8");
const termsEn = readFileSync(join(root, "app/en/terms/page.tsx"), "utf8");
const sitemap = readFileSync(join(root, "app/sitemap.ts"), "utf8");
const homeShell = readFileSync(join(root, "components/public-site/HomeApprovedShell.tsx"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("public legal and global truth contract", () => {
  it("keeps legal pages explicitly draft-only until final legal review", () => {
    expect(privacy).toContain("Юридический черновик");
    expect(privacy).toContain("До коммерческого запуска требуется юридическая финализация");
    expect(privacyEn).toContain("Legal draft");
    expect(privacyEn).toContain("Legal finalization is required before commercial launch");
    expect(terms).toContain("Юридический черновик");
    expect(terms).toContain("Не является финальной офертой");
    expect(termsEn).toContain("Legal draft");
    expect(termsEn).toContain("This is not a final commercial offer or contract");
  });

  it("keeps legal drafts out of indexing and the sitemap until finalization", () => {
    for (const source of [privacy, privacyEn, terms, termsEn]) {
      expect(source).toContain("indexable: false");
    }
    expect(sitemap).toContain("indexablePublicRoutes.flatMap");
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
      expect(homeShell + publicShell).not.toContain(value);
    }
  });

  it("does not advertise placeholder public sections from the homepage footer", () => {
    for (const value of ["Статус сервисов", ">О нас<", ">Партнёрам<", ">Вакансии<", ">Кейсы<"]) {
      expect(homeShell).not.toContain(value);
    }
  });

  it("keeps the homepage footer on real public routes without changing its visual shell", () => {
    for (const value of [
      'className="home-reference-footer"',
      'className="home-reference-footer-grid"',
      'href="/demo">Демо',
      'href="/help">Помощь',
      'href="/contacts">Контакты',
      'href="/privacy">Политика конфиденциальности',
      'href="/terms">Условия использования',
    ]) {
      expect(homeShell).toContain(value);
    }
  });

  it("does not turn legal drafts into technical telemetry documentation", () => {
    for (const value of ["Marketplace credentials", "AI usage:", "latency", "cost estimate", "tenant isolation"]) {
      expect(privacy).not.toContain(value);
    }
  });
});
