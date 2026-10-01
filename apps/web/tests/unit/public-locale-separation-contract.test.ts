import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as Home from "../../app/en/page";
import * as Features from "../../app/en/features/page";
import * as Marketplaces from "../../app/en/marketplaces/page";
import * as Wildberries from "../../app/en/marketplaces/wildberries/page";
import * as Ozon from "../../app/en/marketplaces/ozon/page";
import * as Yandex from "../../app/en/marketplaces/yandex-market/page";
import * as Avito from "../../app/en/marketplaces/avito/page";
import * as Pricing from "../../app/en/pricing/page";
import * as Demo from "../../app/en/demo/page";
import * as Help from "../../app/en/help/page";
import * as Contacts from "../../app/en/contacts/page";
import * as Privacy from "../../app/en/privacy/page";
import * as Terms from "../../app/en/terms/page";
import sitemap from "../../app/sitemap";
import { localizedPath } from "../../lib/i18n";
import { getHelpContent } from "../../lib/help-content";
import { indexablePublicRoutes, siteConfig } from "../../lib/site-config";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
const pages = [
  { path: "/", page: Home }, { path: "/features", page: Features },
  { path: "/marketplaces", page: Marketplaces },
  { path: "/marketplaces/wildberries", page: Wildberries }, { path: "/marketplaces/ozon", page: Ozon },
  { path: "/marketplaces/yandex-market", page: Yandex }, { path: "/marketplaces/avito", page: Avito },
  { path: "/pricing", page: Pricing }, { path: "/demo", page: Demo }, { path: "/help", page: Help },
  { path: "/contacts", page: Contacts }, { path: "/privacy", page: Privacy }, { path: "/terms", page: Terms },
];

describe("public RU/EN separation", () => {
  it.each(pages)("keeps rendered English text and local navigation separate on $path", ({ page }) => {
    const document = new DOMParser().parseFromString(renderToStaticMarkup(createElement(page.default)), "text/html");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]/);
    for (const link of document.querySelectorAll("a")) {
      const href = link.getAttribute("href");
      if (!href?.startsWith("/") || link.getAttribute("hreflang") === "ru") continue;
      expect(href === "/en" || href.startsWith("/en/"), href).toBe(true);
    }
  });

  it.each(pages.filter((item) => item.path !== "/demo"))("emits English canonical and reciprocal language alternates for $path", ({ path, page }) => {
    expect(page.metadata.alternates?.canonical).toBe(localizedPath("en", path));
    expect(page.metadata.alternates?.languages).toEqual({ "ru-RU": path, en: localizedPath("en", path), "x-default": path });
  });

  it("keeps the real demo entry out of search results", () => {
    expect(Demo.metadata.robots).toEqual({ index: false, follow: false });
    const document = new DOMParser().parseFromString(renderToStaticMarkup(createElement(Demo.default)), "text/html");
    expect(document.querySelector("main")?.textContent).toContain("Access is view-only");
  });

  it("keeps translated help content independent, including link labels", () => {
    const content = getHelpContent("en");
    for (const item of [...content.questions, ...content.categories]) {
      expect(JSON.stringify(item)).not.toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("emits paired locale sitemap entries with reciprocal language alternates", () => {
    const entries = sitemap();
    const absolute = (path: string) => siteConfig.origin + (path === "/" ? "" : path);
    expect(entries).toHaveLength(indexablePublicRoutes.length * 2);
    for (const path of indexablePublicRoutes) {
      const ru = absolute(path);
      const en = absolute(localizedPath("en", path));
      for (const url of [ru, en]) {
        const entry = entries.find((item) => item.url === url);
        expect(entry?.alternates?.languages).toEqual({ "ru-RU": ru, en, "x-default": ru });
      }
    }
  });
});
