import { expect, test } from "@playwright/test";
import { VISUAL_ROUTES } from "./helpers/public-routes";

const MOCKUP_ROUTES = VISUAL_ROUTES.filter((route) => route.path !== "/");

test("approved mockup pages have no broken image assets", async ({ page }) => {
  for (const route of MOCKUP_ROUTES) {
    await page.goto(route.path, { waitUntil: "networkidle" });
    const images = page.locator("img");

    for (let index = 0; index < (await images.count()); index += 1) {
      const image = images.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(
          () => image.evaluate((element) => element.complete && element.naturalWidth > 0 && element.naturalHeight > 0),
          { message: `${route.path} contains a broken image at index ${index}` },
        )
        .toBe(true);
    }
  }
});

test("approved mockup pages emit no hydration console errors", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/hydration|hydrating|server rendered html|did not match/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });

  for (const route of MOCKUP_ROUTES) {
    await page.goto(route.path, { waitUntil: "networkidle" });
  }

  expect(hydrationErrors).toEqual([]);
});

test("approved FAQ sections expand in pricing and marketplace detail", async ({ page }) => {
  for (const path of ["/pricing", "/marketplaces/wildberries"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const firstFaq = page.locator("details").first();
    await expect(firstFaq).toBeVisible();
    await firstFaq.locator("summary").click();
    await expect(firstFaq).toHaveAttribute("open", "");
  }
});

test("removed resources route stays absent at runtime", async ({ page }) => {
  const response = await page.goto("/resources", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response?.status()).toBe(404);
});
