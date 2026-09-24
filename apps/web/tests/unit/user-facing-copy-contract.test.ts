import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("user-facing copy", () => {
  it("keeps the Russian product interface human-readable", () => {
    const shell = source("components/app-shell/AppShell.tsx");
    const aiPage = source("app/app/ai-assistant/page.tsx");
    const aiWorkspace = source("components/ai-assistant/AIAssistantWorkspace.tsx");
    const analytics = source("components/analytics/AnalyticsWorkspace.tsx");
    const inbox = source("components/inbox/InboxWorkspace.tsx");

    expect(shell).toContain("Ответы с ИИ");
    expect(shell).not.toContain("ИИ-ассистент");
    expect(aiPage).not.toContain("ИИ-ассистент");
    expect(aiPage).not.toContain("рабочем пространстве");
    expect(aiWorkspace).not.toContain("код запроса");
    expect(aiWorkspace).not.toContain("очередь ручной проверки");
    expect(aiWorkspace).not.toContain("Уверенность ");
    expect(analytics).not.toContain("SKU ");
    expect(analytics).not.toContain("Без SKU");
    expect(inbox).not.toContain("Товар, SKU");
    expect(inbox).not.toContain("`SKU ${message.product.sku}`");
  });

  it("keeps public Russian copy free from implementation jargon", () => {
    const features = source("app/features/page.tsx");
    const contacts = source("app/contacts/page.tsx");
    const terms = source("app/terms/page.tsx");
    const privacy = source("app/privacy/page.tsx");

    expect(features).not.toContain("SKU");
    expect(contacts).not.toContain("API-ключи");
    for (const page of [terms, privacy]) {
      expect(page).not.toContain("Legal draft");
      expect(page).not.toContain("production");
      expect(page).not.toContain("SaaS");
      expect(page).not.toContain("чужих credentials");
      expect(page).not.toContain("Marketplace credentials");
      expect(page).not.toContain("scopes");
      expect(page).not.toContain("rate limits");
      expect(page).not.toContain("AI-");
    }
  });

  it("documents one plain-language standard for Russian and English copy", () => {
    const policy = source("../../docs/product/bilingual-copy-policy.md");

    expect(policy).toContain("Русская версия");
    expect(policy).toContain("English version");
    expect(policy).toContain("SEO");
    expect(policy).toContain("не буквальный перевод");
    expect(policy).toContain("not a literal translation");
  });
});
