import { expect, test } from "@playwright/test";

import { mockClientWorkspaceApi } from "./helpers/client-workspace-api";

const widths = [1440, 1280, 1024, 768, 430, 390, 375] as const;
const routes = ["/app/dashboard", "/app/inbox", "/app/instruction-sets", "/app/knowledge-base"] as const;

for (const width of widths) {
  test(`client workspace fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 1000 });
    await mockClientWorkspaceApi(page);

    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} overflows at ${width}px`).toBe(true);
    }
  });
}

test("owner can open customer management pages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockClientWorkspaceApi(page);

  await page.goto("/app/instruction-sets", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Основной стиль" })).toBeVisible();
  await page.goto("/app/knowledge-base", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Сроки доставки" })).toBeVisible();
  await page.goto("/app/team", { waitUntil: "networkidle" });
  await expect(page.getByRole("article").getByText("owner@example.com")).toBeVisible();
  await page.goto("/app/settings", { waitUntil: "networkidle" });
  await expect(page.getByLabel("Название организации")).toHaveValue("Демо-магазин");
  await page.goto("/app/audit-log", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Действий пока нет" })).toBeVisible();
});

test("viewer sees read-only customer boundaries", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockClientWorkspaceApi(page, "viewer");

  await page.goto("/app/team", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Список сотрудников недоступен" })).toBeVisible();
  await page.goto("/app/settings", { waitUntil: "networkidle" });
  await expect(page.getByLabel("Название организации")).toBeDisabled();
});

test("mobile navigation opens from the right and keeps account actions inside", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockClientWorkspaceApi(page);
  await page.goto("/app/dashboard", { waitUntil: "networkidle" });

  const menuButton = page.getByRole("button", { name: "Открыть навигацию" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const navigation = page.getByRole("complementary", { name: "Основная навигация" });
  await expect(navigation).toHaveClass(/app-sidebar-open/);
  await expect(navigation.getByText("Владелец", { exact: true })).toBeVisible();
  await expect(navigation.getByText("owner@example.com", { exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Выйти" })).toBeVisible();
  await expect(page.locator(".app-topbar-controls")).toBeHidden();

  await expect.poll(async () => {
    const box = await navigation.boundingBox();
    return Math.round(Math.abs((box?.x ?? 0) + (box?.width ?? 0) - 390));
  }).toBe(0);
});

test("Ozon integration shows safe permissions and fits desktop and mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockClientWorkspaceApi(page, "owner", { includeOzon: true });
  await page.goto("/app/integrations/ozon", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Основной Ozon" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Есть ошибки" })).toBeVisible();
  await expect(page.getByText("Отзывы и ответы на отзывы")).toBeVisible();
  await expect(page.getByText("Вопросы и ответы на вопросы")).toBeVisible();
  await expect(page.getByText("Срок действия ключа")).toBeVisible();
  await expect(page.getByText(/Client ID хранится защищённо и не отображается/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить синхронизацию" })).toBeVisible();
  await expect(page.getByText(/Ozon временно ограничил частоту запросов/)).toBeVisible();
  await expect(page.getByText("rate_limited")).toHaveCount(0);
  await expect(page.getByText("Ozon Seller API rate limit exceeded")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Avito owner creates a connection without retaining submitted identifiers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockClientWorkspaceApi(page, "owner", { enableAvitoMutations: true });
  await page.goto("/app/integrations/avito", { waitUntil: "networkidle" });

  const form = page.getByRole("form", { name: "Новое подключение Авито" });
  await form.getByLabel("Название подключения").fill("Авито E2E");
  await form.getByLabel("ID пользователя Авито").fill("123456");
  await form.getByLabel("Client ID").fill("synthetic-client-id");
  await form.getByLabel("Client Secret").fill("synthetic-client-secret");

  const createResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/marketplace-accounts",
  );
  await form.getByRole("button", { name: "Добавить кабинет" }).click();
  expect((await createResponse).status()).toBe(201);

  await expect(page.getByRole("heading", { name: "Авито E2E" })).toBeVisible();
  await expect(form.getByLabel("ID пользователя Авито")).toHaveValue("");
  await expect(form.getByLabel("Client ID")).toHaveValue("");
  await expect(form.getByLabel("Client Secret")).toHaveValue("");
});

test("Avito integration shows safe chat access and fits desktop and mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockClientWorkspaceApi(page, "owner", { includeAvito: true });
  await page.goto("/app/integrations/avito", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Основной Авито" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Есть ошибки" })).toBeVisible();
  await expect(page.getByText("Доступ к чатам")).toBeVisible();
  await expect(page.getByText("Client ID и Client Secret", { exact: true })).toBeVisible();
  await expect(page.getByText("Синхронизация чатов", { exact: true })).toBeVisible();
  await expect(page.getByText(/ID пользователя Авито хранится защищённо и не отображается/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить синхронизацию" })).toBeVisible();
  await expect(page.getByText(/Авито временно ограничил частоту запросов/)).toBeVisible();
  await expect(page.getByText(/must-not-render-avito/)).toHaveCount(0);
  await expect(page.getByText("rate_limited")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
