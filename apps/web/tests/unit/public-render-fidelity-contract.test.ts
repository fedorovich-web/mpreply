import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ContactsPage from "../../app/contacts/page";
import ContactsPageEn from "../../app/en/contacts/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/contacts" }));
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("contact render composition after approved cleanup", () => {
  it.each([{ Page: ContactsPage, title: "Свяжитесь с нами", formTitle: "Напишите нам" }, { Page: ContactsPageEn, title: "Contact us", formTitle: "Send us a message" }])("keeps the hero, website form and support details for $title", ({ Page, title, formTitle }) => {
    const document = new DOMParser().parseFromString(renderToStaticMarkup(createElement(Page)), "text/html");
    expect(document.querySelector(".contacts-render-hero h1")?.textContent).toBe(title);
    expect(document.querySelector(".contacts-render-section-head h2")?.textContent).toBe(formTitle);
    expect(document.querySelector(".contacts-render-main form#contact-form")).not.toBeNull();
    expect(document.querySelector(".contacts-render-info-column")?.textContent).toContain("support@mpreply.ru");
    expect(document.querySelector(".contacts-render-hero-copy .eyebrow")).toBeNull();
    expect(document.querySelector(".contact-support-route")).toBeNull();
    expect(document.querySelector(".contacts-render-final")).toBeNull();
  });

  it("keeps security guidance and the verified channel without fictional contact details", () => {
    const text = new DOMParser().parseFromString(renderToStaticMarkup(createElement(ContactsPage)), "text/html").querySelector("main")?.textContent;
    expect(text).toContain("Не отправляйте ключи доступа, пароли");
    expect(text).not.toMatch(/Telegram|VK|YouTube|до 2 часов|sales@|demo@/);
  });

  it("loads contact and 404 composition after the blue palette while retaining the shared hero system", () => {
    const css = read("styles/public-contact-404-render.css");
    const layout = read("app/layout.tsx");
    expect(css).toContain(".contacts-render-page");
    expect(css).toContain(".not-found-render-page");
    expect(css).toContain("#0b68f6");
    expect(layout.indexOf("public-contact-404-render.css")).toBeGreaterThan(layout.indexOf("public-inner-blue-reference.css"));
    expect(layout.indexOf("homepage-reference-restore.css")).toBeGreaterThan(layout.indexOf("public-contact-404-render.css"));
    expect(layout.indexOf("public-hero-system.css")).toBeGreaterThan(layout.indexOf("public-contact-404-render.css"));
  });
});
