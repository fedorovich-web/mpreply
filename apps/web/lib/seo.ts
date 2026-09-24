import type { Metadata } from "next";

import {
  alternateLocale,
  localizedPath,
  openGraphLocale,
  type Locale,
} from "./i18n";
import { siteConfig } from "./site-config";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
  localized?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  locale = "ru",
  localized = false,
}: PageMetadataInput): Metadata {
  const canonical = localizedPath(locale, path);
  const otherLocale = alternateLocale(locale);

  return {
    title,
    description,
    alternates: {
      canonical,
      ...(localized
        ? {
            languages: {
              "ru-RU": localizedPath("ru", path),
              en: localizedPath("en", path),
              "x-default": localizedPath("ru", path),
            },
          }
        : {}),
    },
    openGraph: {
      type: "website",
      locale: openGraphLocale(locale),
      alternateLocale: localized ? [openGraphLocale(otherLocale)] : undefined,
      siteName: siteConfig.name,
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}
