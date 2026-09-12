import { expect, test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";

test("integrations overview exposes one live integration and three planned marketplaces", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  await expect(page.getByText("Интеграция готова")).toHaveCount(1);
  await expect(page.getByText("Планируется", { exact: true })).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Управлять Wildberries" })).toHaveAttribute("href", "/app/integrations/wildberries");
  await expect(page.getByRole("link", { name: "Подробнее" })).toHaveCount(3);
  await expect(page.getByRole("link", { name: /Подключить (Ozon|Яндекс Маркет|Авито)/ })).toHaveCount(0);
});

test("owner sees live Wildberries account and can run validation and sync", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "WB основной кабинет" })).toBeVisible();
  await page.getByRole("button", { name: "Проверить подключение" }).click();
  await expect(page.getByText("Подключение работает.")).toBeVisible();
  await page.getByRole("button", { name: "Синхронизировать сейчас" }).click();
  await expect(page.getByText(/Синхронизация завершена: новых обращений 6, обновлено 1, без изменений 0/)).toBeVisible();
});

for (const integration of [
  { path: "/app/integrations/ozon", name: "Ozon" },
  { path: "/app/integrations/yandex-market", name: "Яндекс Маркет" },
  { path: "/app/integrations/avito", name: "Авито" },
]) {
  test(`${integration.name} route stays informational while the integration is planned`, async ({ page }) => {
    await mockIntegrationsApi(page, "owner");
    await page.goto(integration.path, { waitUntil: "networkidle" });

    await expect(page.getByText("Планируется", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: `${integration.name} — интеграция планируется` })).toBeVisible();
    await expect(page.getByText("Подключение пока недоступно", { exact: true })).toBeVisible();
    await expect(page.getByRole("form", { name: `Новое подключение ${integration.name}` })).toHaveCount(0);
    await expect(page.getByText("Интеграция готова", { exact: true })).toHaveCount(0);
  });
}

test("viewer sees integration health without credential actions", async ({ page }) => {
  await mockIntegrationsApi(page, "viewer");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  await expect(page.getByText("Только просмотр")).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить подключение" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Синхронизировать сейчас" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Отозвать ключ" })).toHaveCount(0);
});
