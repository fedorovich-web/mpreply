import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const routes = [
  {
    slug: "wildberries",
    title: "Отзывы и вопросы Wildberries — ИИ-ответы и автоматизация",
    description:
      "MPReply собирает доступные отзывы и вопросы Wildberries в одну очередь, готовит ответы с контекстом товара и позволяет отправлять типовые ответы автоматически или после проверки.",
  },
  {
    slug: "ozon",
    title: "Обращения покупателей Ozon — отзывы, вопросы и чаты",
    description:
      "Собирайте поддерживаемые отзывы, вопросы и чаты Ozon в одной очереди MPReply, готовьте ответы с помощью ИИ и оставляйте сложные случаи на проверку менеджеру.",
  },
  {
    slug: "yandex-market",
    title: "Отзывы, вопросы и чаты Яндекс Маркета — единая очередь",
    description:
      "MPReply объединяет доступные отзывы, вопросы и чаты Яндекс Маркета в одном рабочем процессе с ИИ-черновиками и контролем перед отправкой.",
  },
  {
    slug: "avito",
    title: "Сообщения покупателей Авито — ИИ-ответы и контроль",
    description:
      "Собирайте поддерживаемые диалоги по объявлениям Авито в общей очереди MPReply, готовьте ответы с контекстом и оставляйте сложные сообщения на проверку менеджеру.",
  },
] as const;

function routeSource(slug: string) {
  return readFileSync(join(root, `app/marketplaces/${slug}/page.tsx`), "utf8");
}

describe("marketplace detail SEO metadata contract", () => {
  it("keeps one intent-specific title and description per marketplace", () => {
    for (const route of routes) {
      const source = routeSource(route.slug);
      expect(source).toContain(`title: \"${route.title}\"`);
      expect(source).toContain(route.description);
    }
  });

  it("does not use the old marketplace-name substitution title formula", () => {
    expect(routeSource("wildberries")).not.toContain("Автоответы на отзывы и вопросы Wildberries с ИИ");
    expect(routeSource("ozon")).not.toContain("Автоответы на отзывы и вопросы Ozon с ИИ");
  });

  it("keeps every marketplace route self-canonical through the shared SEO helper", () => {
    const seo = readFileSync(join(root, "lib/seo.ts"), "utf8");
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");

    expect(seo).toContain("canonical: path");
    expect(seo).toContain("url: path");
    expect(layout).toContain("metadataBase: new URL(siteConfig.origin)");

    for (const route of routes) {
      const source = routeSource(route.slug);
      expect(source).toContain("createPageMetadata({");
      expect(source).toContain(`path: \"/marketplaces/${route.slug}\"`);
    }
  });
});
