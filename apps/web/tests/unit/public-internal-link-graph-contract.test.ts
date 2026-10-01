import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderServer } from "../helpers/render-server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "../../app/page";
import FeaturesPage from "../../app/features/page";
import MarketplacesPage from "../../app/marketplaces/page";
import PricingPage from "../../app/pricing/page";
import ContactsPage from "../../app/contacts/page";
import HelpPage from "../../app/help/page";
import { getHelpContent } from "../../lib/help-content";
import { getSiteConfig } from "../../lib/site-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "test-nonce" }) }));
async function page(Page: typeof HomePage) {
  return new DOMParser().parseFromString(await renderServer(createElement(Page)), "text/html");
}
function destinations(document: Document, selector: string) {
  return Array.from(document.querySelectorAll(selector)).map((link) => link.getAttribute("href"));
}

describe("public internal link graph", () => {
  it("keeps commercial and support routes globally discoverable with real localized links", async () => {
    for (const locale of ["ru", "en"] as const) {
      const prefix = locale === "en" ? "/en" : "";
      expect(getSiteConfig(locale).navigation.map((item) => item.href)).toEqual(["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts"].map((route) => prefix + route));
    }
    const document = await page(HomePage);
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts", "/privacy", "/terms"]) {
      expect(destinations(document, "header a, footer a")).toContain(route);
    }
  });

  it("keeps contextual marketplace discovery and real demo/account conversion after CTA-strip removal", async () => {
    const home = await page(HomePage);
    const marketplaces = await page(MarketplacesPage);
    for (const slug of ["wildberries", "ozon", "yandex-market", "avito"]) {
      expect(destinations(home, "main a")).toContain("/marketplaces/" + slug);
      expect(destinations(marketplaces, "main a")).toContain("/marketplaces/" + slug);
    }
    for (const Page of [HomePage, FeaturesPage, MarketplacesPage]) {
      const document = await page(Page);
      expect(destinations(document, "main a")).toContain("/demo");
      expect(destinations(document, "main a")).toContain("/auth/register?intent=connect-marketplace");
    }
    expect(destinations(await page(PricingPage), "main a")).toContain("/contacts#contact-form");
    expect((await page(ContactsPage)).querySelector("#contact-form")).not.toBeNull();
  });

  it("resolves emitted local links to real app routes", async () => {
    for (const Page of [HomePage, FeaturesPage, MarketplacesPage, PricingPage, ContactsPage, HelpPage]) {
      for (const href of destinations(await page(Page), "a")) {
        if (!href?.startsWith("/")) continue;
        const route = href.split(/[?#]/)[0];
        expect(existsSync(join(process.cwd(), "app", route, "page.tsx")), href).toBe(true);
      }
    }
  });

  it("keeps support next steps in help content without retired FAQ structured data", () => {
    const helpLinks = getHelpContent("ru").questions.map((item) => item.link?.href);
    for (const route of ["/marketplaces", "/pricing", "/demo", "/contacts"]) expect(helpLinks).toContain(route);
    expect(renderToStaticMarkup(createElement(HelpPage))).not.toContain('"@type":"FAQPage"');
  });
});
