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

test("authenticated mobile shell manages drawer focus, backdrop and overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations", { waitUntil: "networkidle" });

  const openMenu = page.getByRole("button", { name: "Открыть меню кабинета" });
  await expect(openMenu).toBeVisible();
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");

  await openMenu.click();

  const sidebar = page.locator(".app-sidebar");
  await expect(sidebar).toHaveClass(/app-sidebar-open/);
  await expect(page.getByRole("button", { name: "Закрыть боковое меню" })).toBeVisible();
  await expect(sidebar.locator("a").first()).toBeFocused();
  await expect(page.getByRole("link", { name: "Обращения", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "На проверке", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);

  await page.keyboard.press("Escape");

  await expect(sidebar).not.toHaveClass(/app-sidebar-open/);
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");
  await expect(openMenu).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});
