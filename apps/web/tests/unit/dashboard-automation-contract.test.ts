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

  it("uses plain seller-facing wording for confidence, conditions and errors", () => {
    expect(workspace).toContain("Насколько уверенным должен быть ответ");
    expect(workspace).toContain("Если встречаются слова");
    expect(workspace).toContain("Не применять при словах");
    expect(workspace).toContain("Темы, которые всегда нужно проверять");
    expect(workspace).toContain("Когда не отправлять автоматически");
    expect(workspace).toContain("Если ИИ не уверен в ответе");
    expect(workspace).not.toContain(">Порог уверенности<");
    expect(workspace).not.toContain("Защитные проверки");
    expect(workspace).not.toContain("рискованных сигналах");
    expect(workspace).not.toContain("выбранной рабочей области");
    expect(workspace).toContain("function userErrorMessage");
  });

  it("shows confidence as a percentage while keeping the API value unchanged", () => {
    expect(workspace).toContain("confidenceThreshold: String(Math.round(rule.confidence_threshold * 100))");
    expect(workspace).toContain("confidence_threshold: Number(state.confidenceThreshold) / 100");
    expect(workspace).toContain('min={0} max={100} step={1}');
  });

  it("keeps loaded rules visible through a failed refresh and supports mobile selection", () => {
    expect(workspace).toContain("rulesQuery.error && rulesQuery.data");
    expect(workspace).toContain("automation-refresh-error");
    expect(workspace).toContain("const detailPanelRef = useRef");
    expect(workspace).toContain("function selectRule");
    expect(workspace).toContain('window.matchMedia("(max-width: 1180px)")');
    expect(workspace).toContain("detailPanelRef.current?.scrollIntoView");
    expect(styles).toContain("scroll-margin-top:");
  });

  it("frames automation as seller decisions instead of internal machinery", () => {
    expect(page).toContain("<h1>Автоматизация</h1>");
    expect(page).toContain("Задайте условия и порядок применения правил");
    expect(page).not.toContain("status-badge");
    expect(page).not.toContain("pipeline");
  });
});
