import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ContactsPage from "../../app/contacts/page";
import ContactsPageEn from "../../app/en/contacts/page";
import HelpPage from "../../app/help/page";
import HelpPageEn from "../../app/en/help/page";
import { getHelpContent } from "../../lib/help-content";
import { getSiteConfig } from "../../lib/site-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/contacts" }));
const markup = () => [ContactsPage, ContactsPageEn, HelpPage, HelpPageEn].map((Page) => renderToStaticMarkup(createElement(Page))).join("\n");

describe("public support truth contract", () => {
  it("uses the single verified public email and website form", () => {
    for (const locale of ["ru", "en"] as const) expect(getSiteConfig(locale).contactEmail).toBe("support@mpreply.ru");
    const document = new DOMParser().parseFromString(markup(), "text/html");
    const emails = Array.from(document.querySelectorAll("a[href^='mailto:']")).map((link) => link.getAttribute("href"));
    expect(emails.length).toBeGreaterThan(0);
    expect(new Set(emails)).toEqual(new Set(["mailto:support@mpreply.ru"]));
    expect(document.querySelectorAll("form#contact-form")).toHaveLength(2);
    expect(markup()).not.toMatch(/(?:help|sales|demo|partners)@mpreply\.ru/);
  });

  it("does not publish invented office, hours, social channels or a support SLA", () => {
    expect(markup()).not.toMatch(/Майкоп|Чкалова|помещение 17А|09:00–18:00|Ответ в рабочее время|Наш офис|Режим работы|Telegram|YouTube|WhatsApp|до 2 часов/);
  });

  it.each(["ru", "en"] as const)("keeps task-oriented help and credential safety for %s", (locale) => {
    const content = getHelpContent(locale);
    for (const id of ["start", "integrations", "messages", "ai", "team", "pricing", "problems"]) {
      expect(content.categories.some((category) => category.id === id)).toBe(true);
    }
    const keys = content.questions.find((question) => question.id === "keys")!;
    const support = content.questions.find((question) => question.id === "support")!;
    expect(keys.answer).toMatch(locale === "ru" ? /Не присылайте ключи, пароли/ : /Do not send keys, passwords/);
    expect(support.link?.href).toBe("/contacts");
    expect(support.answer).toMatch(locale === "ru" ? /Не прикладывайте API-ключи/ : /Do not include API keys/);
  });

  it("describes Ozon capability limits and the read-only demo rather than restoring planned integrations", () => {
    const questions = getHelpContent("ru").questions;
    expect(questions.find((item) => item.id === "ozon")?.answer).toContain("зависит от возможностей API");
    expect(questions.find((item) => item.id === "demo")?.answer).toContain("отправка ответов в демо отключены");
    expect(questions.find((item) => item.id === "connect")?.question).toMatch(/Wildberries, Ozon, Яндекс Маркет и Авито/);
    expect(questions.map((item) => item.answer).join(" ")).not.toMatch(/интеграция (?:планируется|в разработке)/i);
  });
});
