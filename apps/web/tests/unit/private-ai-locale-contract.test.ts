import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/ai-assistant/AIAssistantWorkspace.tsx"), "utf8");
const enPage = readFileSync(join(root, "app/en/app/ai-assistant/page.tsx"), "utf8");

describe("private AI assistant locale separation", () => {
  it("keeps one live AI reply workflow for RU and EN", () => {
    expect(workspace).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(workspace).toContain('buildApiQuery("/api/messages"');
    expect(workspace).toContain('buildApiQuery("/api/ai/drafts"');
    expect(workspace).toContain('apiRequest("/api/ai/drafts/generate"');
    expect(workspace).toContain('apiRequest("/api/replies/manual"');
    expect(workspace).toContain("/submit-review");
    expect(workspace).toContain('localizedPath(locale, "/app/review-queue")');
  });

  it("uses separate English and Russian copy without translating API values", () => {
    expect(workspace).toContain('workflowTitle: "Обращение → черновик → проверка"');
    expect(workspace).toContain('workflowTitle: "Customer message → draft → review"');
    expect(workspace).toContain('yandex: "Yandex Market"');
    expect(workspace).toContain('yandex: "Яндекс Маркет"');
  });

  it("provides a dedicated English AI route", () => {
    expect(enPage).toContain("<ScopedAIAssistantWorkspace />");
    expect(enPage).toContain('components/ai-assistant/ScopedAIAssistantWorkspace');
    expect(enPage).toContain("<h1>AI replies</h1>");
    expect(enPage).not.toMatch(/[А-Яа-яЁё]/);
  });
});
