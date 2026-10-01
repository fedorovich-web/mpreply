import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokenSource = readFileSync(resolve(process.cwd(), "styles/tokens.css"), "utf8");
const brandThemeSource = readFileSync(resolve(process.cwd(), "styles/brand-theme.css"), "utf8");
const globalStyleSource = readFileSync(resolve(process.cwd(), "styles/globals.css"), "utf8");
const publicStyleSource = readFileSync(resolve(process.cwd(), "styles/public-site.css"), "utf8");
const fontStyleSource = readFileSync(resolve(process.cwd(), "styles/fonts.css"), "utf8");
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

function readSelectorBlock(source: string, selector: string): string {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex < 0) throw new Error(`Missing selector block: ${selector}`);
  const openIndex = source.indexOf("{", selectorIndex);
  if (openIndex < 0) throw new Error(`Missing opening brace for: ${selector}`);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }

  throw new Error(`Missing closing brace for: ${selector}`);
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
const lightBrandTokens = readTokens(readSelectorBlock(brandThemeSource, ":root"));
const darkBrandTokens = readTokens(readSelectorBlock(brandThemeSource, "[data-theme='dark']"));

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing required design token: ${name}`);
  return value;
}

function lightToken(name: string): string {
  return lightBrandTokens.get(name) ?? token(name);
}

function darkToken(name: string): string {
  return darkBrandTokens.get(name) ?? lightToken(name);
}

function expectOpaqueHexColor(value: string, label: string): void {
  expect(value, `${label} must be an opaque six-digit hex color`).toMatch(/^#[0-9a-f]{6}$/i);
}

describe("MPReply base design tokens", () => {
  it("contains the complete shared visual-system contract", () => {
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
      "--color-kicker-text",
      "--color-brand-primary",
      "--color-brand-text-on-soft",
      "--color-brand-primary-hover",
      "--color-brand-primary-active",
      "--color-brand-accent",
      "--color-text-on-brand",
      "--color-text-on-danger",
      "--color-danger",
      "--color-danger-text",
      "--color-danger-soft",
      "--color-warning",
      "--color-warning-text",
      "--color-warning-soft",
      "--color-success",
      "--color-success-text",
      "--color-success-soft",
      "--color-info",
      "--color-info-text",
      "--color-info-soft",
      "--color-focus-ring",
      "--color-border-subtle",
      "--gradient-public-hero",
      "--gradient-public-cta",
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

  it("keeps the legacy fallback palette beneath the authoritative MPReply runtime brand layer", () => {
    expect(token("--color-brand-primary").toLowerCase()).toBe("#6f33ab");
    expect(token("--color-brand-accent").toLowerCase()).toBe("#79d6b0");
    expect(token("--color-bg-page").toLowerCase()).toBe("#fbfafc");
    expect(token("--color-public-page")).toBe("var(--color-bg-page)");
    expect(token("--color-public-section")).toBe("var(--color-bg-page)");
  });

  it("keeps the approved blue runtime brand layer instead of the legacy fallback palette", () => {
    expect(lightToken("--color-brand-primary").toLowerCase()).toBe("#0b68f6");
    expect(lightToken("--color-brand-accent").toLowerCase()).toBe("#0b68f6");
    expect(darkToken("--color-brand-primary").toLowerCase()).toBe("#5aa7ff");
    expect(darkToken("--color-brand-accent").toLowerCase()).toBe("#5aa7ff");
    expect(lightToken("--gradient-mpreply-action")).toBe(
      "linear-gradient(110deg, #0d6cf7 0%, #0674ff 58%, #0a5fe8 100%)",
    );
    expect(darkToken("--gradient-mpreply-action")).toBe(
      "linear-gradient(110deg, #1684ff 0%, #0b68f6 58%, #0757d7 100%)",
    );
  });

  it("keeps decorative accent distinct from semantic success", () => {
    expect(lightToken("--color-brand-accent").toLowerCase()).not.toBe(lightToken("--color-success").toLowerCase());
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
    expect(integrationStyles).toContain(".integration-account-button-active small");
    expect(integrationStyles).toContain("color: var(--color-text-secondary)");
    expect(integrationStyles).toContain("@media (max-width: 1080px)");
    expect(integrationStyles).toContain("@media (max-width: 760px)");
  });

  it("keeps brand-theme limited to token overrides rather than component hacks", () => {
    expect(brandThemeSource).toMatch(/\[data-theme=['"]dark['"]\]/);
    expect(brandThemeSource).not.toMatch(/\.[\w-]+\s*\{/);
  });

  it.each([
    ["primary text on page", "--color-text-primary", "--color-bg-page", 4.5],
    ["primary text on surface", "--color-text-primary", "--color-bg-surface", 4.5],
    ["primary text on elevated surface", "--color-text-primary", "--color-bg-elevated", 4.5],
    ["secondary text on page", "--color-text-secondary", "--color-bg-page", 4.5],
    ["secondary text on surface", "--color-text-secondary", "--color-bg-surface", 4.5],
    ["muted text on page", "--color-text-muted", "--color-bg-page", 4.5],
    ["muted text on subtle surface", "--color-text-muted", "--color-bg-subtle", 4.5],
    ["brand text on page", "--color-brand-primary", "--color-bg-page", 4.5],
    ["brand text on elevated surface", "--color-brand-primary", "--color-bg-elevated", 4.5],
    ["brand text on brand soft surface", "--color-brand-text-on-soft", "--color-brand-soft", 4.5],
    ["kicker text on surface", "--color-kicker-text", "--color-bg-surface", 4.5],
    ["text on primary button", "--color-text-on-brand", "--color-brand-primary", 4.5],
    ["text on danger button", "--color-text-on-danger", "--color-danger", 4.5],
    ["text on dark surface", "--color-text-on-dark", "--color-surface-dark", 4.5],
    ["success text on success soft surface", "--color-success-text", "--color-success-soft", 4.5],
    ["warning text on warning soft surface", "--color-warning-text", "--color-warning-soft", 4.5],
    ["danger text on danger soft surface", "--color-danger-text", "--color-danger-soft", 4.5],
    ["info text on info soft surface", "--color-info-text", "--color-info-soft", 4.5],
  ])("meets WCAG AA contrast for light runtime theme: %s", (_label, foregroundToken, backgroundToken, minimum) => {
    expect(contrastRatio(lightToken(foregroundToken), lightToken(backgroundToken))).toBeGreaterThanOrEqual(minimum);
  });

  it.each([
    ["primary text on page", "--color-text-primary", "--color-bg-page", 4.5],
    ["primary text on surface", "--color-text-primary", "--color-bg-surface", 4.5],
    ["primary text on elevated surface", "--color-text-primary", "--color-bg-elevated", 4.5],
    ["secondary text on page", "--color-text-secondary", "--color-bg-page", 4.5],
    ["secondary text on surface", "--color-text-secondary", "--color-bg-surface", 4.5],
    ["muted text on page", "--color-text-muted", "--color-bg-page", 4.5],
    ["muted text on subtle surface", "--color-text-muted", "--color-bg-subtle", 4.5],
    ["brand text on page", "--color-brand-primary", "--color-bg-page", 4.5],
    ["brand text on elevated surface", "--color-brand-primary", "--color-bg-elevated", 4.5],
    ["brand text on brand soft surface", "--color-brand-text-on-soft", "--color-brand-soft", 4.5],
    ["kicker text on elevated surface", "--color-kicker-text", "--color-bg-elevated", 4.5],
    ["text on primary button", "--color-text-on-brand", "--color-brand-primary", 4.5],
    ["text on danger button", "--color-text-on-danger", "--color-danger", 4.5],
    ["success text on success soft surface", "--color-success-text", "--color-success-soft", 4.5],
    ["warning text on warning soft surface", "--color-warning-text", "--color-warning-soft", 4.5],
    ["danger text on danger soft surface", "--color-danger-text", "--color-danger-soft", 4.5],
    ["info text on info soft surface", "--color-info-text", "--color-info-soft", 4.5],
  ])("meets WCAG AA contrast for dark runtime theme: %s", (_label, foregroundToken, backgroundToken, minimum) => {
    expect(contrastRatio(darkToken(foregroundToken), darkToken(backgroundToken))).toBeGreaterThanOrEqual(minimum);
  });

  it.each([
    ["secondary text on success soft", "--color-text-secondary", "--color-success-soft"],
    ["secondary text on warning soft", "--color-text-secondary", "--color-warning-soft"],
    ["secondary text on danger soft", "--color-text-secondary", "--color-danger-soft"],
    ["secondary text on info soft", "--color-text-secondary", "--color-info-soft"],
    ["muted text on success soft", "--color-text-muted", "--color-success-soft"],
    ["muted text on warning soft", "--color-text-muted", "--color-warning-soft"],
    ["muted text on danger soft", "--color-text-muted", "--color-danger-soft"],
    ["muted text on info soft", "--color-text-muted", "--color-info-soft"],
    ["secondary text on brand soft", "--color-text-secondary", "--color-brand-soft"],
    ["muted text on brand soft", "--color-text-muted", "--color-brand-soft"],
  ])("keeps inherited neutral copy accessible on semantic soft surfaces: %s", (_label, foregroundToken, backgroundToken) => {
    expect(contrastRatio(lightToken(foregroundToken), lightToken(backgroundToken))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkToken(foregroundToken), darkToken(backgroundToken))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps text-bearing soft surfaces opaque so nested badges and active states cannot lose contrast through parent compositing", () => {
    const opaqueSoftTokens = [
      "--color-brand-soft",
      "--color-success-soft",
      "--color-warning-soft",
      "--color-danger-soft",
      "--color-info-soft",
    ];

    for (const name of opaqueSoftTokens) {
      expectOpaqueHexColor(lightToken(name), `light ${name}`);
      expectOpaqueHexColor(darkToken(name), `dark ${name}`);
    }

    expect(lightToken("--app-nav-active-bg")).toBe(lightToken("--color-brand-soft"));
    expect(darkToken("--app-nav-active-bg")).toBe(darkToken("--color-brand-soft"));
  });

  it("uses the dedicated brand text token on all soft brand text surfaces", () => {
    const sources = `${globalStyleSource}\n${publicStyleSource}`;
    const rulePattern = /([^{}]+)\{([^{}]*)\}/gs;
    for (const match of sources.matchAll(rulePattern)) {
      const selector = match[1]?.trim() ?? "unknown selector";
      const body = match[2] ?? "";
      const hasTextBearingBrandSoftBackground =
        /background:\s*var\(--(?:color-brand-soft|app-nav-active-bg)\);/.test(body);
      const usesPrimaryAsText = /(?:^|[;\n])\s*color:\s*var\(--color-brand-primary\);/.test(body);
      expect(
        hasTextBearingBrandSoftBackground && usesPrimaryAsText,
        `${selector} must use --color-brand-text-on-soft instead of --color-brand-primary on a soft brand surface`,
      ).toBe(false);
    }
  });

  it("keeps danger buttons independent from the dark-theme on-brand token", () => {
    expect(globalStyleSource).toMatch(/\.button-danger\s*\{[^}]*background:\s*var\(--color-danger\);[^}]*color:\s*var\(--color-text-on-danger\);/s);
    expect(globalStyleSource).not.toMatch(/\.button-danger\s*\{[^}]*color:\s*var\(--color-text-on-brand\);/s);
  });

  it("keeps public supported badges on their accessible brand pair", () => {
    expect(publicStyleSource).toMatch(/\.public-status-supported\s*\{[^}]*background:\s*var\(--color-bg-brand-soft\);[^}]*color:\s*var\(--color-brand-primary\);/s);
    expect(publicStyleSource).not.toContain(".public-status-mvp");
  });

  it("keeps error copy on the dedicated danger text token instead of the lower-contrast accent token", () => {
    expect(globalStyleSource).toContain(".automation-state-error,");
    expect(globalStyleSource).toMatch(/\.automation-state-error,[\s\S]*?background:\s*var\(--app-danger-bg\);[\s\S]*?color:\s*var\(--color-danger-text\);/);
    expect(globalStyleSource).not.toMatch(/background:\s*var\(--app-danger-bg\);\s*color:\s*var\(--color-danger\);/);
  });
});
