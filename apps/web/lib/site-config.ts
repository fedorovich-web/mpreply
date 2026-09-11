export type MarketplaceKey = "wildberries" | "ozon" | "yandex-market" | "avito";

export type MarketplaceConfig = {
  key: MarketplaceKey;
  name: string;
  shortName: string;
  path: string;
  status: "mvp" | "planned";
  statusLabel: string;
  summary: string;
};

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "support@mpreply.ru";

export const siteConfig = {
  name: "Respio",
  origin: configuredOrigin || "https://respio.ru",
  contactEmail: configuredContactEmail,
  description:
    "Respio автоматизирует ответы на отзывы и вопросы маркетплейсов: AI готовит ответ, SafetyGate проверяет риски, а спорные обращения уходят на ручную проверку.",
  navigation: [
    { href: "/#product", label: "Продукт" },
    { href: "/features", label: "Возможности" },
    { href: "/marketplaces", label: "Маркетплейсы" },
    { href: "/#safetygate", label: "SafetyGate" },
    { href: "/pricing", label: "Тарифы" },
    { href: "/resources", label: "Ресурсы" },
  ],
} as const;

export const marketplaces: MarketplaceConfig[] = [
  {
    key: "wildberries",
    name: "Wildberries",
    shortName: "WB",
    path: "/marketplaces/wildberries",
    status: "mvp",
    statusLabel: "MVP-интеграция",
    summary:
      "Импорт отзывов и вопросов, AI-черновики, SafetyGate, правила автоматизации и worker-backed отправка ответов.",
  },
  {
    key: "ozon",
    name: "Ozon",
    shortName: "Ozon",
    path: "/marketplaces/ozon",
    status: "planned",
    statusLabel: "Планируется",
    summary:
      "Интеграция будет включена после финальной проверки актуальных официальных API-контрактов и ограничений отправки ответов.",
  },
  {
    key: "yandex-market",
    name: "Яндекс Маркет",
    shortName: "Яндекс Маркет",
    path: "/marketplaces/yandex-market",
    status: "planned",
    statusLabel: "Планируется",
    summary:
      "Архитектура адаптера подготовлена; production-подключение будет открыто после проверки API и сценариев публикации ответов.",
  },
  {
    key: "avito",
    name: "Авито",
    shortName: "Авито",
    path: "/marketplaces/avito",
    status: "planned",
    statusLabel: "Планируется",
    summary:
      "Поддержка будет включена после подтверждения доступных официальных API-возможностей для нужных сценариев коммуникации.",
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
