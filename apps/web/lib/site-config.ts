export type MarketplaceKey = "wildberries" | "ozon" | "yandex-market" | "avito";

export type MarketplaceConfig = {
  key: MarketplaceKey;
  name: string;
  shortName: string;
  path: string;
  status: "supported";
  statusLabel: string;
  summary: string;
};

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

export const siteConfig = {
  name: "MPReply",
  origin: configuredOrigin || "https://mpreply.ru",
  contactEmail: configuredContactEmail,
  description:
    "MPReply собирает обращения покупателей с маркетплейсов в одном окне, готовит ответы с помощью ИИ и автоматизирует отправку с контролем рискованных случаев.",
  navigation: [
    { href: "/#product", label: "Продукт" },
    { href: "/features", label: "Возможности" },
    { href: "/marketplaces", label: "Маркетплейсы" },
    { href: "/#how-it-works", label: "Как работает" },
    { href: "/pricing", label: "Тарифы" },
    { href: "/resources", label: "Материалы" },
  ],
} as const;

export const marketplaces: MarketplaceConfig[] = [
  {
    key: "wildberries",
    name: "Wildberries",
    shortName: "WB",
    path: "/marketplaces/wildberries",
    status: "supported",
    statusLabel: "Поддерживается",
    summary:
      "Получение обращений, подготовка ответов, контроль перед отправкой и автоматизация повторяющихся сценариев через единый рабочий процесс.",
  },
  {
    key: "ozon",
    name: "Ozon",
    shortName: "Ozon",
    path: "/marketplaces/ozon",
    status: "supported",
    statusLabel: "Поддерживается",
    summary:
      "Работа с обращениями покупателей Ozon в общей очереди MPReply: контекст, ИИ-ответ, проверка правил и отправка через интеграционный адаптер.",
  },
  {
    key: "yandex-market",
    name: "Яндекс Маркет",
    shortName: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    status: "supported",
    statusLabel: "Поддерживается",
    summary:
      "Обращения Яндекс Маркета приводятся к единому формату, чтобы команда работала с ними по тем же правилам, что и с другими площадками.",
  },
  {
    key: "avito",
    name: "Авито",
    shortName: "Авито",
    path: "/marketplaces/avito",
    status: "supported",
    statusLabel: "Поддерживается",
    summary:
      "Интеграция Авито подключена к общей модели обработки: единая очередь, ИИ-подготовка ответа, правила, статусы и история действий.",
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
  "/resources",
  "/privacy",
  "/terms",
  "/contacts",
] as const;
