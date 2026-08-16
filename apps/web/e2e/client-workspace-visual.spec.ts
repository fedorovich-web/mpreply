import { expect, test } from "@playwright/test";

import { mockClientWorkspaceApi } from "./helpers/client-workspace-api";

test("dashboard desktop visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockClientWorkspaceApi(page);
  await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  await hideDevelopmentChrome(page);
  await expect(page).toHaveScreenshot("dashboard-desktop.png");
});

test("dashboard mobile visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockClientWorkspaceApi(page);
  await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  await hideDevelopmentChrome(page);
  await expect(page).toHaveScreenshot("dashboard-mobile.png");
});

test("dashboard mobile navigation visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockClientWorkspaceApi(page);
  await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  await hideDevelopmentChrome(page);
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await expect(page).toHaveScreenshot("dashboard-mobile-navigation.png");
});

for (const pageCase of [
  { name: "reply-style-desktop.png", path: "/app/instruction-sets" },
  { name: "reply-data-desktop.png", path: "/app/knowledge-base" },
] as const) {
  test(`${pageCase.path} desktop visual baseline`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockClientWorkspaceApi(page);
    await page.goto(pageCase.path, { waitUntil: "networkidle" });
    await hideDevelopmentChrome(page);
    await expect(page).toHaveScreenshot(pageCase.name);
  });
}

test("Ozon integration desktop visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await mockClientWorkspaceApi(page, "owner", { includeOzon: true });
  await page.goto("/app/integrations/ozon", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Основной Ozon" })).toBeVisible();
  await hideDevelopmentChrome(page);
  await expect(page).toHaveScreenshot("ozon-integration-desktop.png", { fullPage: true });
});

test("Avito integration desktop visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockClientWorkspaceApi(page, "owner", { includeAvito: true });
  await page.goto("/app/integrations/avito", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Основной Авито" })).toBeVisible();
  await hideDevelopmentChrome(page);
  await expect(page).toHaveScreenshot("avito-integration-desktop.png", { fullPage: true });
});

async function hideDevelopmentChrome(page: import("@playwright/test").Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}
