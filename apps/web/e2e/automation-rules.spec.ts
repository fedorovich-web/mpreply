import { expect, test } from "@playwright/test";

import { mockAutomationRulesApi } from "./helpers/automation-rules-api";

test("owner loads live Automation Rules and creates a tenant-scoped rule", async ({ page }) => {
  await mockAutomationRulesApi(page, "owner");
  await page.goto("/app/automation-rules", { waitUntil: "networkidle" });

  await expect(page.getByText("Balanced auto")).toBeVisible();
  await page.getByRole("button", { name: "Создать правило" }).click();

  const editor = page.getByRole("form", { name: "Редактор правила автоматизации" });
  await editor.getByLabel("Название").fill("Отзывы 1–3");
  await editor.getByRole("button", { name: "Создать правило" }).click();

  await expect(page.getByRole("heading", { name: "Отзывы 1–3" })).toBeVisible();
});

test("viewer sees Automation Rules in read-only mode", async ({ page }) => {
  await mockAutomationRulesApi(page, "viewer");
  await page.goto("/app/automation-rules", { waitUntil: "networkidle" });

  await expect(page.getByText("Balanced auto")).toBeVisible();
  await expect(page.getByText(/Только просмотр/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать правило" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Редактировать" })).toHaveCount(0);
});
