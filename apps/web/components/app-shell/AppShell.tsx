"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "../public-site/BrandLogo";
import { useWorkspace } from "../workspace/WorkspaceProvider";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard", description: "Сводка" },
  { href: "/app/inbox", label: "Inbox", description: "Отзывы и вопросы" },
  { href: "/app/review-queue", label: "Review Queue", description: "Ручная проверка" },
  { href: "/app/ai-assistant", label: "AI Assistant", description: "OpenRouter" },
  { href: "/app/automation-rules", label: "Automation Rules", description: "Auto + SafetyGate" },
  { href: "/app/integrations", label: "Integrations", description: "API-ключи" },
  { href: "/app/integrations/wildberries", label: "Wildberries", description: "MVP adapter" },
  { href: "/app/analytics", label: "Analytics", description: "Метрики и AI usage" },
  { href: "/app/billing", label: "Billing", description: "Тариф и лимиты" },
];

const upcomingItems = ["Templates", "Knowledge Base", "Team", "Settings", "Audit Log"];

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
    ? [...navItems, { href: "/app/admin", label: "Admin", description: "Internal overview" }]
    : navItems;

  return (
    <div className="app-shell">
      <aside className={isOpen ? "app-sidebar app-sidebar-open" : "app-sidebar"} aria-label="Основная навигация">
        <div className="app-sidebar-brand">
          <Link href="/app/dashboard" className="app-logo" aria-label="MPReply dashboard">
            <BrandLogo
              className="app-brand-logo"
              imageClassName="app-brand-logo-image"
              alt=""
              priority
            />
            <small>Seller AI ops</small>
          </Link>
        </div>

        <nav className="app-nav" aria-label="Разделы dashboard">
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

        <div className="app-sidebar-section" aria-label="Следующие разделы">
          <span className="app-sidebar-caption">Следующие спринты</span>
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
            aria-label="Открыть меню dashboard"
            className="app-menu-button"
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          <div className="app-topbar-title">
            <span>Auto-first workspace</span>
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
