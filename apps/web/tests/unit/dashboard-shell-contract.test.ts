import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/app-shell/AppShell.tsx"), "utf8");
const workspaceProvider = readFileSync(join(root, "components/workspace/WorkspaceProvider.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-shell-approved.css"), "utf8");

const requiredRoutes = [
  "/app/dashboard",
  "/app/inbox",
  "/app/review-queue",
  "/app/ai-assistant",
  "/app/automation-rules",
  "/app/integrations",
  "/app/analytics",
  "/app/billing",
];

const requiredLabels = [
  "Обзор",
  "Обращения",
  "На проверке",
  "Ответы с ИИ",
  "Автоматизация",
  "Интеграции",
  "Аналитика",
  "Тариф и лимиты",
];

describe("dashboard shell information architecture", () => {
  it("groups existing routes by task using the approved product navigation labels", () => {
    expect(shell).toContain('label: "Работа"');
    expect(shell).toContain('label: "Ответы и автоматизация"');
    expect(shell).toContain('label: "Управление"');

    for (const route of requiredRoutes) {
      expect(shell).toContain(`href: "${route}"`);
    }
    for (const label of requiredLabels) {
      expect(shell).toContain(`label: "${label}"`);
    }

    expect(shell).not.toContain('label: "Входящие"');
    expect(shell).not.toContain('label: "Модерация"');
    expect(shell).not.toContain('label: "ИИ-помощник"');
    expect(shell).not.toContain('label: "Правила"');
    expect(shell).not.toContain("description:");
  });

  it("reuses the canonical MPReply mark and approved raster icons in the persistent product shell", () => {
    expect(shell).toContain('import { PublicBrandMark } from "../public-site/PublicBrandMark"');
    expect(shell).toContain("<PublicBrandMark />");
    expect(shell).not.toContain("function BrandMark()");
    expect(shell).toContain("navIconSources");
    expect(shell).toContain("/images/mockups/features-icons/01-unified-inbox.webp");
    expect(shell).toContain("/images/mockups/wildberries-icons/05-analytics.webp");
    expect(shell).not.toContain("<svg");
    expect(styles).toContain(".app-logo .public-brand-mark");
    expect(styles).toContain(".app-nav-icon-image");
    expect(styles).not.toContain(".app-logo-mark");
    expect(styles).not.toContain(".app-brand-glyph");
  });

  it("keeps navigation state and workspace controls intact", () => {
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain("setActiveOrganizationId");
    expect(shell).toContain("activeOrganization.name");
    expect(shell).toContain("isLoggingOut");
    expect(shell).toContain("logout");
    expect(shell).toContain('href="/help"');
  });

  it("keeps the active workspace visible in the sidebar and switchable when needed", () => {
    expect(shell).toContain('className="app-sidebar-workspace"');
    expect(shell).toContain('className="app-workspace-avatar"');
    expect(shell).toContain("organizations.length > 1");
    expect(shell).toContain("setActiveOrganizationId(event.target.value)");
    expect(shell).toContain('aria-label="Выбрать рабочее пространство"');
    expect(shell).not.toContain('className="app-mobile-workspace-switcher"');
  });

  it("surfaces logout failures without an unhandled mutateAsync promise", () => {
    expect(workspaceProvider).toContain("logoutError");
    expect(workspaceProvider).toContain("logoutMutation.mutate()");
    expect(workspaceProvider).not.toContain("logoutMutation.mutateAsync()");
    expect(workspaceProvider).toContain("Не удалось выйти");
    expect(shell).toContain("logoutError");
    expect(shell).toContain('role="alert"');
    expect(styles).toContain(".app-logout-error");
  });

  it("loads a focused shell style layer instead of rewriting global workspace styles", () => {
    expect(layout).toContain('import "../styles/dashboard-shell-approved.css"');
    expect(styles).toContain(".app-nav-group");
    expect(styles).toContain(".app-nav-group-label");
    expect(styles).toContain(".app-nav-link-active");
    expect(styles).toContain(".app-help-link");
    expect(styles).toContain("@media (max-width: 860px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
