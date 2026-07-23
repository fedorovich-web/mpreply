export type MarketplaceKey = "wildberries" | "ozon" | "yandex-market" | "avito";

export type MarketplaceConfig = {
  key: MarketplaceKey;
  name: string;
  shortName: string;
  path: string;
  summary: string;
};

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

export const siteConfig = {
  name: "MP Reply",
  origin: configuredOrigin || "https://mpreply.ru",
  contactEmail: configuredContactEmail,
  description:
    "MP Reply автоматически готовит и публикует ИИ-ответы на отзывы, вопросы и чаты маркетплейсов с учётом карточки товара, базы знаний и правил продавца.",
  navigation: [
    { href: "/features", label: "Возможности" },
    { href: "/marketplaces", label: "Маркетплейсы" },
    { href: "/pricing", label: "Цены" },
    { href: "/blog", label: "Блог" },
    { href: "/about", label: "О нас" },
  ],
} as const;

export const marketplaces: MarketplaceConfig[] = [
  {
    key: "wildberries",
    name: "Wildberries",
    shortName: "WB",
    path: "/marketplaces/wildberries",
    summary:
      "Автоматические ИИ-ответы на отзывы и вопросы покупателей Wildberries с проверкой карточки товара и правил продавца.",
  },
  {
    key: "ozon",
    name: "Ozon",
    shortName: "Ozon",
    path: "/marketplaces/ozon",
    summary:
      "Автоматические ИИ-ответы на отзывы, вопросы и чаты Ozon с учётом карточки товара, контекста диалога и правил автопубликации.",
  },
  {
    key: "yandex-market",
    name: "Яндекс Маркет",
    shortName: "ЯМ",
    path: "/marketplaces/yandex-market",
    summary:
      "ИИ-ответы на отзывы и вопросы Яндекс Маркета с проверкой характеристик товара, базы знаний и ограничений продавца.",
  },
  {
    key: "avito",
    name: "Авито",
    shortName: "Avito",
    path: "/marketplaces/avito",
    summary:
      "Автоматические ИИ-ответы на отзывы и чаты Авито с сохранением контекста диалога и правилами публикации продавца.",
  },
];

export function getMarketplaceConfig(key: MarketplaceKey): MarketplaceConfig {
  const marketplace = marketplaces.find((item) => item.key === key);

  if (!marketplace) {
    throw new Error(`Marketplace configuration is missing: ${key}`);
  }

  return marketplace;
}

export const publicRoutes = [
  "/",
  "/features",
  "/marketplaces",
  "/marketplaces/wildberries",
  "/marketplaces/ozon",
  "/marketplaces/yandex-market",
  "/marketplaces/avito",
  "/pricing",
  "/demo",
  "/blog",
  "/about",
  "/resources",
  "/privacy",
  "/terms",
  "/contacts",
] as const;
