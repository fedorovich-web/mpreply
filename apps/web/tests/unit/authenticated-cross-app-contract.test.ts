import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const shell = read("components/app-shell/AppShell.tsx");
const inbox = read("components/inbox/InboxWorkspace.tsx");
const review = read("components/review-queue/ReviewQueueWorkspace.tsx");
const assistant = read("components/ai-assistant/AIAssistantWorkspace.tsx");
const admin = read("components/admin/AdminOverviewWorkspace.tsx");
const workspace = read("components/workspace/WorkspaceProvider.tsx");
const integrations = read("components/integrations/WildberriesIntegrationWorkspace.tsx");

describe("authenticated cross-app quality contract", () => {
  it("keeps navigation icons raster-only", () => {
    expect(shell).toContain("navIconSources");
    expect(shell).toContain(".webp");
    expect(shell).not.toContain("<svg");
  });

  it("keeps seller-facing failures human-readable instead of exposing raw exceptions", () => {
    expect(inbox).not.toContain("return error instanceof Error ? error.message");
    expect(assistant).not.toContain("return error instanceof Error && error.message");
    expect(admin).not.toContain("overviewQuery.error.message");
    expect(workspace).not.toContain("return error instanceof Error ? error.message");
    expect(review).toContain("return errorMessage(error)");
    expect(review).toContain("function internalErrorMessage");
  });

  it("uses seller terminology for product and connection details", () => {
    expect(review).toContain("Артикул:");
    expect(review).not.toContain("SKU ");
    expect(integrations).toContain('return labels[value] ?? "Нужна проверка"');
  });

  it("avoids technical synchronization wording in primary operational summaries", () => {
    const dashboard = read("components/dashboard/DashboardMetrics.tsx");
    expect(dashboard).toContain("проблем с последним обновлением");
    expect(dashboard).not.toContain("ошибки синхронизации");
    expect(inbox).toContain("после получения данных с подключённых площадок");
  });
});
