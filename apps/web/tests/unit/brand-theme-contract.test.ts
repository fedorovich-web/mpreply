import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const themePath = join(root, "styles/brand-theme.css");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const globals = readFileSync(join(root, "styles/globals.css"), "utf8");
const theme = existsSync(themePath) ? readFileSync(themePath, "utf8") : "";
const homepage = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");
const marketingPages = readFileSync(join(root, "styles/marketing-pages.css"), "utf8");

describe("shared MPReply brand theme", () => {
  it("loads one blue brand system for dashboard and public pages", () => {
    expect(layout).toContain('import "../styles/brand-theme.css"');
    expect(globals).not.toContain("@import './theme.css'");
    expect(theme).toContain(":root");
    expect(theme).toContain("--color-brand-primary: #2563eb");
    expect(theme).toContain("--color-brand-primary-strong: #1d4ed8");
    expect(theme).toContain("--color-brand-deep: #1e40af");
    expect(theme).toContain("--color-brand-accent: #0ea5e9");
    expect(theme).toContain("--color-brand-accent-soft: #7dd3fc");
    expect(theme).toContain("--color-bg-brand-soft: #eff6ff");
    expect(theme).toContain("--app-nav-active-bg: #eff6ff");
  });

  it("centralizes repeated card and public rhythm primitives", () => {
    expect(theme).toContain("--shadow-card:");
    expect(theme).toContain("--radius-card:");
    expect(theme).toContain("--radius-panel:");
    expect(theme).toContain("--space-section-public:");
    expect(theme).toContain("--color-surface-cool:");
    expect(theme).toContain("--color-border-card:");
  });

  it("keeps page layers from redefining the primary brand palette", () => {
    expect(homepage).not.toContain("--homepage-blue: #1167f1");
    expect(homepage).not.toContain("--homepage-blue-deep: #0a46c7");
    expect(homepage).not.toContain("--homepage-ink: #071846");
    expect(marketingPages).not.toContain("#1d4ed8");
  });

  it("keeps dark mode in the same blue family instead of purple and mint", () => {
    expect(theme).toContain("[data-theme='dark']");
    expect(theme).toMatch(/\[data-theme='dark'\][\s\S]*--color-brand-primary:\s*#60a5fa/);
    expect(theme).not.toMatch(/#ad72dc|#7ad9b2|#6f33ab|#79d6b0/i);
  });
});
