import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const prefix of ["", "/en"]) {
  for (const route of ["/", "/features", "/pricing", "/marketplaces", "/marketplaces/wildberries", "/marketplaces/ozon", "/marketplaces/yandex-market", "/marketplaces/avito", "/help", "/contacts", "/privacy", "/terms"]) {
    const path = prefix + (prefix && route === "/" ? "" : route);
    test(`public page ${path} omits labels above headings`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main [class*='kicker'], main [class*='eyebrow'], .faq-breadcrumb")).toHaveCount(0);
    });
  }
}

for (const width of [320, 390, 768, 1440]) {
  test(`FAQ assets, text and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/help", { waitUntil: "networkidle" });
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator(".faq-support-card a")).toHaveAttribute("href", "/contacts");
    const images = page.locator(".faq-page img");
    const sources = await images.evaluateAll((items) => [...new Set(items.map((item) => item.getAttribute("src")!))]);
    for (const source of sources) {
      expect(source).toMatch(/\.avif$/);
      const response = await page.request.get(source);
      expect(response.ok(), source).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/avif");
    }
    for (const image of await images.all()) {
      if (!await image.isVisible()) continue;
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((item) => (item as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const smallText = await page.locator(".faq-page *").evaluateAll((items) => items.filter((item) =>
      item.getClientRects().length > 0 && !item.closest('[aria-hidden="true"]')
      && [...item.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      && parseFloat(getComputedStyle(item).fontSize) < 14,
    ).map((item) => item.textContent));
    expect(smallText).toEqual([]);
    expect(await page.locator(".faq-hero .public-lead").evaluate((item) => getComputedStyle(item).fontSize)).toBe("18px");
    if (width <= 760) {
      expect(await page.locator(".faq-hero").evaluate((hero) => getComputedStyle(hero, "::after").content)).toBe("none");
      const copy = await page.locator(".faq-hero-copy").boundingBox();
      const illustration = await page.locator(".faq-hero-image").boundingBox();
      const scene = await page.locator(".faq-hero-scene").boundingBox();
      expect(illustration!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height + 16);
      expect(illustration!.x).toBeGreaterThanOrEqual(scene!.x);
      expect(illustration!.x + illustration!.width).toBeLessThanOrEqual(scene!.x + scene!.width);
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  });
}

test("English FAQ deep links and answers stay localized", async ({ page }) => {
  await page.goto("/en/help#pricing");
  await expect(page.locator(".faq-main h2")).toHaveText("Plans, the trial, and packages");
  await expect(page.locator(".faq-answer a").first()).toHaveAttribute("href", "/en/pricing");
  await expect(page.locator(".faq-support-card a")).toHaveAttribute("href", "/en/contacts");
  await page.getByRole("button", { name: "Can I try it for free?", exact: true }).click();
  await expect(page.locator("#faq-answer-trial")).toContainText("350 AI replies");
  await expect(page.locator("#faq-answer-trial a")).toHaveAttribute("href", "/en/demo");
});

for (const width of [390, 768, 1440]) {
  for (const route of ["/", "/features", "/pricing", "/marketplaces", "/help", "/contacts", "/privacy"]) {
    test(`public sections on ${route} use equal vertical padding at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const measurements = await page.evaluate(() => {
        const root = document.querySelector(".public-root")!;
        const expected = getComputedStyle(root).getPropertyValue("--public-section-padding-block").trim();
        const sections = [...document.querySelectorAll("main > section, main > .mockup-page > section, main > .faq-page > section, main > .contacts-render-page > section, main > .legal-approved-layout")];
        return { expected, sections: sections.map((section) => {
          const style = getComputedStyle(section);
          return { name: section.className, top: style.paddingTop, bottom: style.paddingBottom };
        }) };
      });
      expect(measurements.sections.length).toBeGreaterThan(0);
      for (const section of measurements.sections) {
        expect(section.top, `${route} ${width}px ${section.name}: top`).toBe(measurements.expected);
        expect(section.bottom, `${route} ${width}px ${section.name}: bottom`).toBe(measurements.expected);
      }
    });
  }
}
