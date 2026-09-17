import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const globals = readFileSync(join(root, "styles/globals.css"), "utf8");
const nativeTheme = readFileSync(join(root, "styles/theme.css"), "utf8");
const brandTheme = readFileSync(join(root, "styles/brand-theme.css"), "utf8");
const homepage = readFileSync(join(root, "styles/homepage-approved.css"), "utf8");
const marketingPages = readFileSync(join(root, "styles/marketing-pages.css"), "utf8");

describe("shared MPReply brand theme", () => {
  it("loads one approved violet brand system for dashboard and public pages", () => {
    expect(layout).toContain('import "../styles/brand-theme.css"');
    expect(globals).toContain("@import './theme.css'");
    expect(brandTheme).toContain(":root");
    expect(brandTheme).toContain("--color-brand-primary: #5148e8");
    expect(brandTheme).toContain("--color-brand-primary-strong: #443bcf");
    expect(brandTheme).toContain("--color-brand-deep: #3d35c0");
    expect(brandTheme).toContain("--color-brand-accent: #5148e8");
    expect(brandTheme).toContain("--color-brand-accent-soft: #c8c3ff");
    expect(brandTheme).toContain("--color-bg-brand-soft: #f0efff");
    expect(brandTheme).toContain("--app-nav-active-bg: #f0efff");
    expect(brandTheme).not.toContain("--color-brand-primary: #2563eb");
    expect(brandTheme).not.toContain("--color-brand-accent: #0ea5e9");
  });

  it("keeps theme.css limited to native color-scheme without a second palette", () => {
    expect(nativeTheme).toContain("color-scheme: light");
    expect(nativeTheme).toContain("color-scheme: dark");
    expect(nativeTheme).not.toMatch(/--[\w-]+\s*:/);
    expect(nativeTheme).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("uses the MPReply storage key while preserving one-time Respio theme migration", () => {
    expect(layout).toContain('localStorage.getItem("mpreply-theme")');
    expect(layout).toContain('localStorage.getItem("respio-theme")');
    expect(layout).toContain('localStorage.setItem("mpreply-theme", theme)');
    expect(layout).toContain('localStorage.removeItem("respio-theme")');
  });

  it("centralizes repeated card and public rhythm primitives", () => {
    expect(brandTheme).toContain("--shadow-card:");
    expect(brandTheme).toContain("--radius-card:");
    expect(brandTheme).toContain("--radius-panel:");
    expect(brandTheme).toContain("--space-section-public:");
    expect(brandTheme).toContain("--color-surface-cool:");
    expect(brandTheme).toContain("--color-border-card:");
  });

  it("keeps page layers from redefining the primary brand palette", () => {
    expect(homepage).not.toContain("--homepage-blue: #1167f1");
    expect(homepage).not.toContain("--homepage-blue-deep: #0a46c7");
    expect(homepage).not.toContain("--homepage-ink: #071846");
    expect(marketingPages).not.toContain("#1d4ed8");
  });

  it("keeps dark mode in the same violet family with accessible semantic status surfaces", () => {
    expect(brandTheme).toContain("[data-theme='dark']");
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-brand-primary:\s*#8e80ff/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-brand-accent:\s*#8e80ff/);
    expect(brandTheme).not.toMatch(/\[data-theme='dark'\][\s\S]*--color-brand-primary:\s*#60a5fa/);
    expect(brandTheme).not.toMatch(/\[data-theme='dark'\][\s\S]*--color-brand-accent:\s*#38bdf8/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-success-text:\s*#75e0a7/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-success-soft:\s*#053321/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-warning-text:\s*#fec84b/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-warning-soft:\s*#3f2a0a/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-danger-text:\s*#fda29b/);
    expect(brandTheme).toMatch(/\[data-theme='dark'\][\s\S]*--color-danger-soft:\s*#55160c/);
  });
});
