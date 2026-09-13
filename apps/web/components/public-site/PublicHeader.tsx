"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { siteConfig } from "../../lib/site-config";
import { ThemeToggle } from "./ThemeToggle";

function isActiveNavigationItem(href: string, pathname: string): boolean {
  if (href.includes("#")) {
    return false;
  }

  if (href === "/marketplaces") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return pathname === href;
}

export function PublicHeader() {
  const pathname = usePathname();
  const menuId = useId();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeMenu, menuOpen]);

  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link className="public-brand" href="/" aria-label="Respio — главная" onClick={closeMenu}>
          <span className="public-brand-mark" aria-hidden="true">
            R
          </span>
          <span className="public-brand-copy">
            <strong>Respio</strong>
            <small>Ответы для маркетплейсов</small>
          </span>
        </Link>

        <nav className="public-nav" aria-label="Основная навигация">
          {siteConfig.navigation.map((item) => {
            const active = isActiveNavigationItem(item.href, pathname);

            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="public-header-actions">
          <ThemeToggle />
          <Link className="button button-ghost public-login-link" href="/auth/login">
            Войти
          </Link>
          <Link className="button button-secondary public-header-cta" href="/demo">
            Открыть демо
          </Link>
        </div>

        <div className="public-mobile-navigation">
          <button
            ref={menuTriggerRef}
            className="public-mobile-menu-trigger"
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          {menuOpen ? (
            <>
              <button
                className="public-mobile-menu-backdrop"
                type="button"
                aria-label="Закрыть меню"
                onClick={() => closeMenu(true)}
              />
              <div className="public-mobile-menu-panel" id={menuId}>
                <nav aria-label="Мобильная навигация">
                  {siteConfig.navigation.map((item) => {
                    const active = isActiveNavigationItem(item.href, pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => closeMenu(true)}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="public-mobile-menu-actions">
                  <Link className="button button-secondary" href="/auth/login" onClick={() => closeMenu(true)}>
                    Войти
                  </Link>
                  <Link className="button button-primary" href="/demo" onClick={() => closeMenu(true)}>
                    Открыть демо
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
