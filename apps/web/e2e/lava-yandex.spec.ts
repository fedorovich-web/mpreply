import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockIntegrationsApi } from "./helpers/integrations-api";

const org = "11111111-1111-4111-8111-111111111111";
const other = "11111111-1111-4111-8111-222222222222";
const orderId = "44444444-4444-4444-8444-444444444444";
const at = "2026-10-01T12:00:00Z";
const catalog = { enabled: true, can_purchase: true, currency: "RUB", plans: [{ code: "start", amount_month_minor: 129000, amount_year_minor: 1238400, monthly_credits: 300 }], packs: [{ quantity: 50, amount_minor: 29900 }] };
function order(organization_id = org, state = "pending") { return { id: orderId, organization_id, kind: "plan", amount_minor: 129000, currency: "RUB", state, payment_url: "https://app.lava.top/pay/synthetic", monthly_credits: 300, addon_credits: 0, created_at: at, paid_at: state === "paid" ? at : null, last_error: null }; }
async function mockBilling(page: Page, role: "owner" | "viewer" = "owner") {
  await mockIntegrationsApi(page, role, { includeSecondOrganization: true });
  await page.route("**/api/billing/overview**", (route) => route.fulfill({ json: {
    organization_id: new URL(route.request().url()).searchParams.get("organization_id"),
    plan: { id: orderId, code: "start", name: "Start", price_month_minor: 129000, currency: "RUB", limits_json: {}, features_json: {}, is_active: true, is_default: true },
    subscription: null, usage_period_start: at, usage_period_end: "2026-11-01T12:00:00Z", usage: [], pricing_finalized: true,
  } }));
  await page.route("**/api/billing/catalog**", (route) => route.fulfill({ json: { ...catalog, can_purchase: role === "owner" } }));
  await page.route("**/api/billing/orders?**", (route) => route.fulfill({ json: [] }));
}

test("manual checkout survives reload and confirms only the server status", async ({ page }) => {
  await mockBilling(page);
  let posts = 0;
  let state = "pending";
  await page.route("**/api/billing/orders", async (route) => {
    posts += 1;
    const body = route.request().postDataJSON();
    expect(body.amount_minor).toBeUndefined();
    expect(body.organization_id).toBe(org);
    await route.fulfill({ json: order(org, state) });
  });
  await page.route(`**/api/billing/orders/${orderId}?**`, (route) => route.fulfill({ json: order(org, state) }));
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Подготовить оплату" }).click();
  await expect(page.getByRole("link", { name: "Продолжить оплату в Lava" })).toHaveAttribute("href", "https://app.lava.top/pay/synthetic");
  await page.reload();
  await expect(page.getByRole("link", { name: "Продолжить оплату в Lava" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Подготовить оплату" })).toHaveCount(0);
  expect(posts).toBe(1);
  state = "paid";
  await page.getByRole("button", { name: "Обновить статус" }).click();
  await expect(page.getByText("Оплата подтверждена. Тариф или ответы начислены.")).toBeVisible();
  expect(posts).toBe(1);
});

test("organization switch hides the previous order", async ({ page }) => {
  await mockBilling(page);
  await page.route("**/api/billing/orders", (route) => route.fulfill({ json: order() }));
  await page.route(`**/api/billing/orders/${orderId}?**`, (route) => route.fulfill({ json: order() }));
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Подготовить оплату" }).click();
  await expect(page.getByRole("link", { name: "Продолжить оплату в Lava" })).toBeVisible();
  await page.getByLabel("Выбрать рабочее пространство").selectOption(other);
  await expect(page.getByRole("link", { name: "Продолжить оплату в Lava" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Подготовить оплату" })).toBeVisible();
});

test("viewer has no payment action", async ({ page }) => {
  await mockBilling(page, "viewer");
  await page.goto("/app/billing");
  await expect(page.getByText("Оплачивать тариф может владелец или администратор.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Подготовить оплату" })).toHaveCount(0);
});

test("Yandex login preserves the marketplace intent", async ({ page }) => {
  await page.route("**/api/auth/providers", (route) => route.fulfill({ json: { yandex: true } }));
  await page.goto("/auth/register?next=%2Fapp%2Fintegrations&intent=connect-marketplace");
  const link = page.getByRole("link", { name: "Войти через Яндекс" });
  await expect(link).toBeVisible();
  const url = new URL((await link.getAttribute("href"))!, "http://localhost:3000");
  expect(url.pathname).toBe("/api/auth/yandex/start");
  expect(url.searchParams.get("next")).toBe("/app/integrations");
  expect(url.searchParams.get("intent")).toBe("connect-marketplace");
});

for (const locale of ["ru", "en"] as const) {
  test(`auth recovery actions reach working forms in ${locale}`, async ({ page }) => {
    const prefix = locale === "en" ? "/en" : "";
    const requests: string[] = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const headers = {
        "Access-Control-Allow-Origin": new URL(page.url()).origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (path === "/api/auth/providers") return route.fulfill({ headers, json: { yandex: false } });
      if (request.method() === "POST" && ["/api/auth/forgot-password", "/api/auth/resend-verification"].includes(path)) {
        expect(request.postDataJSON()).toEqual({ email: "synthetic-auth@example.test" });
        expect(request.headers()["x-csrf-token"]).toBe("1");
        requests.push(path);
        return route.fulfill({ headers, json: { message: "Если аккаунт существует, мы отправим инструкции по восстановлению пароля." } });
      }
      return route.abort("blockedbyclient");
    });

    for (const action of ["forgot-password", "resend-verification"]) {
      await page.goto(`${prefix}/auth/login`);
      await page.locator(`a[href="${prefix}/auth/${action}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/auth/${action}$`));
      const formViolations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations;
      expect(formViolations).toEqual([]);
      await page.getByLabel("Email", { exact: true }).fill("synthetic-auth@example.test");
      await page.locator("form").getByRole("button").click();
      await expect(page.getByRole("status")).toContainText(locale === "en" ? /check.*email/i : /Если аккаунт существует/);
      if (locale === "en") await expect(page.getByRole("status")).not.toContainText("Если аккаунт");
      const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations;
      expect(violations).toEqual([]);
    }
    expect(requests).toEqual(["/api/auth/forgot-password", "/api/auth/resend-verification"]);
  });
}

test("payment and linked account screens fit mobile and pass accessibility checks", async ({ page }, testInfo) => {
  await mockBilling(page);
  await page.route("**/api/auth/identities", (route) => route.fulfill({ json: { yandex_linked: true, can_link_yandex: false } }));
  for (const path of ["/app/billing", "/app/account"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.getByRole("heading", { name: path.endsWith("billing") ? "Оплата тарифа и ответов" : "Вход через Яндекс" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations;
    expect(violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(path.endsWith("billing") ? "billing-mobile.png" : "account-mobile.png"), fullPage: true });
  }
});
