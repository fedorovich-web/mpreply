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
  "components/inbox/InboxWorkspace.tsx",
  "components/review-queue/ReviewQueueWorkspace.tsx",
  "components/ai-assistant/AIAssistantWorkspace.tsx",
  "components/automation-rules/AutomationRulesWorkspace.tsx",
  "components/integrations/IntegrationsWorkspace.tsx",
  "components/integrations/WildberriesIntegrationWorkspace.tsx",
  "components/analytics/AnalyticsWorkspace.tsx",
  "components/billing/BillingWorkspace.tsx",
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
    const forbiddenCopy = [
      "Auto-first",
      "Auto by default",
      "worker pipeline",
      "backend-only",
      "Tenant scoped",
      "MVP adapter",
      "WB MVP",
      "Billing-ready foundation",
      "Live-сводка",
      "status updates",
      "semi-auto",
      "optimistic revision",
      "Не удалось загрузить Review Queue",
      "Reply editor",
      "SafetyGate ·",
      "Этот экран работает с live API",
      "Живой AI flow",
      "Обращение → AI-черновик → SafetyGate",
      "Ключ OpenRouter остаётся только на backend",
      "Inbox context",
      "Generate draft",
      "Результат и SafetyGate",
      "Safety flags отсутствуют",
      "Получаем доступные отзывы и вопросы workspace",
      "GET /api/messages",
      "Не удалось загрузить Inbox",
      "Review Queue",
      "backend API",
      "SafetyGate остаётся обязательным контрольным слоем",
      "изменение правил доступно owner и admin",
      "Как Respio выбирает режим ответа",
      "Решения SafetyGate",
      ">Allow<",
      ">Manual review<",
      ">Block<",
      "Live analytics",
      "AI usage",
      "OpenRouter usage",
      "Input tokens",
      "Output tokens",
      "Средняя latency",
      "Safety flags",
      "Current plan",
      "Код плана:",
      "Период usage",
      "Billing-ready",
      "hard limit",
      "unit economics",
      "Billing overview вернул пустой ответ",
      "Ключи остаются на backend",
      "frontend получает только маску fingerprint",
      "Backend RBAC остаётся security boundary",
      ">Accounts<",
      ">New account<",
      ">Selected account<",
      ">Settings<",
      ">Credentials<",
      "· requestId ",
    ];

    for (const token of forbiddenCopy) {
      expect(files).not.toContain(token);
    }
  });
});
