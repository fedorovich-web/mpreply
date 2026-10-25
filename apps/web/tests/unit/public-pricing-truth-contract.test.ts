import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PricingPage from "../../app/pricing/page";
import PricingPageEn from "../../app/en/pricing/page";
import { monthlyPlans, replyPacks } from "../../lib/pricing-calculator";
import { appOrigin } from "../../lib/site-config";

vi.mock("../../components/public-site/PublicShell", () => ({ PublicShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../components/public-site/PricingCalculators", () => ({ PricingCalculators: () => null }));

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const pricing = read("app/pricing/page.tsx");
function documentFor(locale: "ru" | "en") {
  return new DOMParser().parseFromString(renderToStaticMarkup(createElement(locale === "ru" ? PricingPage : PricingPageEn)), "text/html");
}

const approvedPlans = [
  { ru: "Старт", en: "Start", price: "1 290 ₽", allowanceRu: "300 ИИ-ответов в месяц", allowanceEn: "300 AI-generated replies per month" },
  { ru: "Команда", en: "Team", price: "3 490 ₽", allowanceRu: "800 ИИ-ответов в месяц", allowanceEn: "800 AI-generated replies per month" },
  { ru: "Бизнес", en: "Business", price: "6 990 ₽", allowanceRu: "1 600 ИИ-ответов в месяц", allowanceEn: "1,600 AI-generated replies per month" },
] as const;

function cardFor(doc: Document, name: string) {
  const card = Array.from(doc.querySelectorAll(".pricing-card")).find((item) => item.querySelector("h3")?.textContent === name);
  expect(card, `Missing plan card: ${name}`).toBeDefined();
  return card!;
}

describe("approved public pricing contract", () => {
  it.each(["ru", "en"] as const)("renders four plans with the approved fixed prices and monthly allowances (%s)", (locale) => {
    const doc = documentFor(locale);
    expect(doc.querySelectorAll(".pricing-card")).toHaveLength(4);
    for (const plan of approvedPlans) {
      const card = cardFor(doc, plan[locale]);
      expect(card.querySelector(".pricing-price strong")?.textContent).toBe(plan.price);
      expect(card.textContent).toContain(locale === "ru" ? plan.allowanceRu : plan.allowanceEn);
      expect(card.querySelector("a")?.getAttribute("href")).toBe(`${appOrigin}${locale === "en" ? "/en" : ""}/auth/register?intent=connect-marketplace`);
    }
  });

  it.each(["ru", "en"] as const)("uses the website quote form for Corporate without turning Business into sales-only (%s)", (locale) => {
    const card = cardFor(documentFor(locale), locale === "ru" ? "Корпоративный" : "Corporate");
    expect(card.querySelector(".pricing-price strong")?.textContent).toBe(locale === "ru" ? "По запросу" : "Custom price");
    expect(card.querySelector("a")?.getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/contacts#contact-form`);
    expect(card.textContent).not.toMatch(/SLA|99[,.]9%|\d[\d\s]*\s*₽/);
  });

  it("preserves the owner-approved plan limits, history and automation tiers", () => {
    const doc = documentFor("ru");
    const expectations = [
      ["Старт", "Подключение до 2 маркетплейсов", "До 2 пользователей", "Базовые автоответы", "История за 3 месяца"],
      ["Команда", "Подключение до 5 маркетплейсов", "До 10 пользователей", "Расширенные автоответы и сценарии", "Продвинутая аналитика", "История за 12 месяцев", "Роли и права доступа"],
      ["Бизнес", "Подключение любых маркетплейсов", "Неограниченное число пользователей", "Роли и права доступа"],
    ];
    for (const [name, ...features] of expectations) {
      const card = cardFor(doc, name);
      for (const feature of features) expect(card.textContent).toContain(feature);
    }
    const rows = Array.from(doc.querySelectorAll(".pricing-comparison tbody tr"));
    expect(rows.find((row) => row.firstElementChild?.textContent === "Приоритетная поддержка")?.textContent).toContain("Выделенный менеджер");
    expect(rows.find((row) => row.firstElementChild?.textContent === "История обращений")?.textContent).toContain("Без ограничений");
  });

  it("keeps the exact reply pack catalog and monthly plan amounts in the calculator", () => {
    expect(monthlyPlans.map(({ replies, priceRub }) => [replies, priceRub])).toEqual([[300, 1290], [800, 3490], [1600, 6990]]);
    expect(replyPacks.map(({ replies, priceRub }) => [replies, priceRub])).toEqual([
      [50, 299], [100, 549], [250, 1290], [500, 2490], [1000, 4790],
      [2000, 9290], [5000, 22490], [10000, 43900], [15000, 65400], [20000, 86900],
    ]);
  });

  it("keeps trial expiry separate from paid carryover and requires an active paid plan", () => {
    for (const value of ["Пробные 350 ответов сгорают через 14 дней", "Оплаченные ответы сохраняются без срока сгорания", "при действующем оплаченном тарифе", "Каждый новый ИИ-вариант расходует один ответ"]) expect(pricing).toContain(value);
    const en = read("app/en/pricing/page.tsx");
    expect(en).toContain("Paid replies carry over without an expiry date");
    expect(en).toContain("active paid plan");
    expect(en).toContain("350 trial replies expire after 14 days");
    expect(en).toContain("20% discount");
    expect(pricing).toContain("скидка 20%");
  });

  it("keeps AI auto-replies in the comparison for both locales", () => {
    for (const locale of ["ru", "en"] as const) {
      const doc = documentFor(locale);
      const label = locale === "ru" ? "ИИ-автоответы" : "AI auto-replies with context";
      const row = Array.from(doc.querySelectorAll(".pricing-comparison tbody tr")).find((item) => item.firstElementChild?.textContent === label);
      expect(row).toBeDefined();
      expect(Array.from(row!.querySelectorAll("td")).slice(1, 4).map((item) => item.textContent)).toEqual(["✓", "✓", "✓"]);
    }
  });

  it("retains public payment-provider transparency until the production-domain launch step", () => {
    expect(pricing).toContain("после подключения платёжного провайдера на рабочем домене MPReply");
    expect(pricing).not.toMatch(/checkout|stripe|yookassa|купить тариф/i);
  });
});
