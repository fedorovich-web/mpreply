export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];

/** @public */
export const defaultLocale: Locale = "ru";
export const localeRequestHeader = "x-mpreply-locale";

function isLocale(value: string | null | undefined): value is Locale {
  return value === "ru" || value === "en";
}

export function localeFromPathname(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ru";
}

export function localeFromRequestHeader(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function localizedPath(locale: Locale, path: string): string {
  const normalized = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;

  if (locale === "ru") return normalized;
  if (normalized === "/") return "/en";
  return `/en${normalized}`;
}

export function basePathFromLocalizedPath(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname || "/";
}

export function htmlLanguage(locale: Locale): "ru" | "en" {
  return locale;
}

export function openGraphLocale(locale: Locale): "ru_RU" | "en_US" {
  return locale === "ru" ? "ru_RU" : "en_US";
}

export function alternateLocale(locale: Locale): Locale {
  return locale === "ru" ? "en" : "ru";
}
