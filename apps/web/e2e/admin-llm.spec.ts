import { expect, test } from "@playwright/test";

import { mockAdminLLMApi } from "./helpers/admin-llm-api";

test("superadmin validates a key and saves model routes without retaining the secret", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAdminLLMApi(page);
  await page.goto("/app/admin/llm", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Модели AI" })).toBeVisible();
  await expect(page.getByText("Ключ из админки")).toBeVisible();
  const keyInput = page.getByLabel("Новый inference-ключ OpenRouter");
  await expect(keyInput).toHaveAttribute("type", "password");
  await expect(keyInput).toHaveValue("");

  await keyInput.fill("sk-or-v1-browser-candidate");
  await page.getByRole("button", { name: "Проверить ключ и модели" }).click();
  await expect(page.getByText("Доступно моделей: 6")).toBeVisible();

  const saveRequest = page.waitForRequest((request) =>
    request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/llm/openrouter",
  );
  await page.getByRole("button", { name: "Сохранить маршруты" }).click();
  const payload = (await saveRequest).postDataJSON() as Record<string, unknown>;
  expect(payload.api_key).toBe("sk-or-v1-browser-candidate");
  expect(Object.keys(payload.routes as Record<string, unknown>)).toHaveLength(6);
  await expect(keyInput).toHaveValue("");
  await expect(page.getByRole("status")).toContainText("Конфигурация сохранена");
  await expect(page.getByText("sk-or-v1-browser-candidate", { exact: true })).toHaveCount(0);
});

test("admin model workspace fits desktop and mobile without horizontal overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAdminLLMApi(page);
  await page.goto("/app/admin/llm", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("local deletion requires confirmation and does not claim provider revocation", async ({ page }) => {
  await mockAdminLLMApi(page);
  await page.goto("/app/admin/llm", { waitUntil: "networkidle" });
  await expect(page.getByText(/не отзывает ключ в OpenRouter/i)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить локальный ключ" }).click();
  await expect(page.getByRole("status")).toContainText("В OpenRouter ключ не отозван");
});
