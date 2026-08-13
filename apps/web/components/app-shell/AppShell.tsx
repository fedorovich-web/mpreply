"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "../public-site/BrandLogo";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const primaryNavItems = [
  { href: "/app/dashboard", label: "Сводка" },
  { href: "/app/inbox", label: "Отзывы, вопросы и чаты" },
  { href: "/app/review-queue", label: "Ответы на проверке" },
];

const navGroups = [
  {
    label: "Настройка ответов",
    items: [
      { href: "/app/automation-rules", label: "Правила автоответов" },
      { href: "/app/instruction-sets", label: "Стиль ответов" },
      { href: "/app/knowledge-base", label: "Данные для ответов" },
    ],
  },
  {
    label: "Маркетплейсы",
    items: [
      { href: "/app/integrations", label: "Подключённые кабинеты" },
    ],
  },
  {
    label: "Отчёты",
    items: [
      { href: "/app/analytics", label: "Статистика ответов" },
    ],
  },
  {
    label: "Компания",
    items: [
      { href: "/app/team", label: "Сотрудники" },
      { href: "/app/settings", label: "Настройки" },
      { href: "/app/billing", label: "Тариф" },
      { href: "/app/audit-log", label: "История изменений" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const {
    user,
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    logout,
    isLoggingOut,
  } = useWorkspace();
  const visibleGroups = user.is_superadmin
    ? [...navGroups, { label: "Система", items: [{ href: "/app/admin", label: "Администрирование" }] }]
    : navGroups;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function closeNavigation(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  return (
    <div className="app-shell">
      <aside
        className={isOpen ? "app-sidebar app-sidebar-open" : "app-sidebar"}
        aria-label="Основная навигация"
        id="app-navigation"
      >
        <div className="app-sidebar-brand">
          <Link href="/app/dashboard" className="app-logo" aria-label="MP Reply — главная">
            <BrandLogo
              className="app-brand-logo"
              imageClassName="app-brand-logo-image"
              alt=""
              priority
            />
            <small>Ответы на маркетплейсах</small>
          </Link>
        </div>

        <div className="app-nav-groups">
          <nav className="app-nav app-nav-primary" aria-label="Основные разделы">
            {primaryNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={isActive ? "app-nav-link app-nav-link-active" : "app-nav-link"}
                  href={item.href}
                  key={item.href}
                  onClick={() => closeNavigation()}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {visibleGroups.map((group) => (
            <nav className="app-nav-group" aria-label={group.label} key={group.label}>
              <span className="app-nav-group-label">{group.label}</span>
              <div className="app-nav">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.label}
                      className={isActive ? "app-nav-link app-nav-link-active" : "app-nav-link"}
                      href={item.href}
                      key={item.href}
                      onClick={() => closeNavigation()}
                    >
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          ))}
        </div>
      </aside>

      {isOpen ? (
        <button
          aria-label="Закрыть навигацию"
          className="app-sidebar-backdrop"
          onClick={() => closeNavigation(true)}
          type="button"
        />
      ) : null}

      <div className="app-workspace">
        <header className="app-topbar">
          <button
            aria-expanded={isOpen}
            aria-controls="app-navigation"
            aria-label="Открыть навигацию"
            className="app-menu-button"
            onClick={() => setIsOpen((value) => !value)}
            ref={menuButtonRef}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          <div className="app-topbar-title">
            <span>Операционный кабинет</span>
            <strong>{activeOrganization.name}</strong>
          </div>

          <div className="app-topbar-controls">
            {organizations.length > 1 ? (
              <label className="workspace-selector">
                <span className="sr-only">Выбрать организацию</span>
                <select
                  aria-label="Выбрать организацию"
                  onChange={(event) => setActiveOrganizationId(event.target.value)}
                  value={activeOrganization.id}
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="app-topbar-user">
              <span className="app-status-dot" aria-hidden="true" />
              <span>
                <strong>{user.name || user.email}</strong>
                {user.name ? <small>{user.email}</small> : null}
              </span>
            </div>

            <button
              className="button button-secondary button-compact"
              disabled={isLoggingOut}
              onClick={() => void logout()}
              type="button"
            >
              {isLoggingOut ? "Выходим..." : "Выйти"}
            </button>
          </div>
        </header>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
