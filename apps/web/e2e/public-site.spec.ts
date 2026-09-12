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

  test(`${route} fits a 390px mobile viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(viewport.scrollWidth, `${route} must not overflow horizontally`).toBe(viewport.clientWidth);
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

test("public pages emit no uncaught page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of PUBLIC_ROUTES) await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(errors).toEqual([]);
});
