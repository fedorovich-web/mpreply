import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicFooter } from "../../components/public-site/PublicFooter";
import { getSiteConfig, publicRoutes } from "../../lib/site-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("public site without a blog", () => {
  it.each(["ru", "en"] as const)("omits editorial routes and links for %s", (locale) => {
    expect(publicRoutes).not.toContain("/blog");
    expect(publicRoutes).not.toContain("/resources");
    const config = getSiteConfig(locale);
    expect(config.navigation.some((item) => /blog|resources/.test(item.href))).toBe(false);
    const footer = renderToStaticMarkup(createElement(PublicFooter, { locale }));
    expect(footer).not.toMatch(/href="[^"]*\/(?:blog|resources)(?:\/|")/);
    expect(footer).not.toMatch(/>Блог<|>Blog</);
    const prefix = locale === "en" ? "app/en" : "app";
    for (const route of ["blog", "resources"]) {
      expect(existsSync(join(process.cwd(), prefix, route, "page.tsx"))).toBe(false);
    }
  });

  it("loads the current contact layer without retired resources and footer variants", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('import "../styles/public-contact-404-render.css";');
    expect(layout).toContain('import "../styles/public-compact-footer.css";');
    for (const retired of ["resources-contacts-approved.css", "public-contact-404-footer.css"]) {
      expect(layout).not.toContain(retired);
      expect(existsSync(join(process.cwd(), "styles", retired))).toBe(false);
    }
    expect(read("scripts/validate-w3c-html.mjs")).not.toContain('"/resources"');
  });

  it("keeps the verified support channel without invented addresses", () => {
    expect(getSiteConfig("ru").contactEmail).toBe("support@mpreply.ru");
    expect(getSiteConfig("en").contactEmail).toBe("support@mpreply.ru");
    for (const path of ["app/contacts/page.tsx", "app/en/contacts/page.tsx"]) {
      expect(read(path)).not.toMatch(/Майкоп|Чкалова|помещение 17А|09:00–18:00|sales@|demo@|partners@/);
    }
  });
});
