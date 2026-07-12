import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";

import { mockIntegrationsApi } from "./helpers/integrations-api";

test("Wildberries integrations workspace has no serious or critical axe violations", async ({ page }) => {
  await mockIntegrationsApi(page, "owner");
  await page.goto("/app/integrations/wildberries", { waitUntil: "networkidle" });

  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const blocking = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  if (blocking.length > 0) {
    throw new Error(`Accessibility gate failed: ${blocking.map((item) => item.id).join(", ")}`);
  }
});
