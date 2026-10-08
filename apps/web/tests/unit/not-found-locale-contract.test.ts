import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NotFound from "../../app/not-found";

const state = vi.hoisted(() => ({ locale: "ru" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-mpreply-locale": state.locale }) }));
vi.mock("next/navigation", () => ({ usePathname: () => state.locale === "en" ? "/en/missing" : "/missing" }));

describe("locale-aware not found page", () => {
  it.each([{ locale: "ru", title: "Страница не найдена", final: "Не нашли, что искали?", prefix: "" }, { locale: "en", title: "Page not found", final: "Still looking for something?", prefix: "/en" }])("renders localized copy and recovery destinations for $locale", async ({ locale, title, final, prefix }) => {
    state.locale = locale;
    const document = new DOMParser().parseFromString(renderToStaticMarkup(await NotFound()), "text/html");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("h1")?.textContent).toBe(title);
    expect(document.querySelector(".not-found-render-final h2")?.textContent).toBe(final);
    const links = Array.from(document.querySelectorAll("main a")).map((link) => link.getAttribute("href"));
    for (const route of ["/features", "/pricing", "/marketplaces", "/help", "/contacts"]) {
      expect(links).toContain(prefix + route);
    }
    expect(links).toContain(prefix || "/");
    expect(document.querySelectorAll("header, footer")).toHaveLength(2);
  });

  it("uses supplied raster assets as decorative illustration", async () => {
    const document = new DOMParser().parseFromString(renderToStaticMarkup(await NotFound()), "text/html");
    const scene = document.querySelector(".not-found-render-scene");
    expect(scene?.getAttribute("aria-hidden")).toBe("true");
    expect(scene?.querySelector("svg")).toBeNull();
    for (const src of ["/images/approved/03-404-robot.avif", "/images/approved/03-404-number.avif"]) {
      expect(scene?.querySelector("img[src='" + src + "']")?.getAttribute("alt")).toBe("");
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    }
  });
});
