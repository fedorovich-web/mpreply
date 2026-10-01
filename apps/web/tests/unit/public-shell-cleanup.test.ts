import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicShell } from "../../components/public-site/PublicShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("shared public shell", () => {
  it.each([{ locale: "ru" as const, home: true }, { locale: "ru" as const, home: false }, { locale: "en" as const, home: true }, { locale: "en" as const, home: false }])("renders the same accessible chrome for $locale home=$home", ({ locale, home }) => {
    const document = new DOMParser().parseFromString(renderToStaticMarkup(PublicShell({ locale, home, children: "Page content" })), "text/html");
    expect(document.querySelectorAll("header")).toHaveLength(1);
    expect(document.querySelectorAll("footer")).toHaveLength(1);
    expect(document.querySelectorAll("main#main-content")).toHaveLength(1);
    expect(document.querySelector(".skip-link")?.getAttribute("href")).toBe("#main-content");
    expect(document.querySelectorAll("header .brand-image-mark, footer .brand-image-mark")).toHaveLength(2);
    expect(document.querySelector(".public-root")?.classList.contains("homepage-reference-root")).toBe(home);
    const footer = document.querySelector("footer")!;
    const desktopLinks = Array.from(footer.querySelectorAll(".public-footer-desktop-group a"));
    const prefix = locale === "en" ? "/en" : "";
    for (const route of ["/features", "/marketplaces", "/pricing", "/demo", "/help", "/contacts", "/privacy", "/terms"]) {
      expect(desktopLinks.filter((link) => link.getAttribute("href") === prefix + route)).toHaveLength(1);
    }
    expect(footer.querySelector("a[href='mailto:support@mpreply.ru']")).not.toBeNull();
    expect(footer.textContent).not.toMatch(/О нас|Telegram|YouTube|Наш офис/);
  });

  it("removes the parallel homepage shell", () => {
    expect(existsSync(join(process.cwd(), "components/public-site/HomeApprovedShell.tsx"))).toBe(false);
  });
});
