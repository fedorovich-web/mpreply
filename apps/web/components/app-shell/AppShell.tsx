"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PublicBrandMark } from "../public-site/PublicBrandMark";
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

const focusableSelector = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
      { href: "/app/ai-assistant", label: "Ответы с ИИ", icon: "ai" },
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

const navIconSources: Record<NavIconName, string> = {
  overview: "/images/mockups/demo-icons/05-unified-queue-team.webp",
  inbox: "/images/mockups/features-icons/01-unified-inbox.webp",
  review: "/images/mockups/features-icons/03-quality-shield.webp",
  ai: "/images/mockups/features-icons/02-ai-sparkles.webp",
  automation: "/images/mockups/features-icons/04-auto-replies-lightning.webp",
  integrations: "/images/mockups/wildberries-icons/01-history-actions.webp",
  analytics: "/images/mockups/wildberries-icons/05-analytics.webp",
  billing: "/images/mockups/features-icons/05-templates-document.webp",
  admin: "/images/mockups/wildberries-icons/03-team-transparency.webp",
  help: "/images/mockups/demo-icons/02-context-document.webp",
};

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className="app-nav-icon-image"
      height={18}
      src={navIconSources[name]}
      width={18}
    />
  );
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
    const desktopMedia = window.matchMedia("(min-width: 861px)");
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusableElements = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(focusableSelector))
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
      if (event.matches) setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    desktopMedia.addEventListener("change", handleDesktopLayout);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      desktopMedia.removeEventListener("change", handleDesktopLayout);
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
            <PublicBrandMark />
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
          {organizations.length > 1 ? (
            <div className="app-mobile-workspace-switcher">
              <span className="app-nav-group-label">Компания</span>
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
            </div>
          ) : null}

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
            <span>{activeNavItem?.label ?? "Кабинет"}</span>
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
