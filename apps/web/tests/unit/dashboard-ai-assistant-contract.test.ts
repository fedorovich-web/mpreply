import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/ai-assistant/AIAssistantWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/ai-assistant/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-ai-assistant-approved.css"), "utf8");

describe("AI assistant operational workspace", () => {
  it("keeps generation and review handoff on live APIs", () => {
    expect(workspace).toContain('apiRequest("/api/ai/drafts/generate"');
    expect(workspace).toContain('apiRequest("/api/replies/manual"');
    expect(workspace).toContain("/submit-review");
    expect(workspace).toContain("ai_draft_id: draft.id");
  });

  it("keeps paginated source messages reachable beyond the first API page", () => {
    expect(workspace).toContain("const [messagePage, setMessagePage] = useState(1)");
    expect(workspace).toContain("page_size: aiMessagePageSize");
    expect(workspace).toContain('aria-label="Следующая страница обращений"');
    expect(styles).toContain(".ai-message-pagination");
  });

  it("keeps seller context, editable reply and clear next actions together", () => {
    expect(workspace).toContain("Ответ для проверки");
    expect(workspace).toContain("Подготовить другой вариант");
    expect(workspace).toContain("Передать на проверку");
    expect(workspace).toContain("Контекст и стиль");
    expect(workspace).toContain("Открыть очередь проверки");
    expect(workspace).not.toContain("Открыть модерацию");
    expect(workspace).not.toContain("worker pipeline");
    expect(workspace).not.toContain("SafetyGate");
  });

  it("uses the approved blue dashboard layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-ai-assistant-approved.css"');
    expect(styles).toContain(".ai-assistant-page");
    expect(styles).toContain(".ai-workspace-grid");
    expect(styles).toContain(".ai-draft-editor-field");
    expect(styles).toContain(".ai-draft-actions");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("frames the page around the seller workflow", () => {
    expect(page).toContain("Подготовьте ответ и передайте его на проверку");
    expect(page).toContain("обращение, контекст и готовый текст остаются в одном рабочем пространстве");
  });
});