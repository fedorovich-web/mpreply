import { expect, test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";

const approvedNavigation = [
  "Обзор",
  "Обращения",
  "На проверке",
  "ИИ-ассистент",
  "Автоматизация",
  "Интеграции",
  "Аналитика",
  "Тариф и лимиты",
];

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
  await expect(page.getByText("Seller Group", { exact: true })).toBeVisible();
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
