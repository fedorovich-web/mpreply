export type MarketplaceKey = "wildberries" | "ozon" | "yandex-market" | "avito";

const marketplaceStatusLabel = "Интеграция MPReply";

export type MarketplaceConfig = {
  key: MarketplaceKey;
  name: string;
  shortName: string;
  mark: string;
  path: string;
  statusLabel: typeof marketplaceStatusLabel;
  summary: string;
};

type MarketplaceDefinition = Omit<MarketplaceConfig, "statusLabel">;

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

export const siteConfig = {
  name: "MPReply",
  origin: configuredOrigin || "https://mpreply.ru",
  contactEmail: configuredContactEmail || "support@mpreply.ru",
  description:
    "MPReply собирает обращения покупателей с маркетплейсов в одном окне, готовит ответы с помощью ИИ и автоматизирует отправку с контролем сложных случаев.",
  navigation: [
    { href: "/features", label: "Возможности" },
    { href: "/marketplaces", label: "Интеграции" },
    { href: "/pricing", label: "Тарифы" },
    { href: "/demo", label: "Демо" },
    { href: "/help", label: "Помощь" },
    { href: "/contacts", label: "Контакты" },
  ],
} as const;

const marketplaceDefinitions = [
  {
    key: "wildberries",
    name: "Wildberries",
    shortName: "WB",
    mark: "WB",
    path: "/marketplaces/wildberries",
    summary:
      "Отзывы и вопросы Wildberries в единой очереди: контекст товара, ИИ-черновик, контроль перед отправкой и автоматизация по правилам.",
  },
  {
    key: "ozon",
    name: "Ozon",
    shortName: "Ozon",
    mark: "OZ",
    path: "/marketplaces/ozon",
    summary:
      "Поддерживаемые обращения Ozon в общей очереди MPReply: доступный контекст, ИИ-черновик, статусы и контроль перед отправкой.",
  },
  {
    key: "yandex-market",
    name: "Яндекс Маркет",
    shortName: "Яндекс Маркет",
    mark: "М",
    path: "/marketplaces/yandex-market",
    summary:
      "Поддерживаемые обращения Яндекс Маркета приводятся к единому рабочему процессу со статусами, контекстом и проверкой перед отправкой.",
  },
  {
    key: "avito",
    name: "Авито",
    shortName: "Авито",
    mark: "A",
    path: "/marketplaces/avito",
    summary:
      "Поддерживаемые диалоги Авито в общей очереди MPReply: контекст объявления, ИИ-черновик, статусы и понятное следующее действие.",
  },
] satisfies MarketplaceDefinition[];

export const marketplaces: MarketplaceConfig[] = marketplaceDefinitions.map((marketplace) => ({
  ...marketplace,
  statusLabel: marketplaceStatusLabel,
}));

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
  "/help",
  "/privacy",
  "/terms",
  "/contacts",
] as const;
