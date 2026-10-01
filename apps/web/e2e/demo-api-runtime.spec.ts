import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(process.env.MPREPLY_REAL_API_TEST !== "1", "Requires the local API and migrated PostgreSQL database");

for (const [prefix, inboxLabel, banner] of [
  ["", "Обращения", "Добавление ключей и отправка ответов отключены"],
  ["/en", "Messages", "Adding keys and sending replies are disabled"],
] as const) {
  test(`real demo API opens ${prefix || "Russian"} workspace and rejects mutations`, async ({ page }) => {
    const apiFailures: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/") && response.status() >= 400) {
        apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    });
    await page.setViewportSize({ width: prefix ? 390 : 1440, height: 900 });
    await page.goto(`${prefix}/demo`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/app/dashboard$`));
    await expect(page.locator(".app-demo-banner")).toContainText(banner);
    await page.goto(`${prefix}/app/inbox`);
    await expect(page.getByRole("heading", { name: inboxLabel, exact: true })).toBeVisible();
    await expect(page.getByText("Какого размера эта модель?", { exact: true })).toBeVisible();
    await page.goto(`${prefix}/app/integrations`);
    await expect(page.locator(".integration-catalog-grid")).toBeVisible();
    expect(apiFailures).toEqual([]);
    const blocked = await page.request.post("http://localhost:8000/api/organizations", {
      headers: { "X-CSRF-Token": "1", Origin: "http://localhost:3000" },
      data: { name: "Blocked demo mutation" },
    });
    expect(blocked.status()).toBe(403);
    const keyAttempt = await page.request.post("http://localhost:8000/api/marketplace-accounts", {
      headers: { "X-CSRF-Token": "1", Origin: "http://localhost:3000" },
      data: {},
    });
    expect(keyAttempt.status()).toBe(403);
  });
}

test("loaded cabinet remains readable across phone, tablet and desktop sizes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["dashboard", "inbox", "review-queue", "ai-assistant", "automation-rules", "integrations", "analytics", "billing"]) {
      await page.goto(`/app/${route}`, { waitUntil: "networkidle" });
      await expect(page.locator(".app-page h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} overflow at ${width}px`).toBeLessThanOrEqual(width);
      const unreadable = await page.locator(".app-shell *").evaluateAll((elements) =>
        elements.filter((element) => element.getClientRects().length > 0
          && Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
          && parseFloat(getComputedStyle(element).fontSize) < 14)
          .map((element) => element.textContent?.trim().slice(0, 40)),
      );
      expect(unreadable, `${route} text below 14px at ${width}px`).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/inbox", { waitUntil: "networkidle" });
  await expect(page.getByText("Какого размера эта модель?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Открыть обращение:", exact: false }).first().click();
  await expect(page.locator(".inbox-detail-panel")).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
