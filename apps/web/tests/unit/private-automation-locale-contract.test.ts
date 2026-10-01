import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/automation-rules/AutomationRulesWorkspace.tsx"), "utf8");
const enPage = readFileSync(join(root, "app/en/app/automation-rules/page.tsx"), "utf8");

describe("private automation rules locale separation", () => {
  it("keeps one CRUD workflow for both locales", () => {
    expect(workspace).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(workspace).toContain('buildApiQuery("/api/automation-rules"');
    expect(workspace).toContain('method: "POST"');
    expect(workspace).toContain('method: "PATCH"');
    expect(workspace).toContain('method: "DELETE"');
  });

  it("localizes labels without changing rule values or safety semantics", () => {
    expect(workspace).toContain('auto: "Автоматически"');
    expect(workspace).toContain('auto: "Automatic"');
    expect(workspace).toContain('semiAuto: "С проверкой перед отправкой"');
    expect(workspace).toContain('semiAuto: "Review before sending"');
    expect(workspace).toContain("rule.require_manual_review_on_flags");
    expect(workspace).toContain("rule.stop_on_missing_product_context");
    expect(workspace).toContain("rule.stop_on_low_confidence");
  });

  it("provides a dedicated English automation route", () => {
    expect(enPage).toContain("<AutomationRulesWorkspace />");
    expect(enPage).toContain("<h1>Automation</h1>");
    expect(enPage).not.toMatch(/[А-Яа-яЁё]/);
  });
});
