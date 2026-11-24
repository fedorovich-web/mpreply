"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { buildApiUrl } from "../../lib/api/client";
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
    workspace: "В кабинет",
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
    workspace: "My workspace",
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
  const [signedIn, setSignedIn] = useState(false);
  const config = getSiteConfig(locale);
  const labels = copy[locale];
  const otherLocale = alternateLocale(locale);
  const languageHref = localizedPath(otherLocale, basePathFromLocalizedPath(pathname));
  const loginHref = appOrigin + localizedPath(locale, "/auth/login");
  const registerHref = appOrigin + localizedPath(locale, "/auth/register?intent=connect-marketplace");
  const workspaceHref = appOrigin + localizedPath(locale, "/app/dashboard");

  useEffect(() => {
    let pending: AbortController | undefined;
    const checkSession = async () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await fetch(buildApiUrl("/api/auth/session-status"), {
          credentials: "include",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2_500)]),
        });
        const payload: { authenticated?: boolean } | null = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setSignedIn(payload?.authenticated === true);
      } catch {
        if (!controller.signal.aborted) setSignedIn(false);
      }
    };
    const recheckOnRestore = (event: PageTransitionEvent) => {
      if (event.persisted) void checkSession();
    };
    void checkSession();
    window.addEventListener("pageshow", recheckOnRestore);
    return () => {
      pending?.abort();
      window.removeEventListener("pageshow", recheckOnRestore);
    };
  }, [pathname]);

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
          {!signedIn && <Link className="button button-secondary public-login-link" href={loginHref}>{labels.login}</Link>}
          <Link className="button button-primary public-header-cta" href={signedIn ? workspaceHref : registerHref}>
            {signedIn ? labels.workspace : labels.cta} <span aria-hidden="true">→</span>
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
          workspaceHref={signedIn ? workspaceHref : undefined}
        />
      </div>
    </header>
  );
}
