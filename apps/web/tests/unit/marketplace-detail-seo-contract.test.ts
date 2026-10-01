import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const landing = readFileSync(join(root, "components/public-site/MarketplaceLanding.tsx"), "utf8");

const routes = [
  {
    slug: "wildberries",
    title: "Отзывы и вопросы Wildberries — ИИ-ответы и автоматизация",
    description:
      "MPReply собирает доступные отзывы и вопросы Wildberries в одну очередь, готовит ответы с контекстом товара и позволяет отправлять типовые ответы автоматически или после проверки.",
  },
  {
    slug: "ozon",
    title: "Обращения покупателей Ozon — единая очередь MPReply",
    description:
      "Посмотрите, как MPReply организует поддерживаемые обращения Ozon в одной очереди с доступным контекстом, ИИ-черновиками и контролем перед отправкой.",
  },
  {
    slug: "yandex-market",
    title: "Обращения Яндекс Маркета — единая очередь MPReply",
    description:
      "Посмотрите, как MPReply организует поддерживаемые обращения Яндекс Маркета в одном рабочем процессе с доступным контекстом, ИИ-черновиками и контролем перед отправкой.",
  },
  {
    slug: "avito",
    title: "Сообщения покупателей Авито — ИИ-ответы и контроль",
    description:
      "Собирайте поддерживаемые диалоги по объявлениям Авито в общей очереди MPReply, готовьте ответы с контекстом и оставляйте сложные сообщения на проверку менеджеру.",
  },
] as const;

function routeSource(slug: string, locale: "ru" | "en" = "ru") {
  const prefix = locale === "en" ? "app/en/marketplaces" : "app/marketplaces";
  return readFileSync(join(root, `${prefix}/${slug}/page.tsx`), "utf8");
}

describe("marketplace detail SEO metadata contract", () => {
  it("keeps one intent-specific title and description per marketplace", () => {
    for (const route of routes) {
      const source = routeSource(route.slug);
      expect(source).toContain(`title: \"${route.title}\"`);
      expect(source).toContain(route.description);
    }
  });

  it("keeps Ozon and Yandex metadata inside the later runtime-truth boundary", () => {
    expect(routeSource("ozon")).not.toContain("отзывы, вопросы и чаты Ozon");
    expect(routeSource("yandex-market")).not.toContain("Отзывы, вопросы и чаты Яндекс Маркета");
    expect(routeSource("ozon", "en")).toContain("Ozon customer messages — one MPReply queue");
    expect(routeSource("yandex-market", "en")).toContain("Yandex Market customer messages — one MPReply workflow");
  });

  it("does not use the old marketplace-name substitution title formula", () => {
    expect(routeSource("wildberries")).not.toContain("Автоответы на отзывы и вопросы Wildberries с ИИ");
    expect(routeSource("ozon")).not.toContain("Автоответы на отзывы и вопросы Ozon с ИИ");
  });

  it("keeps every marketplace route self-canonical through the shared SEO helper", () => {
    const seo = readFileSync(join(root, "lib/seo.ts"), "utf8");
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");

    expect(seo).toContain("const canonical = localizedPath(locale, path)");
    expect(seo).toContain("canonical,");
    expect(seo).toContain("url: canonical");
    expect(layout).toContain("metadataBase: new URL(siteConfig.origin)");

    for (const route of routes) {
      const source = routeSource(route.slug);
      expect(source).toContain("createPageMetadata({");
      expect(source).toContain(`path: \"/marketplaces/${route.slug}\"`);
    }
  });

  it("keeps public marketplace routes discoverable while private product routes stay non-indexable", () => {
    const sitemap = readFileSync(join(root, "app/sitemap.ts"), "utf8");
    const robots = readFileSync(join(root, "app/robots.ts"), "utf8");
    const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
    const appLayout = readFileSync(join(root, "app/app/layout.tsx"), "utf8");
    const authLayout = readFileSync(join(root, "app/auth/layout.tsx"), "utf8");

    expect(sitemap).toContain("indexablePublicRoutes.flatMap");
    expect(robots).toContain('disallow: ["/app/", "/auth/", "/en/app/", "/en/auth/"]');
    expect(appLayout).toContain("index: false");
    expect(authLayout).toContain("index: false");

    for (const route of routes) {
      expect(siteConfig).toContain(`\"/marketplaces/${route.slug}\"`);
    }
  });

  it("keeps localized marketplace BreadcrumbList JSON-LD aligned with real routes", () => {
    expect(landing).toContain('locale === "en" ? "/en/marketplaces" : "/marketplaces"');
    expect(landing).toContain('"@type": "BreadcrumbList"');
    expect(landing).toContain('type="application/ld+json"');
    expect(landing).toContain("siteConfig.origin");
    expect(landing).toContain("marketplace.path");
    expect(landing).toContain("`${siteConfig.origin}${marketplacesPath}`");
    expect(landing).not.toContain('"@type": "FAQPage"');
  });

  it("provides integrations and pricing navigation through the shared public shell", () => {
    const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
    const footer = readFileSync(join(root, "components/public-site/PublicFooter.tsx"), "utf8");
    expect(landing).toContain("<PublicShell locale={locale}>");
    expect(shell).toContain("<PublicFooter locale={locale} />");
    expect(footer).toContain('href={path("/marketplaces")}');
    expect(footer).toContain('href={path("/pricing")}');
    expect(footer).toContain('integrations: "Интеграции"');
    expect(footer).toContain('pricing: "Тарифы"');
    expect(landing).not.toContain(">Подробнее<");
  });
});
