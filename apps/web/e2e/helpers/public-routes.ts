export const PUBLIC_ROUTES = [
  "/", "/features", "/marketplaces", "/marketplaces/wildberries", "/marketplaces/ozon",
  "/marketplaces/yandex-market", "/marketplaces/avito", "/pricing", "/demo", "/resources",
  "/contacts", "/privacy", "/terms",
] as const;

export const VISUAL_ROUTES = [
  { path: "/", slug: "home" },
  { path: "/features", slug: "features" },
  { path: "/marketplaces", slug: "marketplaces" },
  { path: "/pricing", slug: "pricing" },
  { path: "/demo", slug: "demo" },
] as const;
