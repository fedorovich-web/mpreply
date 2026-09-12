"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useWorkspace } from "../workspace/WorkspaceProvider";

const navItems = [
  { href: "/app/dashboard", label: "Обзор", description: "Главные показатели" },
  { href: "/app/inbox", label: "Обращения", description: "Отзывы, вопросы и сообщения" },
  { href: "/app/review-queue", label: "На проверке", description: "Ответы, где нужен человек" },
  { href: "/app/ai-assistant", label: "ИИ-ассистент", description: "Подготовка ответов" },
  { href: "/app/automation-rules", label: "Автоматизация", description: "Правила автоответов" },
  { href: "/app/integrations", label: "Интеграции", description: "Подключённые площадки" },
  { href: "/app/analytics", label: "Аналитика", description: "Обращения и ответы" },
  { href: "/app/billing", label: "Тариф и лимиты", description: "План и использование" },
];

const upcomingItems = ["Шаблоны", "База знаний", "Команда", "Настройки", "Журнал действий"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const {
    user,
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    logout,
    isLoggingOut,
  } = useWorkspace();
  const visibleNavItems = user.is_superadmin
    ? [...navItems, { href: "/app/admin", label: "Администрирование", description: "Системный обзор" }]
    : navItems;

  return (
    <div className="app-shell">
      <aside className={isOpen ? "app-sidebar app-sidebar-open" : "app-sidebar"} aria-label="Основная навигация">
        <div className="app-sidebar-brand">
          <Link href="/app/dashboard" className="app-logo" aria-label="Панель MPReply">
            <span className="app-logo-mark" aria-hidden="true">M</span>
            <span>
              <strong>MPReply</strong>
              <small>Работа с обращениями</small>
            </span>
          </Link>
        </div>

        <nav className="app-nav" aria-label="Разделы кабинета">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "app-nav-link app-nav-link-active" : "app-nav-link"}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-section" aria-label="Разделы в разработке">
          <span className="app-sidebar-caption">В разработке</span>
          <div className="app-upcoming-list">
            {upcomingItems.map((item) => (
              <span className="app-upcoming-item" key={item}>{item}</span>
            ))}
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <button
            aria-expanded={isOpen}
            aria-label="Открыть меню кабинета"
            className="app-menu-button"
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          <div className="app-topbar-title">
            <span>Рабочее пространство</span>
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
