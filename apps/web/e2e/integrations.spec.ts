import { expect, test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";

test("owner sees live Wildberries account and can run validation and sync", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "WB основной кабинет" })).toBeVisible();
  await page.getByRole("button", { name: "Проверить доступ" }).click();
  await expect(page.getByText("Доступ к API подтверждён.")).toBeVisible();
  await page.getByRole("button", { name: "Синхронизировать сейчас" }).click();
  await expect(page.getByText(/Синхронизация завершена: новых 6, обновлено 1, пропущено 0/)).toBeVisible();
});

test("viewer sees integration health without credential actions", async ({ page }) => {
  await mockIntegrationsApi(page, "viewer");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  await expect(page.getByText("Только просмотр")).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить доступ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Синхронизировать сейчас" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Отозвать доступ" })).toHaveCount(0);
});

for (const { marketplace, path, heading } of [
  { marketplace: "ozon" as const, path: "ozon", heading: "Подключения Ozon" },
  { marketplace: "yandex_market" as const, path: "yandex-market", heading: "Подключения Яндекс Маркет" },
  { marketplace: "avito" as const, path: "avito", heading: "Подключения Авито" },
]) {
  test(`owner can open and sync ${marketplace} account`, async ({ page }) => {
    await mockIntegrationsApi(page, "owner", marketplace);
    await page.goto(`/app/integrations/${path}`, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await page.getByRole("button", { name: "Синхронизировать сейчас" }).click();
    await expect(page.getByText(/Синхронизация завершена: новых 6, обновлено 1, пропущено 0/)).toBeVisible();
  });
}
