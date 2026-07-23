"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { BrandLogo } from "./BrandLogo";

const navigation = [
  { href: "/features", label: "Возможности", description: "Автоответы и правила" },
  { href: "/marketplaces", label: "Маркетплейсы", description: "WB, Ozon, ЯМ, Авито" },
  { href: "/pricing", label: "Цены", description: "Пакеты без подписки" },
  { href: "/blog", label: "Блог", description: "Гайды и разборы" },
  { href: "/about", label: "О нас", description: "Подход и принципы" },
] as const;

function isActiveNavigationItem(href: string, pathname: string): boolean {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeader() {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);


  useEffect(() => {
    if (!menuOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="public-header public-header-v86 public-header-v87 public-header-v88 public-header-v89 public-header-v90">
      <div className="public-container public-header-inner public-header-inner-v86 public-header-inner-v87 public-header-inner-v88 public-header-inner-v89 public-header-inner-v90">
        <Link className="public-brand public-brand-v86 public-brand-v87 public-brand-v88 public-brand-v89 public-brand-v90" href="/" aria-label="MP Reply — главная" onClick={closeMenu}>
          <BrandLogo
            className="public-brand-logo"
            imageClassName="public-brand-logo-image"
            alt=""
            priority
          />
        </Link>

        <nav className="public-nav public-nav-v86 public-nav-v87 public-nav-v88 public-nav-v89 public-nav-v90" aria-label="Основная навигация">
          <div className="public-nav-rail-v86 public-nav-rail-v87 public-nav-rail-v88 public-nav-rail-v89 public-nav-rail-v90">
            {navigation.map((item) => {
              const active = isActiveNavigationItem(item.href, pathname);
              return (
                <Link
                  className="public-nav-link-v86 public-nav-link-v87 public-nav-link-v88 public-nav-link-v89 public-nav-link-v90"
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="public-nav-link-dot-v86 public-nav-link-dot-v87 public-nav-link-dot-v88 public-nav-link-dot-v89 public-nav-link-dot-v90" aria-hidden="true" />
                  <span className="public-nav-link-label-v86 public-nav-link-label-v87 public-nav-link-label-v88 public-nav-link-label-v89 public-nav-link-label-v90">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="public-header-actions public-header-actions-v86 public-header-actions-v87 public-header-actions-v88 public-header-actions-v89 public-header-actions-v90">
          <Link className="button button-ghost public-login-link public-login-link-v86 public-login-link-v87 public-login-link-v88 public-login-link-v89 public-login-link-v90" href="/auth/login">Войти</Link>
          <Link className="button button-primary public-header-cta public-header-cta-v86 public-header-cta-v87 public-header-cta-v88 public-header-cta-v89 public-header-cta-v90" href="/contacts">
            Подключить маркетплейс
          </Link>
        </div>

        <div className="public-mobile-navigation public-mobile-navigation-v86 public-mobile-navigation-v87 public-mobile-navigation-v88 public-mobile-navigation-v89 public-mobile-navigation-v90">
          <button
            className="public-mobile-menu-trigger public-mobile-menu-trigger-v86 public-mobile-menu-trigger-v87 public-mobile-menu-trigger-v88 public-mobile-menu-trigger-v89 public-mobile-menu-trigger-v90"
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
                className="public-mobile-menu-backdrop public-mobile-menu-backdrop-v86 public-mobile-menu-backdrop-v87 public-mobile-menu-backdrop-v88 public-mobile-menu-backdrop-v89 public-mobile-menu-backdrop-v90"
                type="button"
                aria-label="Закрыть меню"
                onClick={closeMenu}
              />
              <div className="public-mobile-menu-panel public-mobile-menu-panel-v86 public-mobile-menu-panel-v87 public-mobile-menu-panel-v88 public-mobile-menu-panel-v89 public-mobile-menu-panel-v90" id={menuId}>
                <div className="public-mobile-menu-head-v86 public-mobile-menu-head-v87 public-mobile-menu-head-v88 public-mobile-menu-head-v89 public-mobile-menu-head-v90">
                  <div>
                    <span className="public-mobile-menu-kicker-v86 public-mobile-menu-kicker-v87 public-mobile-menu-kicker-v88 public-mobile-menu-kicker-v89 public-mobile-menu-kicker-v90">Навигация</span>
                    <strong>Быстрый переход</strong>
                  </div>
                  <button className="public-mobile-menu-close-v88 public-mobile-menu-close-v89 public-mobile-menu-close-v90" type="button" aria-label="Закрыть меню" onClick={closeMenu}>
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                  </button>
                </div>
                <nav className="public-mobile-menu-list-v86 public-mobile-menu-list-v87 public-mobile-menu-list-v88 public-mobile-menu-list-v89 public-mobile-menu-list-v90" aria-label="Мобильная навигация">
                  {navigation.map((item) => (
                    <Link
                      className="public-mobile-menu-link-v86 public-mobile-menu-link-v87 public-mobile-menu-link-v88 public-mobile-menu-link-v89 public-mobile-menu-link-v90"
                      key={item.href}
                      href={item.href}
                      aria-current={isActiveNavigationItem(item.href, pathname) ? "page" : undefined}
                      onClick={closeMenu}
                    >
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </Link>
                  ))}
                </nav>
                <div className="public-mobile-menu-actions public-mobile-menu-actions-v86 public-mobile-menu-actions-v87 public-mobile-menu-actions-v88 public-mobile-menu-actions-v89 public-mobile-menu-actions-v90">
                  <Link className="button button-secondary" href="/auth/login" onClick={closeMenu}>Войти</Link>
                  <Link className="button button-primary" href="/contacts" onClick={closeMenu}>
                    Подключить маркетплейс
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
