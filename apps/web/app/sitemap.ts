import type { MetadataRoute } from "next";

import { listPublishedContent } from "../lib/cms/client";
import { contentPath } from "../lib/cms/presentation";
import { publicRoutes, siteConfig } from "../lib/site-config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((path) => ({
    url: `${siteConfig.origin}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path.startsWith("/marketplaces/") ? 0.8 : 0.7,
  }));

  try {
    const content = await listPublishedContent();
    if (!content) {
      return staticEntries;
    }
    const dynamicEntries = content
      .filter((item) => !item.seo.noindex)
      .map((item) => ({
        url: `${siteConfig.origin}${contentPath(item.kind, item.slug)}`,
        lastModified: new Date(item.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    return [...staticEntries, ...dynamicEntries];
  } catch {
    return staticEntries;
  }
}
