import { expect, test } from "@playwright/test";

import { mockAIAssistantApi } from "./helpers/ai-assistant-api";

test("manager loads Inbox context and generates an AI draft", async ({ page }) => {
  await mockAIAssistantApi(page, "manager");
  await page.goto("/app/ai-assistant", { waitUntil: "networkidle" });

  await expect(page.getByRole("button", { name: /Термокружка/ })).toBeVisible();
  await page.getByRole("button", { name: "Сгенерировать черновик" }).click();

  await expect(page.getByText(/Сожалеем, что коробка пришла повреждённой/)).toBeVisible();
  await expect(page.getByText("Confidence 91%")).toBeVisible();
});

test("viewer can read draft history but cannot generate", async ({ page }) => {
  await mockAIAssistantApi(page, "viewer");
  await page.goto("/app/ai-assistant", { waitUntil: "networkidle" });

  await expect(page.getByText(/может просматривать историю, но не создавать черновики/)).toBeVisible();
  await expect(page.getByText(/Сожалеем, что коробка пришла повреждённой/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Сгенерировать черновик" })).toHaveCount(0);
});
