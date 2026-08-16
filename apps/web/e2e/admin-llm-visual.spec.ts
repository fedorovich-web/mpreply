import { expect, test } from "@playwright/test";

import { mockAdminLLMApi } from "./helpers/admin-llm-api";

test("admin model workspace desktop visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await mockAdminLLMApi(page);
  await page.goto("/app/admin/llm", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Модели AI" })).toBeVisible();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page).toHaveScreenshot("admin-llm-desktop.png", { fullPage: true });
});
