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
