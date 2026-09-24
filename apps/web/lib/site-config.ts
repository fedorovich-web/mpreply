import { localizedPath, type Locale } from "./i18n";

export type MarketplaceKey = "wildberries" | "ozon" | "yandex-market" | "avito";

const marketplaceStatusLabel = "Интеграция MPReply";
const marketplaceStatusLabelEn = "MPReply integration";

export type MarketplaceConfig = {
  key: MarketplaceKey;
  name: string;
  shortName: string;
  mark: string;
  path: string;
  statusLabel: string;
  summary: string;
};

type MarketplaceDefinition = Omit<MarketplaceConfig, "statusLabel" | "path"> & {
  path: string;
};

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

const shared = {
  name: "MPReply",
  origin: configuredOrigin || "https://mpreply.ru",
  contactEmail: configuredContactEmail || "support@mpreply.ru",
} as const;

export const siteConfigs = {
  ru: {
    ...shared,
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
  },
  en: {
    ...shared,
    description:
      "MPReply brings marketplace customer messages into one workspace, helps teams draft replies with AI, and automates routine responses with review controls.",
    navigation: [
      { href: "/en/features", label: "Features" },
      { href: "/en/marketplaces", label: "Integrations" },
      { href: "/en/pricing", label: "Pricing" },
      { href: "/en/demo", label: "Demo" },
      { href: "/en/help", label: "Help" },
      { href: "/en/contacts", label: "Contact" },
    ],
  },
} as const;

export const siteConfig = siteConfigs.ru;

export function getSiteConfig(locale: Locale) {
  return siteConfigs[locale];
}

const marketplaceDefinitionsRu = [
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

const marketplaceDefinitionsEn = [
  {
    key: "wildberries",
    name: "Wildberries",
    shortName: "WB",
    mark: "WB",
    path: "/marketplaces/wildberries",
    summary:
      "Bring supported Wildberries reviews and questions into one queue with product context, AI-assisted drafts, review controls, and rule-based automation.",
  },
  {
    key: "ozon",
    name: "Ozon",
    shortName: "Ozon",
    mark: "OZ",
    path: "/marketplaces/ozon",
    summary:
      "Handle supported Ozon customer messages in one MPReply queue with available context, AI-assisted drafts, workflow status, and review before sending.",
  },
  {
    key: "yandex-market",
    name: "Yandex Market",
    shortName: "Yandex Market",
    mark: "YM",
    path: "/marketplaces/yandex-market",
    summary:
      "Bring supported Yandex Market customer messages into one workflow with available context, status tracking, AI-assisted drafts, and review controls.",
  },
  {
    key: "avito",
    name: "Avito",
    shortName: "Avito",
    mark: "A",
    path: "/marketplaces/avito",
    summary:
      "Handle supported Avito buyer conversations in one queue with listing context, AI-assisted drafts, workflow status, and clear next actions.",
  },
] satisfies MarketplaceDefinition[];

function localizeMarketplace(
  definition: MarketplaceDefinition,
  locale: Locale,
  statusLabel: string,
): MarketplaceConfig {
  return {
    ...definition,
    path: localizedPath(locale, definition.path),
    statusLabel,
  };
}

export const marketplaces: MarketplaceConfig[] = marketplaceDefinitionsRu.map((marketplace) =>
  localizeMarketplace(marketplace, "ru", marketplaceStatusLabel),
);

export const marketplacesEn: MarketplaceConfig[] = marketplaceDefinitionsEn.map((marketplace) =>
  localizeMarketplace(marketplace, "en", marketplaceStatusLabelEn),
);

export function getMarketplaceConfig(key: MarketplaceKey, locale: Locale = "ru"): MarketplaceConfig {
  const collection = locale === "ru" ? marketplaces : marketplacesEn;
  const marketplace = collection.find((item) => item.key === key);

  if (!marketplace) {
    throw new Error(`Marketplace configuration is missing: ${key} (${locale})`);
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

export const indexablePublicRoutes = publicRoutes.filter(
  (path) => path !== "/privacy" && path !== "/terms",
);
