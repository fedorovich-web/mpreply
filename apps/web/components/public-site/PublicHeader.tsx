"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  alternateLocale,
  basePathFromLocalizedPath,
  localizedPath,
  type Locale,
} from "../../lib/i18n";
import { getSiteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";

const focusableSelector = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const menuId = useId();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = getSiteConfig(locale);
  const labels = copy[locale];
  const otherLocale = alternateLocale(locale);
  const languageHref = localizedPath(otherLocale, basePathFromLocalizedPath(pathname));
  const loginHref = localizedPath(locale, "/auth/login");
  const registerHref = localizedPath(locale, "/auth/register?intent=connect-marketplace");

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const desktopMedia = window.matchMedia("(min-width: 1041px)");
    document.body.style.overflow = "hidden";
    menuPanelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !menuPanelRef.current) return;
      const focusableElements = Array.from(menuPanelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.offsetParent !== null);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      if (!firstFocusable || !lastFocusable) return;

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    const handleDesktopLayout = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    desktopMedia.addEventListener("change", handleDesktopLayout);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      desktopMedia.removeEventListener("change", handleDesktopLayout);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const closeMenuAndRestoreFocus = () => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
  };

  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link
          className="public-brand"
          href={localizedPath(locale, "/")}
          aria-label={labels.homeLabel}
          onClick={closeMenu}
        >
          <PublicBrandMark />
          <span className="public-brand-copy"><strong>MPReply</strong></span>
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

        <div className="public-mobile-navigation">
          <button
            ref={menuTriggerRef}
            className="public-mobile-menu-trigger"
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? labels.closeMenu : labels.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
          </button>

          {menuOpen ? (
            <>
              <button
                className="public-mobile-menu-backdrop"
                type="button"
                aria-label={labels.closeMenu}
                onClick={closeMenuAndRestoreFocus}
              />
              <div className="public-mobile-menu-panel" id={menuId} ref={menuPanelRef}>
                <nav aria-label={labels.mobileNav}>
                  {config.navigation.map((item) => {
                    const active = isActiveNavigationItem(item.href, pathname);
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={closeMenu}>
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="public-mobile-menu-actions">
                  <Link className="button button-secondary" href={languageHref} hrefLang={otherLocale} onClick={closeMenu}>
                    {otherLocale.toUpperCase()}
                  </Link>
                  <Link className="button button-secondary" href={loginHref} onClick={closeMenu}>{labels.login}</Link>
                  <Link className="button button-primary" href={registerHref} onClick={closeMenu}>
                    {labels.cta} →
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
