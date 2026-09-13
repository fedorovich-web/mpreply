import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./helpers/public-routes";

for (const route of PUBLIC_ROUTES) {
  test(`${route} renders a valid public page`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response, `Expected document response for ${route}`).not.toBeNull();
    expect(response?.ok(), `Expected ${route} to return success`).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1:visible"), `${route} must have exactly one visible h1`).toHaveCount(1);
  });
}

test("primary navigation reaches features and pricing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /возможност/i }).first().click();
  await expect(page).toHaveURL(/\/features$/);
  await page.goto("/");
  await page.getByRole("link", { name: /тариф|цен/i }).first().click();
  await expect(page).toHaveURL(/\/pricing$/);
});

test("mobile navigation traps focus, locks scroll and restores focus on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const trigger = page.getByRole("button", { name: "Открыть меню" });
  await trigger.click();

  const panel = page.locator(".public-mobile-menu-panel");
  const focusable = panel.locator('a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])');
  const firstFocusable = focusable.first();
  const lastFocusable = focusable.last();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(firstFocusable).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Shift+Tab");
  await expect(lastFocusable).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstFocusable).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("mobile navigation releases scroll lock when viewport becomes desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const trigger = page.getByRole("button", { name: "Открыть меню" });
  await trigger.click();
  await expect(page.locator(".public-mobile-menu-panel")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(page.locator(".public-mobile-menu-panel")).toBeHidden();
  await expect(page.locator(".public-mobile-menu-backdrop")).toHaveCount(0);
  await expect(trigger).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("auth mode links preserve only explicit safe navigation intent", async ({ page }) => {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Создать аккаунт" }).last()).toHaveAttribute("href", "/auth/register");

  await page.goto("/auth/login?intent=connect-marketplace", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Создать аккаунт" }).last()).toHaveAttribute(
    "href",
    "/auth/register?intent=connect-marketplace",
  );

  await page.goto("/auth/login?next=%2Fapp%2Finbox", { waitUntil: "domcontentloaded" });
  const safeNextLink = page.getByRole("link", { name: "Создать аккаунт" }).last();
  await expect(safeNextLink).toHaveAttribute("href", "/auth/register?next=%2Fapp%2Finbox");
  await expect(safeNextLink).not.toHaveAttribute("href", /intent=/);
});

test("homepage reflects the ready marketplace integrations", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const marketplaceList = page.locator(".homepage-marketplace-list");
  await expect(marketplaceList.locator("a")).toHaveCount(4);

  for (const marketplace of ["Wildberries", "Ozon", "Яндекс Маркет", "Авито"]) {
    await expect(marketplaceList.getByText(marketplace, { exact: true })).toBeVisible();
  }

  const pageCopy = await page.locator("main").innerText();
  expect(pageCopy).not.toMatch(/3\s+маркетплейса/i);
  expect(pageCopy).not.toMatch(/интеграц(?:ия|ии).{0,24}(?:скоро|планиру|в разработке)/i);
  expect(pageCopy).not.toMatch(/GPT-5\.6|Claude Sonnet|Gemini 3\.8|DeepSeek V4/i);
});

test("public pages emit no uncaught page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of PUBLIC_ROUTES) await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(errors).toEqual([]);
});
