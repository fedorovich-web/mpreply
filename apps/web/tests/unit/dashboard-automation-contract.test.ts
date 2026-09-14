import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/automation-rules/AutomationRulesWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/automation-rules/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-automation-approved.css"), "utf8");

describe("automation operational workspace", () => {
  it("keeps rule management on the existing live API", () => {
    expect(workspace).toContain('buildApiQuery("/api/automation-rules"');
    expect(workspace).toContain('apiRequest("/api/automation-rules"');
    expect(workspace).toContain("/api/automation-rules/${selectedRule.id}");
  });

  it("keeps write permissions explicit before actions are shown", () => {
    expect(workspace).toContain('const canWrite = role === "owner" || role === "admin"');
    expect(workspace).toContain("Только просмотр");
    expect(workspace).toContain("Создать правило");
    expect(workspace).toContain("Редактировать");
  });

  it("loads a scoped responsive automation layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-automation-approved.css"');
    expect(styles).toContain(".automation-page");
    expect(styles).toContain(".automation-live-layout");
    expect(styles).toContain(".automation-rule-row");
    expect(styles).toContain(".automation-detail-panel");
    expect(styles).toContain(".automation-action-success");
    expect(styles).toContain("var(--color-success-text)");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("frames automation as seller decisions instead of internal machinery", () => {
    expect(page).toContain("Определите, когда MPReply может отвечать автоматически");
    expect(page).toContain("условия, приоритет и уровень контроля");
    expect(page).not.toContain("pipeline");
  });
});
