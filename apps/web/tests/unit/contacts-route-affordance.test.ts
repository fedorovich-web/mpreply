import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ContactsPage from "../../app/contacts/page";
import ContactsPageEn from "../../app/en/contacts/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/contacts" }));

describe("contacts support affordances", () => {
  it.each([ContactsPage, ContactsPageEn])("keeps the website form and shared navigation after removing duplicate route cards", (Page) => {
    const document = new DOMParser().parseFromString(renderToStaticMarkup(createElement(Page)), "text/html");
    expect(document.querySelector("form#contact-form")).not.toBeNull();
    expect(document.querySelector("form button[type=submit]")).not.toBeNull();
    expect(document.querySelector(".contact-support-route")).toBeNull();
    expect(document.querySelector(".contacts-render-final")).toBeNull();
    expect(document.querySelector("header nav a[href$='/demo']")).not.toBeNull();
    expect(document.querySelector("header a[href$='/auth/register?intent=connect-marketplace']")).not.toBeNull();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
