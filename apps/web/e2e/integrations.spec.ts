import { expect, test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";

test("integrations overview exposes all four ready marketplace actions", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  await expect(page.getByText("Интеграция готова")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Управлять Wildberries" })).toHaveAttribute("href", "/app/integrations/wildberries");
  await expect(page.getByRole("link", { name: "Подключить Ozon" })).toHaveAttribute("href", "/app/integrations/ozon");
  await expect(page.getByRole("link", { name: "Подключить Яндекс Маркет" })).toHaveAttribute("href", "/app/integrations/yandex-market");
  await expect(page.getByRole("link", { name: "Подключить Авито" })).toHaveAttribute("href", "/app/integrations/avito");
  await expect(page.getByText("Планируется")).toHaveCount(0);
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
  { path: "/app/integrations/ozon", name: "Ozon", credential: "Данные доступа Ozon" },
  { path: "/app/integrations/yandex-market", name: "Яндекс Маркет", credential: "Данные доступа Яндекс Маркета" },
  { path: "/app/integrations/avito", name: "Авито", credential: "Данные доступа Авито" },
]) {
  test(`${integration.name} route exposes the live connection workflow`, async ({ page }) => {
    await mockIntegrationsApi(page, "owner");
    await page.goto(integration.path, { waitUntil: "networkidle" });

    await expect(page.getByText("Интеграция готова", { exact: true })).toBeVisible();
    const form = page.getByRole("form", { name: `Новое подключение ${integration.name}` });
    await expect(form).toBeVisible();
    await expect(form.getByLabel(integration.credential)).toBeVisible();
    await expect(page.getByText("Подключение пока недоступно")).toHaveCount(0);
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
