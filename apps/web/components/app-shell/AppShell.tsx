"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useWorkspace } from "../workspace/WorkspaceProvider";

type NavIconName =
  | "overview"
  | "inbox"
  | "review"
  | "ai"
  | "automation"
  | "integrations"
  | "analytics"
  | "billing"
  | "admin"
  | "help";

type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "work",
    label: "Работа",
    items: [
      { href: "/app/dashboard", label: "Обзор", icon: "overview" },
      { href: "/app/inbox", label: "Обращения", icon: "inbox" },
      { href: "/app/review-queue", label: "На проверке", icon: "review" },
    ],
  },
  {
    id: "answers",
    label: "Ответы и автоматизация",
    items: [
      { href: "/app/ai-assistant", label: "ИИ-ассистент", icon: "ai" },
      { href: "/app/automation-rules", label: "Автоматизация", icon: "automation" },
    ],
  },
  {
    id: "management",
    label: "Управление",
    items: [
      { href: "/app/integrations", label: "Интеграции", icon: "integrations" },
      { href: "/app/analytics", label: "Аналитика", icon: "analytics" },
      { href: "/app/billing", label: "Тариф и лимиты", icon: "billing" },
    ],
  },
];

const adminNavGroup: NavGroup = {
  id: "system",
  label: "Система",
  items: [{ href: "/app/admin", label: "Администрирование", icon: "admin" }],
};

function matchesRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark() {
  return (
    <span className="app-logo-mark" aria-hidden="true">
      <span className="app-brand-glyph"><i /><i /><i /></span>
    </span>
  );
}

function NavIcon({ name }: { name: NavIconName }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "overview":
      return <svg {...commonProps}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>;
    case "inbox":
      return <svg {...commonProps}><path d="M4 6.5h16v11H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></svg>;
    case "review":
      return <svg {...commonProps}><path d="M12 3.8 19 6v5.6c0 4.1-2.7 7.2-7 8.6-4.3-1.4-7-4.5-7-8.6V6z" /><path d="m8.7 12 2.1 2.1 4.5-4.5" /></svg>;
    case "ai":
      return <svg {...commonProps}><path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z" /><path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8z" /><path d="m6 14 .7 1.8 1.8.7-1.8.7L6 19l-.7-1.8-1.8-.7 1.8-.7z" /></svg>;
    case "automation":
      return <svg {...commonProps}><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="9" cy="7" r="2" fill="var(--color-bg-surface)" /><circle cx="15" cy="12" r="2" fill="var(--color-bg-surface)" /><circle cx="11" cy="17" r="2" fill="var(--color-bg-surface)" /></svg>;
    case "integrations":
      return <svg {...commonProps}><path d="M9.5 14.5 14.5 9.5" /><path d="M7.2 16.8 5.8 18.2a3 3 0 0 1-4.2-4.2l3.2-3.2A3 3 0 0 1 9 10" transform="translate(2 0)" /><path d="m14.8 7.2 1.4-1.4a3 3 0 1 1 4.2 4.2l-3.2 3.2A3 3 0 0 1 13 14" transform="translate(-2 0)" /></svg>;
    case "analytics":
      return <svg {...commonProps}><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19h18" /></svg>;
    case "billing":
      return <svg {...commonProps}><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M3.5 10h17M7 15h4" /></svg>;
    case "admin":
      return <svg {...commonProps}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7 7 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.7a7 7 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></svg>;
    case "help":
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M9.7 9.2a2.5 2.5 0 0 1 4.8 1c0 1.8-2.5 2-2.5 3.8M12 18h.01" /></svg>;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const {
    user,
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    logout,
    isLoggingOut,
    logoutError,
  } = useWorkspace();
  const visibleNavGroups = user.is_superadmin ? [...navGroups, adminNavGroup] : navGroups;
  const activeNavItem = visibleNavGroups
    .flatMap((group) => group.items)
    .find((item) => matchesRoute(pathname, item.href));

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled]), select")?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const closeDrawer = () => setIsOpen(false);
  const closeDrawerAndRestoreFocus = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
  };

  return (
    <div className="app-shell">
      <aside ref={sidebarRef} className={isOpen ? "app-sidebar app-sidebar-open" : "app-sidebar"} aria-label="Основная навигация">
        <div className="app-sidebar-brand">
          <Link href="/app/dashboard" className="app-logo" aria-label="Панель MPReply" onClick={closeDrawer}>
            <BrandMark />
            <span>
              <strong>MPReply</strong>
              <small>Работа с покупателями</small>
            </span>
          </Link>
        </div>

        <nav className="app-nav" aria-label="Разделы кабинета">
          {visibleNavGroups.map((group) => (
            <div className="app-nav-group" role="group" aria-labelledby={`app-nav-${group.id}`} key={group.id}>
              <span className="app-nav-group-label" id={`app-nav-${group.id}`}>{group.label}</span>
              <div className="app-nav-group-links">
                {group.items.map((item) => {
                  const isActive = matchesRoute(pathname, item.href);
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={isActive ? "app-nav-link app-nav-link-active" : "app-nav-link"}
                      href={item.href}
                      key={item.href}
                      onClick={closeDrawer}
                    >
                      <span className="app-nav-icon"><NavIcon name={item.icon} /></span>
                      <span className="app-nav-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <Link className="app-help-link" href="/help" onClick={closeDrawer}>
            <span className="app-nav-icon"><NavIcon name="help" /></span>
            <span><strong>Помощь</strong><small>База знаний и поддержка</small></span>
          </Link>
        </div>
      </aside>

      {isOpen ? (
        <button
          aria-label="Закрыть боковое меню"
          className="app-sidebar-backdrop"
          onClick={closeDrawerAndRestoreFocus}
          type="button"
        />
      ) : null}

      <div className="app-workspace">
        <header className="app-topbar">
          <button
            ref={menuTriggerRef}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Закрыть меню кабинета" : "Открыть меню кабинета"}
            className="app-menu-button"
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          <div className="app-topbar-title">
            <span>{activeNavItem?.label ?? "Рабочее пространство"}</span>
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

            <div className="app-logout-control">
              <button
                className="button button-secondary button-compact"
                disabled={isLoggingOut}
                onClick={logout}
                type="button"
              >
                {isLoggingOut ? "Выходим..." : "Выйти"}
              </button>
              {logoutError ? <span className="app-logout-error" role="alert">{logoutError}</span> : null}
            </div>
          </div>
        </header>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
