import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const themePath = join(root, "styles/brand-theme.css");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const theme = existsSync(themePath) ? readFileSync(themePath, "utf8") : "";

describe("shared MPReply brand theme", () => {
  it("loads one blue brand system for dashboard and public pages", () => {
    expect(layout).toContain('import "../styles/brand-theme.css"');
    expect(theme).toContain(":root");
    expect(theme).toContain("--color-brand-primary: #2563eb");
    expect(theme).toContain("--color-brand-primary-active: #1e40af");
    expect(theme).toContain("--color-brand-accent: #0ea5e9");
    expect(theme).toContain("--color-bg-brand-soft: #eff6ff");
    expect(theme).toContain("--app-nav-active-bg: #eff6ff");
  });

  it("keeps dark mode in the same blue family instead of purple and mint", () => {
    expect(theme).toContain("[data-theme='dark']");
    expect(theme).toMatch(/\[data-theme='dark'\][\s\S]*--color-brand-primary:\s*#60a5fa/);
    expect(theme).not.toMatch(/#ad72dc|#7ad9b2|#6f33ab|#79d6b0/i);
  });
});
