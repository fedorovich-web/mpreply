import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const i18n = readFileSync(join(root, "lib/i18n.ts"), "utf8");
const seo = readFileSync(join(root, "lib/seo.ts"), "utf8");
const config = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
const robots = readFileSync(join(root, "app/robots.ts"), "utf8");
const policy = readFileSync(join(root, "../../docs/product/locale-routing-policy.md"), "utf8");

describe("RU/EN locale architecture", () => {
  it("keeps Russian URLs unprefixed and English URLs under /en", () => {
    expect(i18n).toContain('export const defaultLocale: Locale = "ru"');
    expect(i18n).toContain('if (locale === "ru") return normalized');
    expect(i18n).toContain('if (normalized === "/") return "/en"');
    expect(i18n).toContain('return `/en${normalized}`');
    expect(policy).toContain("Русская версия сохраняет существующие URL без языкового префикса");
    expect(policy).toContain("Английская версия живёт в отдельном дереве");
  });

  it("sets document language from the requested URL before server rendering", () => {
    expect(proxy).toContain("localeFromPathname(request.nextUrl.pathname)");
    expect(proxy).toContain("localeRequestHeader");
    expect(layout).toContain("await headers()");
    expect(layout).toContain("localeFromRequestHeader");
    expect(layout).toContain("<html lang={htmlLanguage(locale)}");
  });

  it("supports locale-aware canonical, OpenGraph locale and hreflang metadata", () => {
    expect(seo).toContain("localizedPath(locale, path)");
    expect(seo).toContain('"ru-RU": localizedPath("ru", path)');
    expect(seo).toContain('en: localizedPath("en", path)');
    expect(seo).toContain('"x-default": localizedPath("ru", path)');
    expect(seo).toContain("openGraphLocale(locale)");
  });

  it("keeps localized product navigation and marketplace configuration separate", () => {
    expect(config).toContain("export const siteConfigs");
    expect(config).toContain("ru:");
    expect(config).toContain("en:");
    expect(config).toContain('{ href: "/features", label: "Возможности" }');
    expect(config).toContain('{ href: "/en/features", label: "Features" }');
    expect(config).toContain("marketplacesEn");
  });

  it("keeps both private locale trees out of search indexing", () => {
    expect(robots).toContain('"/app/"');
    expect(robots).toContain('"/auth/"');
    expect(robots).toContain('"/en/app/"');
    expect(robots).toContain('"/en/auth/"');
  });

  it("does not use IP or browser-language redirects", () => {
    expect(proxy).not.toContain("Accept-Language");
    expect(proxy).not.toContain("geo");
    expect(proxy).not.toContain("redirect(");
    expect(policy).toContain("Не перенаправлять пользователя автоматически");
  });
});
