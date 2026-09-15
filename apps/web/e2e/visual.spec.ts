import { expect, test } from "@playwright/test";
import { VISUAL_ROUTES } from "./helpers/public-routes";

const RESPONSIVE_VIEWPORTS = [
  { name: "render-width", width: 1086, height: 1000 },
  { name: "tablet-landscape", width: 1024, height: 900 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile-wide", width: 430, height: 932 },
] as const;

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

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test(`mockup pages stay within viewport at ${viewport.width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of VISUAL_ROUTES.filter(({ path }) => path !== "/")) {
      const response = await page.goto(route.path, { waitUntil: "networkidle" });
      expect(response?.ok(), `${route.path} should render at ${viewport.width}px`).toBe(true);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1:visible"), `${route.path} must keep one visible h1`).toHaveCount(1);

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        overflow.scrollWidth,
        `${route.path} overflows horizontally at ${viewport.width}px`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    }
  });
}
