import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";
import { mockAIAssistantApi } from "./helpers/ai-assistant-api";

const approvedNavigation = [
  "Обзор",
  "Обращения",
  "На проверке",
  "Ответы с ИИ",
  "Автоматизация",
  "Интеграции",
  "Аналитика",
  "Тариф и лимиты",
  "Аккаунт и вход",
];

test("cabinet wraps long product names and message text without clipping controls", async ({ page }) => {
  const productName = "Термокружка для путешествий и ежедневной работы, серия " + "SKU1234567890".repeat(12);
  const customerText = "Пожалуйста, уточните комплектацию и порядок возврата товара, если упаковка повреждена. ".repeat(3);
  await mockAIAssistantApi(page, "manager", { productName, customerText });
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app/ai-assistant", { waitUntil: "networkidle" });
    await expect(page.locator(".ai-message-preview")).toHaveText(customerText.trim());
    const clipped = await page.locator(".ai-workspace-grid strong, .ai-message-preview").evaluateAll((elements) =>
      elements.filter((element) => element.scrollWidth > element.clientWidth + 2)
        .map((element) => element.textContent?.slice(0, 60)),
    );
    expect(clipped, `Clipped product/message at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("button", { name: "Подготовить черновик", exact: true })).toBeVisible();
  }
});

test("administration summary keeps loaded metrics inside the content area", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: {
    id: "22222222-2222-4222-8222-222222222222", email: "admin@example.com", name: "Administrator",
    status: "active", is_superadmin: true, created_at: "2026-09-30T06:00:00Z", updated_at: "2026-09-30T06:00:00Z",
  } }));
  await page.route("**/api/admin/overview", (route) => route.fulfill({ json: {
    generated_at: "2026-09-30T06:00:00Z", organizations_total: 12345, organizations_active: 10000,
    users_total: 123456, subscriptions_active: 8500, usage_events_30d: 123456789,
    ai_cost_estimate_30d: 123456.78, integration_failures_24h: 123, replies_failed_24h: 456,
  } }));
  await page.route("**/api/admin/users?**", (route) => route.fulfill({ json: { items: [], total: 0 } }));
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app/admin", { waitUntil: "networkidle" });
    await expect(page.locator(".admin-overview-body")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const clipped = await page.locator(".admin-overview-body strong, .admin-kpi-card strong, .app-topbar-title > span").evaluateAll((elements) =>
      elements.filter((element) => element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent),
    );
    expect(clipped).toEqual([]);
  }
});

test("administrators can search and moderate accounts on the mobile admin page", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 840 });
  await mockIntegrationsApi(page, "owner");
  const createdAt = "2026-09-30T06:00:00Z";
  const admin = {
    id: "22222222-2222-4222-8222-222222222222", email: "admin@example.com", name: "Administrator",
    status: "active", is_superadmin: true, created_at: createdAt, updated_at: createdAt, email_verified_at: createdAt,
  };
  const buyer = {
    ...admin, id: "11111111-1111-4111-8111-111111111111", email: `${"seller".repeat(42)}@example.com`,
    name: "Продавец", is_superadmin: false,
  };
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: admin }));
  await page.route("**/api/admin/overview", (route) => route.fulfill({ status: 503 }));
  await page.route("**/api/admin/users?**", (route) => {
    const { searchParams } = new URL(route.request().url());
    const offset = searchParams.get("offset");
    if (searchParams.get("q") === buyer.email) return route.fulfill({ json: { items: [buyer], total: 1 } });
    return route.fulfill({ json: { items: [offset === "20" ? buyer : admin], total: 21 } });
  });
  let actionAttempts = 0;
  await page.route(`**/api/admin/users/${buyer.id}/actions`, (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("1");
    const body = route.request().postDataJSON();
    actionAttempts += 1;
    if (actionAttempts === 1) return route.fulfill({ status: 503 });
    buyer.status = body.action === "block" ? "blocked" : "active";
    return route.fulfill({ json: buyer });
  });

  await page.goto("/app/admin");
  const users = page.getByRole("region", { name: "Пользователи" });
  await expect(users.getByText("Суперадминистратор", { exact: true })).toBeVisible();
  await expect(users.getByRole("button", { name: "Заблокировать" })).toHaveCount(0);
  await users.getByRole("button", { name: "Далее" }).click();
  await expect(users.getByText(buyer.email)).toBeVisible();
  const search = users.getByRole("searchbox", { name: "Имя или email" });
  await search.fill(buyer.email);
  await search.press("Enter");
  await expect(users.getByRole("button", { name: "Далее" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
  expect((await new AxeBuilder({ page }).include("#admin-users").withTags(wcagTags).analyze()).violations).toEqual([]);

  const block = users.getByRole("button", { name: "Заблокировать" });
  await block.click();
  const confirmation = page.getByRole("dialog", { name: "Заблокировать пользователя?" });
  await expect(confirmation.getByRole("button", { name: "Отмена" })).toBeFocused();
  expect((await new AxeBuilder({ page }).include(".admin-users-dialog").withTags(wcagTags).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(block).toBeFocused();
  await expect.poll(() => actionAttempts).toBe(0);

  await block.click();
  await confirmation.getByRole("button", { name: "Заблокировать" }).click();
  await expect(confirmation.getByRole("alert")).toContainText("Не удалось выполнить действие");
  await confirmation.getByRole("button", { name: "Заблокировать" }).click();
  await expect(confirmation).toBeHidden();
  await expect(users.getByText("Заблокирован", { exact: true })).toBeVisible();
  await expect(users.getByRole("button", { name: "Разблокировать" })).toBeFocused();

  await users.getByRole("button", { name: "Разблокировать" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Разблокировать" }).click();
  await expect(users.getByText("Активен", { exact: true })).toBeVisible();

  await users.getByRole("button", { name: "Завершить сеансы" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Завершить сеансы" }).click();
  await expect(users.getByRole("status").filter({ hasText: "Все сеансы завершены" })).toBeVisible();
});

test("authenticated desktop shell exposes the approved product navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  const navigation = page.getByRole("navigation", { name: "Разделы кабинета" });
  await expect(navigation).toBeVisible();

  for (const label of approvedNavigation) {
    await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  await expect(navigation.getByRole("link", { name: "Интеграции", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("banner").getByText("Seller Group", { exact: true })).toBeVisible();
});

test("authenticated navigation icons load from real bundled assets", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  const icons = page.locator(".app-nav-icon-image");
  await expect(icons).toHaveCount(approvedNavigation.length + 1);
  await expect.poll(async () => icons.evaluateAll((images) =>
    images.filter((image) => !(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth === 0).length,
  )).toBe(0);
});

test("authenticated navigation and integration text stays at least 14px", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/app/integrations", { waitUntil: "networkidle" });
    const unreadable = await page.locator(".app-shell *").evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0
          && Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
        .map((element) => ({ text: element.textContent?.trim().slice(0, 36), size: Number(getComputedStyle(element).fontSize.replace("px", "")) }))
        .filter(({ size }) => size < 14),
    );
    expect(unreadable, `Integrations text below 14px at ${viewport.width}px`).toEqual([]);
  }
});

test("authenticated mobile shell traps focus and manages drawer visibility, backdrop and overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  const openMenu = page.getByRole("button", { name: "Открыть меню кабинета" });
  const sidebar = page.locator(".app-sidebar");
  await expect(openMenu).toBeVisible();
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeHidden();

  await openMenu.click();

  const focusable = sidebar.locator('a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])');
  const firstFocusable = focusable.first();
  const lastFocusable = focusable.last();
  await expect(sidebar).toHaveClass(/app-sidebar-open/);
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole("button", { name: "Закрыть боковое меню" })).toBeVisible();
  await expect(firstFocusable).toBeFocused();
  await expect(page.getByRole("link", { name: "Обращения", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "На проверке", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Shift+Tab");
  await expect(lastFocusable).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstFocusable).toBeFocused();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);

  await page.keyboard.press("Escape");

  await expect(sidebar).not.toHaveClass(/app-sidebar-open/);
  await expect(sidebar).toBeHidden();
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");
  await expect(openMenu).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("authenticated mobile shell keeps workspace switching available in the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockIntegrationsApi(page, "owner", { includeSecondOrganization: true });
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Открыть меню кабинета" }).click();
  const sidebar = page.locator(".app-sidebar");
  const workspaceSelect = sidebar.getByLabel("Выбрать рабочее пространство");
  await expect(workspaceSelect).toBeVisible();
  await expect(workspaceSelect.locator("option")).toHaveCount(2);

  await workspaceSelect.selectOption({ label: "Second Store" });

  await expect(workspaceSelect).toHaveValue("11111111-1111-4111-8111-222222222222");
  await expect(page.locator(".app-topbar-title strong")).toHaveText("Second Store");
});

test("authenticated mobile shell releases drawer state when viewport becomes desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  const openMenu = page.getByRole("button", { name: "Открыть меню кабинета" });
  const sidebar = page.locator(".app-sidebar");
  await openMenu.click();
  await expect(sidebar).toHaveClass(/app-sidebar-open/);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(sidebar).not.toHaveClass(/app-sidebar-open/);
  await expect(sidebar).toBeVisible();
  await expect(page.locator(".app-sidebar-backdrop")).toHaveCount(0);
  await expect(openMenu).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});
