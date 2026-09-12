import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const files = [
  "components/app-shell/AppShell.tsx",
  "app/app/dashboard/page.tsx",
  "app/app/inbox/page.tsx",
  "app/app/review-queue/page.tsx",
  "app/app/ai-assistant/page.tsx",
  "app/app/automation-rules/page.tsx",
  "app/app/integrations/page.tsx",
  "app/app/analytics/page.tsx",
  "app/app/billing/page.tsx",
].map((path) => readFileSync(join(root, path), "utf8")).join("\n");

describe("dashboard product copy", () => {
  it("uses the MPReply product name and user-facing navigation language", () => {
    expect(files).toContain("MPReply");
    expect(files).toContain("Обращения");
    expect(files).toContain("На проверке");
    expect(files).toContain("Автоматизация");
    expect(files).toContain("Интеграции");
    expect(files).toContain("Аналитика");
    expect(files).toContain("Тариф и лимиты");
    expect(files).not.toContain("Respio");
  });

  it("does not expose implementation jargon as primary interface copy", () => {
    expect(files).not.toMatch(/Auto-first|Auto by default|SafetyGate|worker pipeline|backend-only|Tenant scoped|MVP adapter|WB MVP|OpenRouter|Billing-ready foundation|Live-сводка|status updates|semi-auto|optimistic revision/i);
  });
});
