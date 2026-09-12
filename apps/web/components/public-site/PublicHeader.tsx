"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link className="public-brand" href="/" aria-label="MPReply — главная" onClick={closeMenu}>
          <span className="public-brand-mark" aria-hidden="true">
            M
          </span>
          <span className="public-brand-copy">
            <strong>MPReply</strong>
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
          <Link
            className="button button-primary public-header-cta"
            href="/auth/register?intent=connect-marketplace"
          >
            Создать аккаунт
          </Link>
        </div>

        <div className="public-mobile-navigation">
          <button
            className="public-mobile-menu-trigger"
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setMenuOpen((open) => !open)}
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
                onClick={closeMenu}
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
                        onClick={closeMenu}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="public-mobile-menu-actions">
                  <Link className="button button-secondary" href="/auth/login" onClick={closeMenu}>
                    Войти
                  </Link>
                  <Link
                    className="button button-primary"
                    href="/auth/register?intent=connect-marketplace"
                    onClick={closeMenu}
                  >
                    Создать аккаунт
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
