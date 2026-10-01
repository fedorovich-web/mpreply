import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const entry = readFileSync(join(process.cwd(), "components/public-site/DemoEntry.tsx"), "utf8");
const shell = readFileSync(join(process.cwd(), "components/app-shell/AppShell.tsx"), "utf8");

describe("real demo workspace annotations", () => {
  it("explains view-only access before entering the actual cabinet in both locales", () => {
    expect(entry).toContain("Доступ только для просмотра");
    expect(entry).toContain("добавить ключи, изменить данные или отправить ответ нельзя");
    expect(entry).toContain("Access is view-only");
    expect(entry).toContain("you cannot add keys, change data, or send a reply");
  });
  it("keeps the demo restriction visible in the authenticated product", () => {
    expect(shell).toContain('const isDemo = user.status === "demo"');
    expect(shell).toContain('isDemo ? <div className="app-demo-banner" role="status"');
    expect(shell).toContain("Добавление ключей и отправка ответов отключены");
    expect(shell).toContain("Adding keys and sending replies are disabled");
  });
});
