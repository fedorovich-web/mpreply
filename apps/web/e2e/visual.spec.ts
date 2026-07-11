import { expect, test } from "@playwright/test";
import { VISUAL_ROUTES } from "./helpers/public-routes";

for (const route of VISUAL_ROUTES) {
  test(`${route.slug} desktop visual baseline`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(route.path, { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${route.slug}-desktop.png`, { fullPage: true });
  });

  test(`${route.slug} mobile visual baseline`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route.path, { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${route.slug}-mobile.png`, { fullPage: true });
  });
}
