import type { MetadataRoute } from "next";

import { localizedPath } from "../lib/i18n";
import { publicRoutes, siteConfig } from "../lib/site-config";

function absolute(path: string): string {
  return `${siteConfig.origin}${path === "/" ? "" : path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.flatMap((path) => {
    const ruPath = localizedPath("ru", path);
    const enPath = localizedPath("en", path);
    const alternates = {
      languages: {
        "ru-RU": absolute(ruPath),
        en: absolute(enPath),
        "x-default": absolute(ruPath),
      },
    };
    const shared = {
      changeFrequency: path === "/" ? "weekly" as const : "monthly" as const,
      priority: path === "/" ? 1 : path.startsWith("/marketplaces/") ? 0.8 : 0.7,
      alternates,
    };

    return [
      { url: absolute(ruPath), ...shared },
      { url: absolute(enPath), ...shared },
    ];
  });
}
