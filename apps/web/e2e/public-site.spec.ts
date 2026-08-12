import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./helpers/public-routes";

for (const route of PUBLIC_ROUTES) {
  test(`${route} renders a valid public page`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response, `Expected document response for ${route}`).not.toBeNull();
    expect(response?.ok(), `Expected ${route} to return success`).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1:visible"), `${route} must have exactly one visible h1`).toHaveCount(1);
  });
}

test("primary navigation reaches features and pricing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /возможност/i }).first().click();
  await expect(page).toHaveURL(/\/features$/);
  await page.goto("/");
  await page.getByRole("link", { name: /тариф|цен/i }).first().click();
  await expect(page).toHaveURL(/\/pricing$/);
});

test("public pages emit no uncaught page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of PUBLIC_ROUTES) await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(errors).toEqual([]);
});

const RESPONSIVE_REVIEW_WIDTHS = [1920, 1600, 1440, 1280, 1240, 1121, 1120, 1024, 901, 900, 768, 430, 390, 375] as const;

async function describeHorizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;

    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          selector: [
            element.tagName.toLowerCase(),
            element.id ? `#${element.id}` : "",
            ...Array.from(element.classList).slice(0, 3).map((className) => `.${className}`),
          ].join(""),
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          overflowX: style.overflowX,
          position: style.position,
          visible:
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number.parseFloat(style.opacity || "1") > 0,
        };
      })
      .filter(
        (item) =>
          item.visible &&
          item.width > 0 &&
          (item.left < -1 || item.right > viewportWidth + 1),
      )
      .sort((a, b) => Math.max(b.right - viewportWidth, -b.left) - Math.max(a.right - viewportWidth, -a.left))
      .slice(0, 12);
  });
}

test("homepage keeps the approved Hero and the new trial/content architecture at every breakpoint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const width of RESPONSIVE_REVIEW_WIDTHS) {
    const height = width <= 430 ? 900 : 1000;
    await page.setViewportSize({ width, height });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const overflowDiagnostics = overflow > 1 ? await describeHorizontalOverflow(page) : [];
    expect(
      overflow,
      `${width}px must not create horizontal overflow. Offenders: ${JSON.stringify(overflowDiagnostics)}`,
    ).toBeLessThanOrEqual(1);

    const heading = page.locator(".home-hero-copy h1");
    await expect(heading).toBeVisible();
    const productFlow = page.getByTestId("hero-product-flow");
    await expect(productFlow).toBeVisible();

    const flowRoleBounds = await productFlow.locator("[data-flow-role]").evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { role: element.getAttribute("data-flow-role"), left: rect.left, right: rect.right };
      }),
    );
    for (const bounds of flowRoleBounds) {
      expect(bounds.left, `${width}px ${bounds.role} must stay inside the viewport`).toBeGreaterThanOrEqual(-1);
      expect(bounds.right, `${width}px ${bounds.role} must stay inside the viewport`).toBeLessThanOrEqual(width + 1);
    }

    if (width <= 1240) {
      const compactLayout = await productFlow.evaluate((element) => {
        const canvas = element.querySelector("canvas");
        const grid = canvas?.nextElementSibling;
        return {
          canvasDisplay: canvas ? window.getComputedStyle(canvas).display : null,
          gridColumns: grid ? window.getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
        };
      });
      expect(compactLayout.canvasDisplay, `${width}px Canvas must be disabled`).toBe("none");
      expect(compactLayout.gridColumns, `${width}px Product Pipeline must use one column`).toBe(1);
    }

    if (width >= 1024) {
      const metrics = await heading.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const lineHeight = Number.parseFloat(style.lineHeight);
        return {
          lines: lineHeight > 0 ? element.getBoundingClientRect().height / lineHeight : 0,
        };
      });
      expect(metrics.lines, `${width}px hero heading should stay within four visual lines`).toBeLessThanOrEqual(4.15);
    }

    if (width >= 1460) {
      const copyBox = await page.locator(".home-hero-copy").boundingBox();
      const canvasBox = await page.getByTestId("hero-product-flow").boundingBox();
      expect(copyBox, `${width}px hero copy box`).not.toBeNull();
      expect(canvasBox, `${width}px hero canvas box`).not.toBeNull();
      expect(
        (copyBox?.x ?? 0) + (copyBox?.width ?? 0),
        `${width}px hero copy must not overlap Canvas`,
      ).toBeLessThanOrEqual((canvasBox?.x ?? 0) - 16);
    }

    await expect(page.getByRole("button", { name: "Начать бесплатный тест" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Посмотреть процесс" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Работайте с обращениями с нескольких площадок" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Отзывы, вопросы и чаты — в одном автоматическом потоке" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Пакеты автоответов без подписки и срока сгорания" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Практические материалы для команды продавца" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Все материалы" })).toHaveAttribute("href", "/resources");
  }
});

test("Product Pipeline stops Canvas animation when the layout becomes compact", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const productFlow = page.getByTestId("hero-product-flow");
  await expect(productFlow).toHaveAttribute("data-animation", "running");

  await page.setViewportSize({ width: 1240, height: 1000 });
  await expect(productFlow).toHaveAttribute("data-animation", "stopped");
  await expect(productFlow.locator("canvas")).toBeHidden();
  const compactGridTemplate = await productFlow.evaluate((element) => {
    const grid = element.querySelector("canvas")?.nextElementSibling;
    return grid ? window.getComputedStyle(grid).gridTemplateColumns : "";
  });
  expect(compactGridTemplate.split(" "), `Compact grid resolved to ${compactGridTemplate}`).toHaveLength(1);
});

test("trial CTA opens an accessible modal", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const modal = page.locator("#mpreply-trial-modal");
  const trialButton = page.getByRole("button", { name: "Начать бесплатный тест" }).first();
  await expect(modal).toBeHidden();
  await expect(trialButton).toHaveAttribute("popovertarget", "mpreply-trial-modal");
  await trialButton.click();
  const dialog = page.getByRole("dialog", { name: "Проверьте автоответы на своих обращениях" });
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize();
  const modalBox = await modal.boundingBox();
  expect(viewport).not.toBeNull();
  expect(modalBox).not.toBeNull();
  expect(modalBox?.x ?? 1, "trial overlay starts at the viewport left edge").toBeLessThanOrEqual(1);
  expect(modalBox?.y ?? 1, "trial overlay starts at the viewport top edge").toBeLessThanOrEqual(1);
  expect(
    (modalBox?.x ?? 0) + (modalBox?.width ?? 0),
    "trial overlay reaches the viewport right edge",
  ).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 1);
  expect(
    (modalBox?.y ?? 0) + (modalBox?.height ?? 0),
    "trial overlay reaches the viewport bottom edge",
  ).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
  const backdropStyle = await modal.evaluate((element) =>
    window.getComputedStyle(element, "::backdrop").backgroundColor,
  );
  expect(backdropStyle).not.toBe("rgba(0, 0, 0, 0)");
  await expect(dialog.getByLabel("Имя")).toBeVisible();
  await expect(dialog.getByLabel("Рабочая почта")).toBeVisible();
  await expect(dialog.getByLabel("Телефон")).toBeVisible();
  await expect(dialog.getByLabel("Первый маркетплейс для теста")).toHaveCount(0);
  await expect(dialog.locator('input[name="trial"]')).toHaveValue("7-days");
  await expect(dialog.locator('input[name="answers"]')).toHaveValue("400");
  await expect(dialog.locator('input[name="marketplaceLimit"]')).toHaveValue("2");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});


test("model cards use asymmetric rows and pricing navigation uses links", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const cards = page.locator(".home-llm-card-v76");
  await expect(cards).toHaveCount(4);
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, y: box.y };
    }),
  );
  expect(boxes[0].width / boxes[1].width).toBeGreaterThan(1.45);
  expect(boxes[0].width / boxes[1].width).toBeLessThan(1.55);
  expect(boxes[3].width / boxes[2].width).toBeGreaterThan(1.45);
  expect(boxes[3].width / boxes[2].width).toBeLessThan(1.55);
  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes[2].y - boxes[3].y)).toBeLessThanOrEqual(1);

  const pricingLinks = page.getByRole("link", { name: "Выбрать пакет" });
  await expect(pricingLinks).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Подключить маркетплейс" }).first()).toHaveAttribute(
    "href",
    "/contacts",
  );
});
