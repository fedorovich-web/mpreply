import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const privacy = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
const terms = readFileSync(join(root, "app/terms/page.tsx"), "utf8");
const homeShell = readFileSync(join(root, "components/public-site/HomeApprovedShell.tsx"), "utf8");
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("public legal and global truth contract", () => {
  it("keeps legal pages explicitly draft-only until final legal review", () => {
    expect(privacy).toContain("Legal draft");
    expect(privacy).toContain("До production-запуска требуется юридическая финализация");
    expect(terms).toContain("Legal draft");
    expect(terms).toContain("Не является финальной офертой");
  });

  it("uses the verified support channel on legal pages", () => {
    expect(siteConfig).toContain('contactEmail: configuredContactEmail || "support@mpreply.ru"');
    expect(privacy).toContain("siteConfig.contactEmail");
    expect(terms).toContain("siteConfig.contactEmail");
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
