import type { MetadataRoute } from "next";

import { publicRoutes, siteConfig } from "../lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((path) => ({
    url: `${siteConfig.origin}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path.startsWith("/marketplaces/") ? 0.8 : 0.7,
  }));
}
