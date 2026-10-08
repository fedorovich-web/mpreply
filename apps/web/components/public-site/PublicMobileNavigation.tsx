"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type NavigationItem = { href: string; label: string; active?: boolean };

type PublicMobileNavigationProps = {
  items: readonly NavigationItem[];
  labels: {
    openMenu: string;
    closeMenu: string;
    mobileNav: string;
    login: string;
    cta: string;
  };
  languageHref: string;
  languageHrefLang: string;
  languageLabel: string;
  loginHref: string;
  registerHref: string;
};

const focusableSelector = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PublicMobileNavigation({
  items,
  labels,
  languageHref,
  languageHrefLang,
  languageLabel,
  loginHref,
  registerHref,
}: PublicMobileNavigationProps) {
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

      <button
        className="public-mobile-menu-backdrop"
        type="button"
        aria-label={labels.closeMenu}
        aria-hidden={!menuOpen}
        tabIndex={-1}
        data-open={menuOpen}
        onClick={closeMenuAndRestoreFocus}
      />
      <div
        className="public-mobile-menu-panel"
        id={menuId}
        ref={menuPanelRef}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        data-open={menuOpen}
      >
        <nav aria-label={labels.mobileNav}>
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} onClick={closeMenu}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="public-mobile-menu-actions">
          <Link className="button button-secondary" href={languageHref} hrefLang={languageHrefLang} onClick={closeMenu}>
            {languageLabel}
          </Link>
          <Link className="button button-secondary" href={loginHref} onClick={closeMenu}>{labels.login}</Link>
          <Link className="button button-primary" href={registerHref} onClick={closeMenu}>
            {labels.cta} →
          </Link>
        </div>
      </div>
    </div>
  );
}
