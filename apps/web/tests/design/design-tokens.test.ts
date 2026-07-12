import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokenSource = readFileSync(resolve(process.cwd(), "styles/tokens.css"), "utf8");
const globalStyleSource = readFileSync(resolve(process.cwd(), "styles/globals.css"), "utf8");
const tokenPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;

function readTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of source.matchAll(tokenPattern)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (!name || !value) continue;
    if (tokens.has(name)) {
      throw new Error(`Duplicate design token declaration: ${name}`);
    }
    tokens.set(name, value);
  }
  return tokens;
}

function parseHex(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) throw new Error(`Expected six-digit hex color, got: ${value}`);
  const hex = match[1];
  if (!hex) throw new Error(`Missing hex payload for: ${value}`);
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

function relativeLuminance(value: string): number {
  const [red, green, blue] = parseHex(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = readTokens(tokenSource);

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing required design token: ${name}`);
  return value;
}

describe("Respio design tokens", () => {
  it("contains the critical brand, semantic, typography, spacing, radius, shadow and motion contracts", () => {
    const requiredTokens = [
      "--color-bg-page",
      "--color-bg-surface",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-brand-primary",
      "--color-brand-primary-hover",
      "--color-brand-accent",
      "--color-danger",
      "--color-warning",
      "--color-success",
      "--color-info",
      "--color-focus-ring",
      "--color-border-subtle",
      "--gradient-public-hero",
      "--font-family-sans",
      "--font-size-md",
      "--line-height-normal",
      "--font-weight-semibold",
      "--space-4",
      "--container-max-width",
      "--radius-md",
      "--shadow-sm",
      "--transition-fast",
      "--transition-normal",
      "--transition-slow",
      "--opacity-disabled",
    ];

    for (const name of requiredTokens) {
      expect(tokens.has(name), `${name} should exist`).toBe(true);
    }
  });

  it("keeps the approved violet, mint and warm-canvas brand values stable", () => {
    expect(token("--color-brand-primary").toLowerCase()).toBe("#6f33ab");
    expect(token("--color-brand-accent").toLowerCase()).toBe("#79d6b0");
    expect(token("--color-bg-page").toLowerCase()).toBe("#f7f5f2");
  });

  it("keeps decorative mint distinct from semantic success", () => {
    expect(token("--color-brand-accent").toLowerCase()).not.toBe(token("--color-success").toLowerCase());
  });


  it("keeps the live Automation Rules workspace on semantic tokens and responsive contracts", () => {
    const start = globalStyleSource.indexOf(".automation-workspace {");
    const end = globalStyleSource.indexOf(".review-queue-workspace {", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const automationStyles = globalStyleSource.slice(start, end);
    expect(automationStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(automationStyles).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
    expect(automationStyles).toContain("var(--color-focus-ring)");
    expect(automationStyles).toContain("@media (max-width: 1180px)");
    expect(automationStyles).toContain("@media (max-width: 720px)");
  });

  it.each([
    ["primary text on page", "--color-text-primary", "--color-bg-page", 4.5],
    ["secondary text on page", "--color-text-secondary", "--color-bg-page", 4.5],
    ["muted text on page", "--color-text-muted", "--color-bg-page", 4.5],
    ["text on primary button", "--color-text-on-brand", "--color-brand-primary", 4.5],
    ["text on dark surface", "--color-text-on-dark", "--color-surface-dark", 4.5],
  ])("meets WCAG AA contrast for %s", (_label, foregroundToken, backgroundToken, minimum) => {
    expect(contrastRatio(token(foregroundToken), token(backgroundToken))).toBeGreaterThanOrEqual(minimum);
  });
});
