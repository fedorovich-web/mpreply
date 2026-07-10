"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard", description: "Сводка" },
  { href: "/app/inbox", label: "Inbox", description: "Отзывы и вопросы" },
  { href: "/app/review-queue", label: "Review Queue", description: "Ручная проверка" },
  { href: "/app/ai-assistant", label: "AI Assistant", description: "OpenRouter" },
  { href: "/app/automation-rules", label: "Automation Rules", description: "Auto + SafetyGate" },
  { href: "/app/integrations", label: "Integrations", description: "API-ключи" },
  { href: "/app/integrations/wildberries", label: "Wildberries", description: "MVP adapter" },
];

const upcomingItems = ["Templates", "Knowledge Base", "Analytics", "Team", "Billing"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={isOpen ? "app-sidebar app-sidebar-open" : "app-sidebar"} aria-label="Основная навигация">
        <div className="app-sidebar-brand">
          <Link href="/app/dashboard" className="app-logo" aria-label="Respio dashboard">
            <span className="app-logo-mark" aria-hidden="true">R</span>
            <span>
              <strong>Respio</strong>
              <small>Seller AI ops</small>
            </span>
          </Link>
        </div>

        <nav className="app-nav" aria-label="Разделы dashboard">
          {navItems.map((item) => {
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
            <strong>Автоответы включены по умолчанию</strong>
          </div>
          <div className="app-topbar-actions" aria-label="Статус workspace">
            <span className="app-status-dot" aria-hidden="true" />
            <span>MVP foundation</span>
          </div>
        </header>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
