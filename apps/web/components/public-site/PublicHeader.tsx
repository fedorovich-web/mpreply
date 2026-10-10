"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  alternateLocale,
  basePathFromLocalizedPath,
  localizedPath,
  type Locale,
} from "../../lib/i18n";
import { appOrigin, getSiteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";
import { PublicMobileNavigation } from "./PublicMobileNavigation";

const copy = {
  ru: {
    mainNav: "Основная навигация",
    mobileNav: "Мобильная навигация",
    closeMenu: "Закрыть меню",
    openMenu: "Открыть меню",
    login: "Войти",
    cta: "Попробовать бесплатно",
    homeLabel: "MPReply — главная",
    switchLanguage: "Switch to English",
  },
  en: {
    mainNav: "Main navigation",
    mobileNav: "Mobile navigation",
    closeMenu: "Close menu",
    openMenu: "Open menu",
    login: "Log in",
    cta: "Start free",
    homeLabel: "MPReply — home",
    switchLanguage: "Переключить на русский",
  },
} as const;

function isActiveNavigationItem(href: string, pathname: string): boolean {
  if (href.endsWith("/marketplaces")) return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

export function PublicHeader({ locale = "ru" }: { locale?: Locale }) {
  const pathname = usePathname();
  const config = getSiteConfig(locale);
  const labels = copy[locale];
  const otherLocale = alternateLocale(locale);
  const languageHref = localizedPath(otherLocale, basePathFromLocalizedPath(pathname));
  const loginHref = appOrigin + localizedPath(locale, "/auth/login");
  const registerHref = appOrigin + localizedPath(locale, "/auth/register?intent=connect-marketplace");

  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link
          className="public-brand"
          href={localizedPath(locale, "/")}
          aria-label={labels.homeLabel}
        >
          <PublicBrandMark />
        </Link>

        <nav className="public-nav" aria-label={labels.mainNav}>
          {config.navigation.map((item) => {
            const active = isActiveNavigationItem(item.href, pathname);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="public-header-actions">
          <Link
            className="button button-secondary public-language-link"
            href={languageHref}
            hrefLang={otherLocale}
            aria-label={labels.switchLanguage}
          >
            {otherLocale.toUpperCase()}
          </Link>
          <Link className="button button-secondary public-login-link" href={loginHref}>{labels.login}</Link>
          <Link className="button button-primary public-header-cta" href={registerHref}>
            {labels.cta} <span aria-hidden="true">→</span>
          </Link>
        </div>

        <PublicMobileNavigation
          items={config.navigation.map((item) => ({ ...item, active: isActiveNavigationItem(item.href, pathname) }))}
          labels={labels}
          languageHref={languageHref}
          languageHrefLang={otherLocale}
          languageLabel={otherLocale.toUpperCase()}
          loginHref={loginHref}
          registerHref={registerHref}
        />
      </div>
    </header>
  );
}
