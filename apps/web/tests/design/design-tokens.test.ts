import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokenSource = readFileSync(resolve(process.cwd(), "styles/tokens.css"), "utf8");
const themeSource = readFileSync(resolve(process.cwd(), "styles/theme.css"), "utf8");
const globalStyleSource = readFileSync(resolve(process.cwd(), "styles/globals.css"), "utf8");
const publicStyleSource = readFileSync(resolve(process.cwd(), "styles/public-site.css"), "utf8");
const fontStyleSource = readFileSync(resolve(process.cwd(), "styles/fonts.css"), "utf8");
const canvasSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroFlowCanvas.tsx"),
  "utf8",
);
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
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
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

function declarationsOutsideTokenFiles(source: string): string[] {
  const visualProperty =
    /^(?:color|background(?:-color)?|border-color|border-width|box-shadow|text-shadow|fill|stroke|font-family|font-size|font-weight|line-height|letter-spacing|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|gap|row-gap|column-gap|border-radius|transition(?:-[a-z]+)?|outline|opacity|transform|filter|backdrop-filter)$/;
  const results: string[] = [];

  for (const line of source.split("\n")) {
    const declaration = /^\s*([\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (!declaration) continue;
    const property = declaration[1] ?? "";
    const value = declaration[2]?.trim() ?? "";
    if (!visualProperty.test(property)) continue;
    if (value.includes("var(")) continue;
    if (["0", "none", "inherit", "initial", "normal", "transparent", "currentColor", "auto"].includes(value)) {
      continue;
    }
    results.push(`${property}: ${value}`);
  }

  return results;
}

const tokens = readTokens(tokenSource);

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing required design token: ${name}`);
  return value;
}

describe("Respio design tokens", () => {
  it("contains the complete public visual-system contract", () => {
    const requiredTokens = [
      "--color-bg-page",
      "--color-bg-surface",
      "--color-bg-subtle",
      "--color-public-page",
      "--color-public-section",
      "--color-public-section-subtle",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-brand-primary",
      "--color-brand-primary-hover",
      "--color-brand-primary-active",
      "--color-brand-accent",
      "--color-danger",
      "--color-warning",
      "--color-success",
      "--color-info",
      "--color-focus-ring",
      "--color-border-subtle",
      "--gradient-public-hero",
      "--gradient-public-cta",
      "--gradient-signal-track",
      "--gradient-hero-glow",
      "--font-family-sans",
      "--font-weight-regular",
      "--font-weight-medium",
      "--font-weight-semibold",
      "--font-weight-bold",
      "--font-size-display",
      "--font-size-h1",
      "--font-size-h2",
      "--font-size-h3",
      "--font-size-h4",
      "--font-size-lead",
      "--font-size-body",
      "--font-size-body-sm",
      "--font-size-label",
      "--font-size-caption",
      "--line-height-display",
      "--line-height-heading",
      "--line-height-body",
      "--letter-spacing-display",
      "--letter-spacing-heading",
      "--space-4",
      "--public-section-spacing",
      "--public-card-padding",
      "--container-max-width",
      "--radius-md",
      "--shadow-sm",
      "--duration-fast",
      "--duration-normal",
      "--duration-slow",
      "--ease-out",
      "--transition-interactive",
      "--focus-ring",
      "--focus-ring-offset",
      "--motion-hover-lift",
      "--motion-active-lift",
      "--opacity-disabled",
    ];

    for (const name of requiredTokens) {
      expect(tokens.has(name), `${name} should exist`).toBe(true);
    }
  });

  it("keeps the approved Respio violet and mint while using a neutral near-white page canvas", () => {
    expect(token("--color-brand-primary").toLowerCase()).toBe("#6f33ab");
    expect(token("--color-brand-accent").toLowerCase()).toBe("#79d6b0");
    expect(token("--color-bg-page").toLowerCase()).toBe("#fbfafc");
    expect(token("--color-public-page")).toBe("var(--color-bg-page)");
    expect(token("--color-public-section")).toBe("var(--color-bg-page)");
  });

  it("keeps decorative mint distinct from semantic success", () => {
    expect(token("--color-brand-accent").toLowerCase()).not.toBe(token("--color-success").toLowerCase());
  });

  it("uses the self-hosted Onest RU/EN subset with explicit webfont performance contracts", () => {
    expect(token("--font-family-sans")).toMatch(/^'Onest',/);
    expect(globalStyleSource).toContain("@import './fonts.css';");
    expect(fontStyleSource.match(/@font-face/g)).toHaveLength(4);
    expect(fontStyleSource.match(/font-display:\s*swap/g)).toHaveLength(4);

    const fontFiles = [
      "onest-400-ru-en.woff2",
      "onest-500-ru-en.woff2",
      "onest-600-ru-en.woff2",
      "onest-700-ru-en.woff2",
    ];
    let totalSize = 0;

    for (const fileName of fontFiles) {
      const size = statSync(resolve(process.cwd(), "public/fonts/onest", fileName)).size;
      totalSize += size;
      expect(size, `${fileName} should stay below 20 KB`).toBeLessThan(20 * 1024);
      expect(fontStyleSource).toContain(`/fonts/onest/${fileName}`);
    }

    expect(totalSize, "Onest RU/EN webfont family should stay below 70 KB total").toBeLessThan(70 * 1024);
  });

  it("keeps public and global visual declarations on CSS custom properties", () => {
    expect(declarationsOutsideTokenFiles(publicStyleSource)).toEqual([]);
    expect(declarationsOutsideTokenFiles(globalStyleSource)).toEqual([]);
    expect(publicStyleSource).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(globalStyleSource).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(publicStyleSource).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
    expect(globalStyleSource).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
    expect(publicStyleSource).not.toContain("color-mix(");
    expect(globalStyleSource).not.toContain("color-mix(");

    const transitionDeclarations = [...`${publicStyleSource}\n${globalStyleSource}`.matchAll(/transition\s*:\s*([^;]+);/gs)];
    for (const declaration of transitionDeclarations) {
      expect(declaration[1]?.trim()).toMatch(/^var\(--transition-[\w-]+\)$/);
    }
  });

  it("keeps Canvas presentation and animation fully driven by Respio tokens", () => {
    const requiredCanvasTokens = [
      "--canvas-color-violet",
      "--canvas-color-mint",
      "--canvas-color-soft-violet",
      "--canvas-color-soft-mint",
      "--canvas-opacity-violet",
      "--canvas-opacity-mint",
      "--canvas-amplitude-violet",
      "--canvas-amplitude-mint",
      "--canvas-speed-violet",
      "--canvas-speed-mint",
      "--canvas-fps",
      "--canvas-dpr-max",
      "--canvas-reduced-motion-time",
    ];
    for (const name of requiredCanvasTokens) {
      expect(tokens.has(name), `${name} should exist`).toBe(true);
    }
    expect(canvasSource).toContain("`--canvas-color-${suffix}`");
    expect(canvasSource).toContain("`--canvas-opacity-${suffix}`");
    expect(canvasSource).toContain("`--canvas-amplitude-${suffix}`");
    expect(canvasSource).toContain("`--canvas-speed-${suffix}`");
    expect(canvasSource).toContain('"--canvas-fps"');
    expect(canvasSource).toContain('"--canvas-dpr-max"');
    expect(canvasSource).toContain('"--canvas-reduced-motion-time"');
    expect(canvasSource).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(canvasSource).toContain("prefers-reduced-motion: reduce");
    expect(canvasSource).toContain("IntersectionObserver");
    expect(canvasSource).toContain("ResizeObserver");
  });

  it("keeps process steps visually equal and SafetyGate semantic rather than oversized", () => {
    expect(publicStyleSource).toContain(".signal-flow-step-safety > span:first-child");
    expect(publicStyleSource).not.toMatch(/\.signal-flow-step-safety\s*\{[^}]*transform:/s);
    expect(publicStyleSource).not.toMatch(/\.signal-flow-step-safety\s*\{[^}]*box-shadow:/s);
  });

  it("keeps live Automation Rules on semantic tokens, focus contracts and responsive states", () => {
    const start = globalStyleSource.indexOf(".automation-workspace {");
    const end = globalStyleSource.indexOf(".review-queue-workspace {", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const automationStyles = globalStyleSource.slice(start, end);
    expect(automationStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(automationStyles).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
    expect(automationStyles).toContain("var(--focus-ring)");
    expect(automationStyles).toContain("@media (max-width: 1180px)");
    expect(automationStyles).toContain("@media (max-width: 720px)");
  });

  it("keeps live integrations on semantic tokens, stable motion and responsive states", () => {
    const start = globalStyleSource.indexOf("/* Live marketplace integrations workspace */");
    expect(start).toBeGreaterThanOrEqual(0);

    const integrationStyles = globalStyleSource.slice(start);
    expect(integrationStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(integrationStyles).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
    expect(integrationStyles).toContain("var(--transition-interactive)");
    expect(integrationStyles).toContain("var(--focus-ring)");
    expect(integrationStyles).toContain("@media (max-width: 1080px)");
    expect(integrationStyles).toContain("@media (max-width: 760px)");
  });

  it("defines dark-theme overrides as custom-property values rather than component hacks", () => {
    expect(themeSource).toMatch(/\[data-theme=['"]dark['"]\]/);
    expect(themeSource).not.toMatch(/\.[\w-]+\s*\{/);
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
