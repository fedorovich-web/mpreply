import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { mockClientWorkspaceApi } from "./helpers/client-workspace-api";

const routes = ["/app/dashboard", "/app/inbox", "/app/instruction-sets", "/app/knowledge-base", "/app/integrations/ozon"] as const;

async function expectNoBlockingViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  if (blocking.length === 0) return;
  const details = blocking.map((violation) => {
    const nodes = violation.nodes.slice(0, 8).map((node) => `    - ${node.target.join(" ")}: ${node.failureSummary ?? "No failure summary"}`).join("\n");
    return `  ${violation.id} [${violation.impact ?? "unknown"}] — ${violation.help}\n${nodes}`;
  }).join("\n");
  throw new Error(`Client workspace accessibility audit failed: ${blocking.length} blocking violation type(s).\n${details}`);
}

for (const route of routes) {
  test(`${route} has no blocking accessibility violations`, async ({ page }) => {
    await mockClientWorkspaceApi(page, "owner", { includeOzon: route === "/app/integrations/ozon" });
    await page.goto(route, { waitUntil: "networkidle" });
    await expectNoBlockingViolations(page);
  });
}

test("dark dashboard has no blocking accessibility violations", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("mpreply-theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  await mockClientWorkspaceApi(page);
  await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoBlockingViolations(page);
});

test("open mobile navigation has no blocking accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockClientWorkspaceApi(page);
  await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Открыть навигацию" }).click();
  await expect(page.getByRole("complementary", { name: "Основная навигация" })).toHaveClass(/app-sidebar-open/);
  await expectNoBlockingViolations(page);
});
