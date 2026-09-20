import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const publicFiles = [
  "app/page.tsx",
  "app/features/page.tsx",
  "app/marketplaces/page.tsx",
  "app/marketplaces/wildberries/page.tsx",
  "app/marketplaces/ozon/page.tsx",
  "app/marketplaces/yandex-market/page.tsx",
  "app/marketplaces/avito/page.tsx",
  "app/pricing/page.tsx",
  "app/demo/page.tsx",
  "app/help/page.tsx",
  "app/contacts/page.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/not-found.tsx",
  "components/public-site/HomeApprovedShell.tsx",
  "components/public-site/PublicShell.tsx",
  "components/public-site/PublicHeader.tsx",
  "components/public-site/MarketplaceLanding.tsx",
  "lib/site-config.ts",
  "lib/marketplace-detail-content.ts",
] as const;

const sources = new Map(
  publicFiles.map((file) => [file, readFileSync(join(root, file), "utf8")]),
);

const globalForbidden = [
  "help@mpreply.ru",
  "Написать в Telegram",
  ">Блог<",
  "г. Майкоп",
  "ул. Чкалова",
  "помещение 17А",
  "09:00–18:00",
  "Пн — Пт, 9:00 — 18:00",
  "Ответ в рабочее время",
  "Интеграция готова",
  "четыре готовые интеграции",
  "Статус сервисов",
  ">О нас<",
  ">Партнёрам<",
  ">Вакансии<",
] as const;

const forbiddenOutsideApprovedHomepage = [
  "GPT-5.6",
  "Claude Sonnet 5",
  "Gemini 3.8",
  "DeepSeek V4.1 Flash",
  "-70% времени",
] as const;

describe("cross-site public truth contract", () => {
  it("keeps removed contacts, channels and placeholder sections out of public source", () => {
    for (const [file, source] of sources) {
      for (const value of globalForbidden) {
        expect(source, `${file} contains forbidden public value: ${value}`).not.toContain(value);
      }
    }
  });

  it("does not spread homepage-only approved screenshot claims to internal pages", () => {
    for (const [file, source] of sources) {
      if (file === "app/page.tsx") continue;

      for (const value of forbiddenOutsideApprovedHomepage) {
        expect(source, `${file} contains homepage-only claim: ${value}`).not.toContain(value);
      }
    }
  });

  it("keeps the verified support address centralized", () => {
    expect(sources.get("lib/site-config.ts")).toContain(
      'contactEmail: configuredContactEmail || "support@mpreply.ru"',
    );
  });

  it("keeps public navigation free of a blog route", () => {
    const config = sources.get("lib/site-config.ts") ?? "";
    const homeShell = sources.get("components/public-site/HomeApprovedShell.tsx") ?? "";

    expect(config).not.toContain('href: "/blog"');
    expect(homeShell).not.toContain('href: "/blog"');
  });
});
