import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/app-shell/AppShell.tsx"), "utf8");
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

describe("dashboard shell information architecture", () => {
  it("groups existing routes by task without changing their URLs", () => {
    expect(shell).toContain('label: "Работа"');
    expect(shell).toContain('label: "Ответы и автоматизация"');
    expect(shell).toContain('label: "Управление"');
    expect(shell).toContain('label: "Входящие"');
    expect(shell).toContain('label: "Модерация"');
    expect(shell).toContain('label: "ИИ-помощник"');

    for (const route of requiredRoutes) {
      expect(shell).toContain(`href: "${route}"`);
    }

    expect(shell).not.toContain("description:");
  });

  it("keeps navigation state and workspace controls intact", () => {
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain("setActiveOrganizationId");
    expect(shell).toContain("activeOrganization.name");
    expect(shell).toContain("isLoggingOut");
    expect(shell).toContain("logout");
    expect(shell).toContain('href="/help"');
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
