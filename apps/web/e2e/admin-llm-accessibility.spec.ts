import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { mockAdminLLMApi } from "./helpers/admin-llm-api";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`admin model workspace ${viewport.name} has no blocking accessibility violations`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockAdminLLMApi(page);
    await page.goto("/app/admin/llm", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Модели AI" })).toBeVisible();
    await expectNoBlockingViolations(page);
  });
}

async function expectNoBlockingViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = result.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical");
  if (blocking.length === 0) return;
  const details = blocking.map((violation) => {
    const nodes = violation.nodes.slice(0, 8).map((node) =>
      `    - ${node.target.join(" ")}: ${node.failureSummary ?? "No failure summary"}`).join("\n");
    return `  ${violation.id} [${violation.impact ?? "unknown"}] — ${violation.help}\n${nodes}`;
  }).join("\n");
  throw new Error(`Admin LLM accessibility audit failed: ${blocking.length} blocking violation type(s).\n${details}`);
}
