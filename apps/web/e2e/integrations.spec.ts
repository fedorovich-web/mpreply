import { expect, test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";

test("owner sees live Wildberries account and can run validation and sync", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "WB основной кабинет" })).toBeVisible();
  await page.getByRole("button", { name: "Проверить ключ" }).click();
  await expect(page.getByText("API-ключ успешно проверен.")).toBeVisible();
  await page.getByRole("button", { name: "Синхронизировать сейчас" }).click();
  await expect(page.getByText(/Синхронизация завершена: новых 6, обновлено 1, пропущено 0/)).toBeVisible();
});

test("viewer sees integration health without credential actions", async ({ page }) => {
  await mockIntegrationsApi(page, "viewer");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  await expect(page.getByText("Только просмотр")).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить ключ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Синхронизировать сейчас" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Отозвать ключ" })).toHaveCount(0);
});
