import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicHeader } from "../../components/public-site/PublicHeader";

const state = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
const css = readFileSync(join(process.cwd(), "styles/public-header-fidelity.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

function header(locale: "ru" | "en", pathname: string) {
  state.pathname = pathname;
  return new DOMParser().parseFromString(renderToStaticMarkup(createElement(PublicHeader, { locale })), "text/html");
}

describe("shared public header fidelity", () => {
  it.each(["/", "/features", "/marketplaces/ozon", "/contacts", "/help"])("uses the same account action on %s", (pathname) => {
    const document = header("ru", pathname);
    const cta = document.querySelector(".public-header-cta");
    expect(cta?.textContent).toContain("Попробовать бесплатно");
    expect(cta?.getAttribute("href")).toBe("https://app.mpreply.ru/auth/register?intent=connect-marketplace");
    expect(document.querySelector(".public-login-link")?.getAttribute("href")).toBe("https://app.mpreply.ru/auth/login");
  });

  it("marks the parent marketplace route active and switches locale without losing the detail path", () => {
    const document = header("en", "/en/marketplaces/ozon");
    expect(document.querySelector(".public-nav a[aria-current=page]")?.getAttribute("href")).toBe("/en/marketplaces");
    expect(document.querySelector(".public-language-link")?.getAttribute("href")).toBe("/marketplaces/ozon");
    expect(document.querySelector(".public-header-cta")?.textContent).toContain("Start free");
    expect(document.querySelector(".public-header-cta")?.getAttribute("href")).toBe("https://app.mpreply.ru/en/auth/register?intent=connect-marketplace");
  });

  it("keeps shared navigation at least 14px and accessible control sizes", () => {
    const nav = css.match(/\.public-root \.public-nav\s*\{([^}]+)\}/)?.[1];
    expect(Number(nav?.match(/font-size:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(14);
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain(":has(.mockup-page)");
  });

  it("loads shared header styling before the blue palette and readable type layers", () => {
    for (const after of ["public-inner-blue-reference.css", "public-readable-type.css"]) {
      expect(layout.indexOf(after)).toBeGreaterThan(layout.indexOf("public-header-fidelity.css"));
    }
  });
});
