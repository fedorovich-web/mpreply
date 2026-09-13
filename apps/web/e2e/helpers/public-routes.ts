import { publicRoutes } from "../../lib/site-config";

export const PUBLIC_ROUTES = publicRoutes;

export const VISUAL_ROUTES = [
  { path: "/", slug: "home" },
  { path: "/features", slug: "features" },
  { path: "/marketplaces", slug: "marketplaces" },
  { path: "/pricing", slug: "pricing" },
  { path: "/demo", slug: "demo" },
] as const;
