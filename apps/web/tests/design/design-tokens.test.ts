import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokenSource = readFileSync(resolve(process.cwd(), "styles/tokens.css"), "utf8");
const themeSource = readFileSync(resolve(process.cwd(), "styles/theme.css"), "utf8");
const globalStyleSource = readFileSync(resolve(process.cwd(), "styles/globals.css"), "utf8");
const publicStyleSource = readFileSync(resolve(process.cwd(), "styles/public-site.css"), "utf8");
const fontStyleSource = readFileSync(resolve(process.cwd(), "styles/fonts.css"), "utf8");
const productFlowSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.tsx"),
  "utf8",
);
const productFlowStyleSource = readFileSync(
  resolve(process.cwd(), "components/public-site/HeroProductFlowCanvas.module.css"),
  "utf8",
);
const cursorSource = readFileSync(
  resolve(process.cwd(), "components/public-site/PublicCustomCursor.tsx"),
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

function mixHex(
  foreground: string,
  background: string,
  foregroundWeight: number,
): string {
  const foregroundRgb = parseHex(foreground);
  const backgroundRgb = parseHex(background);
  const channels = foregroundRgb.map((channel, index) =>
    Math.round(
      channel * foregroundWeight +
        (backgroundRgb[index] ?? 0) * (1 - foregroundWeight),
    ),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
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
const darkThemeTokens = readTokens(themeSource);

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing required design token: ${name}`);
  return value;
}

function darkToken(name: string): string {
  return darkThemeTokens.get(name) ?? token(name);
}

function expectOpaqueHexColor(value: string, label: string): void {
  expect(value, `${label} must be an opaque six-digit hex color`).toMatch(/^#[0-9a-f]{6}$/i);
}

describe("MPReply design tokens", () => {
  it("contains the complete public visual-system contract", () => {
    const requiredTokens = [
      "--color-bg-page",
      "--color-bg-surface",
      "--color-bg-subtle",
      "--color-bg-hero",
      "--color-surface-interactive",
      "--color-surface-hover",
      "--color-public-page",
      "--color-public-section",
      "--color-public-section-subtle",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-kicker-text",
      "--color-eyebrow-text",
      "--color-eyebrow-surface",
      "--color-cursor-ring",
      "--color-cursor-core",
      "--color-safetygate-panel",
      "--color-safetygate-panel-raised",
      "--color-brand-primary",
      "--color-brand-on-light",
      "--color-brand-on-light-hover",
      "--color-public-header-text",
      "--color-public-header-text-active",
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
      "--hero-product-flow-success-soft",
      "--hero-product-flow-success-text",
      "--hero-product-flow-warning-soft",
      "--hero-product-flow-warning-text",
      "--hero-flow-scene-surface",
      "--hero-flow-input-surface",
      "--hero-flow-engine-surface",
      "--hero-flow-engine-text",
      "--hero-flow-answer-surface",
      "--hero-flow-evidence-surface",
      "--hero-flow-line-input",
      "--hero-flow-line-output",
      "--hero-flow-shadow",
      "--pricing-pack-volume-text",
      "--color-info",
      "--color-info-text",
      "--color-info-soft",
      "--color-focus-ring",
      "--color-border-subtle",
      "--gradient-brand-main",
      "--gradient-public-hero",
      "--gradient-public-section-soft",
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
      "--shadow-surface",
      "--shadow-surface-hover",
      "--shadow-secondary-button",
      "--shadow-secondary-button-hover",
      "--shadow-safetygate-panel",
      "--shadow-eyebrow",
      "--duration-fast",
      "--duration-normal",
      "--duration-slow",
      "--duration-ambient",
      "--ease-out",
      "--transition-interactive",
      "--focus-ring",
      "--focus-ring-offset",
      "--motion-hover-lift",
      "--motion-active-lift",
      "--opacity-disabled",
      "--font-size-eyebrow",
      "--font-size-auth-title",
      "--line-height-eyebrow",
      "--line-height-auth-title",
      "--letter-spacing-eyebrow",
      "--public-eyebrow-gap",
      "--public-eyebrow-to-heading",
      "--public-heading-to-copy",
      "--public-copy-to-actions",
      "--home-section-heading-max-width",
      "--home-section-copy-max-width",
      "--home-hero-copy-max-width",
      "--public-subhero-heading-max-width",
      "--home-hero-heading-max-width",
      "--home-hero-lead-max-width",
      "--home-card-padding",
      "--home-section-gap",
      "--home-grid-gap",
      "--gradient-home-outcomes",
      "--gradient-home-marketplaces",
      "--gradient-home-safety",
      "--gradient-home-llm",
      "--gradient-home-cta",
      "--shadow-home-card",
      "--shadow-home-card-hover",
      "--shadow-home-stage",
      "--shadow-home-cta",
    ];

    for (const name of requiredTokens) {
      expect(tokens.has(name), `${name} should exist`).toBe(true);
    }
  });

  it("uses the approved Electric Pulse identity on a controlled near-white page canvas", () => {
    expect(token("--color-brand-primary").toLowerCase()).toBe("#635bff");
    expect(token("--color-brand-accent").toLowerCase()).toBe("#00e5e5");
    expect(token("--color-bg-page").toLowerCase()).toBe("#fafbff");
    expect(token("--color-public-page")).toBe("var(--color-bg-page)");
    expect(token("--color-public-section")).toBe("var(--color-bg-page)");
  });

  it("keeps decorative cyan distinct from semantic success", () => {
    expect(token("--color-brand-accent").toLowerCase()).not.toBe(token("--color-success").toLowerCase());
  });

  it("caps public heading roles at the approved visual-recovery limits", () => {
    expect(token("--font-size-display")).toMatch(/4rem\)$/);
    expect(token("--font-size-h1")).toBe("3.625rem");
    expect(token("--font-size-h2")).toBe("3rem");
    expect(token("--font-size-h3")).toBe("1.75rem");
  });

  it("uses the self-hosted Onest RU/EN subset with explicit webfont performance contracts", () => {
    expect(token("--font-family-sans")).toMatch(/^'MPReply Onest',/);
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

  it("keeps public and global literal visual declaration debt within the accepted baseline", () => {
    const publicOffenders = declarationsOutsideTokenFiles(publicStyleSource);
    const globalOffenders = declarationsOutsideTokenFiles(globalStyleSource);

    // 0.1.84 freezes the pre-existing append-only CSS debt as a measurable budget.
    // The next design-system consolidation patch must reduce this number instead of
    // adding new literal visual declarations outside token files.
    expect(publicOffenders.length + globalOffenders.length).toBeLessThanOrEqual(127);
    expect(globalStyleSource).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(globalStyleSource).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/i);
  });

  it("keeps the active MPReply product-flow Hero on the approved DOM/canvas contract", () => {
    expect(productFlowSource).toContain('data-mpreply-hero="commerce-answer-pipeline"');
    expect(productFlowSource).toContain("drawConnection(");
    expect(productFlowSource).toContain("function anchor(");
    expect(productFlowSource).toContain("getBoundingClientRect");
    expect(productFlowSource).toContain("ResizeObserver");
    expect(productFlowSource).toContain("IntersectionObserver");
    expect(productFlowSource).toContain('document.addEventListener("visibilitychange"');
    expect(productFlowSource).not.toContain("new THREE.WebGLRenderer");
    expect(productFlowStyleSource).toContain("background: var(--hero-flow-scene-surface)");
    expect(productFlowStyleSource).toContain("box-shadow: var(--hero-flow-shadow)");
    expect(productFlowStyleSource).not.toContain(".workspace");
  });

  it("keeps the recovered Hero composition wide enough for natural Russian wrapping", () => {
    expect(token("--home-hero-heading-max-width")).toBe("20ch");
    expect(token("--home-hero-copy-max-width")).toBe("42rem");
    expect(publicStyleSource).toMatch(/\.home-hero-layout\s*\{[^}]*grid-template-columns:/s);
    expect(publicStyleSource).toMatch(/\.home-hero-actions,\s*\.home-final-cta-actions\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(publicStyleSource).toMatch(/\.home-hero::before,\s*\.home-hero::after\s*\{[^}]*content:\s*none;/s);
  });

  it("keeps the active product-flow Hero motion-safe and mobile-aware", () => {
    expect(productFlowSource).toContain("requestAnimationFrame");
    expect(productFlowSource).toContain("ResizeObserver");
    expect(productFlowSource).toContain("prefers-reduced-motion: reduce");
    expect(productFlowSource).toContain("mediaQuery.addEventListener");
    expect(productFlowSource).toContain('hero.addEventListener("pointermove"');
    expect(productFlowSource).toContain('hero.addEventListener("pointerleave"');
    expect(productFlowStyleSource).toContain("@media (max-width: 1240px)");
    expect(productFlowSource).toContain('matchMedia("(max-width: 1240px)")');
    expect(productFlowSource).toContain("!compactLayout");
    expect(productFlowSource).not.toContain("damp(0, motion.pointerX");
  });

  it("uses only the four approved Onest weights across the public hero and header", () => {
    expect(token("--font-weight-regular")).toBe("400");
    expect(token("--font-weight-medium")).toBe("500");
    expect(token("--font-weight-semibold")).toBe("600");
    expect(token("--font-weight-bold")).toBe("700");
    expect(token("--font-weight-public-copy")).toBe("var(--font-weight-regular)");
    expect(token("--font-weight-public-nav")).toBe("var(--font-weight-medium)");
    expect(token("--font-weight-public-label")).toBe("var(--font-weight-semibold)");
    expect(token("--font-weight-public-title")).toBe("var(--font-weight-bold)");
    expect(publicStyleSource).not.toMatch(/font-weight:\s*(?:570|620|760|780|820|850|900)\b/);
    // Product-flow Hero is contained in a CSS module while sharing the four
    // approved public weight tokens.
    expect(productFlowStyleSource.match(/font-weight:\s*(?:[0-9]{3})\b/g)?.length ?? 0).toBeLessThanOrEqual(15);
  });

  it("installs no icon package for the product-flow Hero", () => {
    const packageSource = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
    const lockSource = readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8");
    expect(packageSource).not.toContain("@tabler/icons");
    expect(lockSource).not.toContain("@tabler/icons");
    expect(productFlowSource).not.toContain("@tabler/icons");
    expect(productFlowSource).not.toContain("<svg");
  });

  it("keeps the public custom cursor progressive and motion-safe", () => {
    expect(cursorSource).toContain("(hover: hover) and (pointer: fine)");
    expect(cursorSource).toContain("prefers-reduced-motion: reduce");
    expect(cursorSource).toContain("requestAnimationFrame");
    expect(publicStyleSource).toContain(".public-custom-cursor");
    expect(publicStyleSource).toContain("@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)");
  });

  it("keeps complex-scenario automation as a dedicated light tonal section with semantic outcomes", () => {
    expect(publicStyleSource).toContain(".home-intelligence");
    expect(publicStyleSource).toMatch(/\.home-intelligence\s*\{[^}]*background:\s*var\(--color-public-page\);/s);
    expect(publicStyleSource).toContain("var(--shadow-home-stage)");
    expect(publicStyleSource).toMatch(/\.home-status-success\s*\{[^}]*background:\s*var\(--color-success-soft\);[^}]*color:\s*var\(--color-success-text\);/s);
  });

  it("keeps the screenshot-driven homepage free of numbered wireframe steps and decorative border dependence", () => {
    expect(publicStyleSource).toContain(".home-capability-grid");
    expect(publicStyleSource).toContain(".marketing-glyph");
    expect(publicStyleSource).toContain("var(--shadow-home-card)");
    expect(publicStyleSource).toContain("var(--shadow-home-card-hover)");
    expect(publicStyleSource).not.toMatch(/\.home-(?:outcome|capability|llm)-card\s*\{[^}]*border:\s*1px/s);
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
    const start = globalStyleSource.indexOf(".integrations-workspace,");
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

  it("defines dark-theme overrides as custom-property values rather than component hacks", () => {
    expect(themeSource).toMatch(/\[data-theme=['"]dark['"]\]/);
    expect(publicStyleSource).toContain("var(--color-public-header-text)");
    expect(publicStyleSource).toContain("var(--color-public-header-text-active)");
    expect(publicStyleSource).toContain("var(--color-brand-on-light)");
    expect(publicStyleSource).toContain("var(--pricing-pack-volume-text)");
    expect(productFlowStyleSource).toContain("var(--hero-product-flow-success-text)");
    expect(productFlowStyleSource).toContain("var(--hero-product-flow-warning-text)");
    expect(themeSource).not.toMatch(/\.[\w-]+\s*\{/);
  });

  it("keeps fixed light public surfaces accessible in both themes", () => {
    const white = token("--color-white");
    expect(contrastRatio(token("--color-public-header-text"), white)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(token("--color-public-header-text-active"), white),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token("--color-brand-on-light"), white)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(token("--color-brand-on-light-hover"), white),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(token("--pricing-pack-volume-text"), "#f3f2ff"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(token("--color-marketplace-avito"), "#e6f7ff"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps product-flow semantic badges WCAG AA compliant", () => {
    expect(
      contrastRatio(
        token("--hero-product-flow-success-text"),
        token("--hero-product-flow-success-soft"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        token("--hero-product-flow-warning-text"),
        token("--hero-product-flow-warning-soft"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        darkToken("--hero-product-flow-success-text"),
        darkToken("--hero-product-flow-success-soft"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        darkToken("--hero-product-flow-warning-text"),
        darkToken("--hero-product-flow-warning-soft"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps marketplace badges accessible on dark public surfaces", () => {
    const darkSurface = darkToken("--color-bg-surface");
    const cases = [
      [
        darkToken("--color-marketplace-wb"),
        mixHex(darkToken("--color-marketplace-wb"), darkSurface, 0.12),
      ],
      [
        darkToken("--color-marketplace-ozon"),
        mixHex(darkToken("--color-marketplace-ozon"), darkSurface, 0.1),
      ],
      [
        darkToken("--color-marketplace-yandex"),
        mixHex("#ffcc00", darkSurface, 0.18),
      ],
      [
        darkToken("--color-marketplace-avito"),
        mixHex("#00aaff", darkSurface, 0.1),
      ],
    ] as const;

    for (const [foreground, background] of cases) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
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
    ["text on primary button", "--color-text-on-brand", "--color-brand-action", 4.5],
    ["text on danger button", "--color-text-on-danger", "--color-danger", 4.5],
    ["text on dark surface", "--color-text-on-dark", "--color-surface-dark", 4.5],
    ["success text on success soft surface", "--color-success-text", "--color-success-soft", 4.5],
    ["warning text on warning soft surface", "--color-warning-text", "--color-warning-soft", 4.5],
    ["danger text on danger soft surface", "--color-danger-text", "--color-danger-soft", 4.5],
    ["info text on info soft surface", "--color-info-text", "--color-info-soft", 4.5],
  ])("meets WCAG AA contrast for light theme: %s", (_label, foregroundToken, backgroundToken, minimum) => {
    expect(contrastRatio(token(foregroundToken), token(backgroundToken))).toBeGreaterThanOrEqual(minimum);
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
    ["text on primary button", "--color-text-on-brand", "--color-brand-action", 4.5],
    ["text on danger button", "--color-text-on-danger", "--color-danger", 4.5],
    ["success text on success soft surface", "--color-success-text", "--color-success-soft", 4.5],
    ["warning text on warning soft surface", "--color-warning-text", "--color-warning-soft", 4.5],
    ["danger text on danger soft surface", "--color-danger-text", "--color-danger-soft", 4.5],
    ["info text on info soft surface", "--color-info-text", "--color-info-soft", 4.5],
  ])("meets WCAG AA contrast for dark theme: %s", (_label, foregroundToken, backgroundToken, minimum) => {
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
    expect(contrastRatio(token(foregroundToken), token(backgroundToken))).toBeGreaterThanOrEqual(4.5);
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
      expectOpaqueHexColor(token(name), `light ${name}`);
      expectOpaqueHexColor(darkToken(name), `dark ${name}`);
    }

    expect(token("--app-nav-active-bg")).toBe("var(--color-brand-soft)");
    expect(darkToken("--app-nav-active-bg")).toBe("var(--color-brand-soft)");
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

  it("keeps rejected public MVP and readiness status contracts removed from the public visual system", () => {
    expect(publicStyleSource).not.toContain(".public-status-mvp");
    expect(publicStyleSource).not.toContain(".public-status-planned");
    expect(publicStyleSource).not.toContain(".readiness-summary-primary");
  });

  it("keeps error copy on the dedicated danger text token instead of the lower-contrast accent token", () => {
    expect(globalStyleSource).toContain(".automation-state-error,");
    expect(globalStyleSource).toMatch(/\.automation-state-error,[\s\S]*?background:\s*var\(--app-danger-bg\);[\s\S]*?color:\s*var\(--color-danger-text\);/);
    expect(globalStyleSource).not.toMatch(/background:\s*var\(--app-danger-bg\);\s*color:\s*var\(--color-danger\);/);
  });
});
