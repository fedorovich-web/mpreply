"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { siteConfig } from "../../lib/site-config";

const focusableSelector = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isActiveNavigationItem(href: string, pathname: string): boolean {
  if (href.includes("#")) return false;
  if (href === "/marketplaces") return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

function BrandMark() {
  return (
    <span className="public-brand-mark" aria-hidden="true">
      <span className="public-brand-glyph"><i /><i /><i /></span>
    </span>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const menuId = useId();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
        <Link className="public-brand" href="/" aria-label="MPReply — главная" onClick={closeMenu}>
          <BrandMark />
          <span className="public-brand-copy"><strong>MPReply</strong></span>
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
          <Link className="button button-secondary public-login-link" href="/auth/login">Войти</Link>
          <Link className="button button-primary public-header-cta" href="/auth/register?intent=connect-marketplace">
            Создать аккаунт <span aria-hidden="true">→</span>
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
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
          </button>

          {menuOpen ? (
            <>
              <button className="public-mobile-menu-backdrop" type="button" aria-label="Закрыть меню" onClick={closeMenuAndRestoreFocus} />
              <div className="public-mobile-menu-panel" id={menuId} ref={menuPanelRef}>
                <nav aria-label="Мобильная навигация">
                  {siteConfig.navigation.map((item) => {
                    const active = isActiveNavigationItem(item.href, pathname);
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={closeMenu}>
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="public-mobile-menu-actions">
                  <Link className="button button-secondary" href="/auth/login" onClick={closeMenu}>Войти</Link>
                  <Link className="button button-primary" href="/auth/register?intent=connect-marketplace" onClick={closeMenu}>
                    Создать аккаунт →
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
