import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockAIAssistantApi } from "./helpers/ai-assistant-api";
import { mockAutomationRulesApi } from "./helpers/automation-rules-api";
import { mockIntegrationsApi } from "./helpers/integrations-api";

async function useDarkTheme(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mpreply-theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
}

async function expectNoBlockingViolations(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  if (blocking.length > 0) {
    const details = blocking
      .map((violation) => {
        const nodes = violation.nodes
          .slice(0, 8)
          .map((node) => `    - ${node.target.join(" ")}: ${node.failureSummary ?? "No failure summary"}`)
          .join("\n");
        return `  ${violation.id} [${violation.impact ?? "unknown"}] — ${violation.help}\n${nodes}`;
      })
      .join("\n");
    throw new Error(`Dark-theme accessibility audit failed: ${blocking.length} blocking violation type(s).\n${details}`);
  }
}

for (const route of ["/", "/marketplaces", "/demo"] as const) {
  test(`dark ${route}`, async ({ page }) => {
    await useDarkTheme(page);
    await page.goto(route, { waitUntil: "networkidle" });
    await expectNoBlockingViolations(page);
  });
}

test("dark AI Assistant", async ({ page }) => {
  await useDarkTheme(page);
  await mockAIAssistantApi(page, "manager");
  await page.goto("/app/ai-assistant", { waitUntil: "networkidle" });
  await expectNoBlockingViolations(page);
});

test("dark Automation Rules", async ({ page }) => {
  await useDarkTheme(page);
  await mockAutomationRulesApi(page, "owner");
  await page.goto("/app/automation-rules", { waitUntil: "networkidle" });
  await expectNoBlockingViolations(page);
});

test("dark Integrations", async ({ page }) => {
  await useDarkTheme(page);
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });
  await expectNoBlockingViolations(page);
});
