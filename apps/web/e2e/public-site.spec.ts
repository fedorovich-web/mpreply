import { expect, test, type Page } from "@playwright/test";
import { PUBLIC_ROUTES, VISUAL_ROUTES } from "./helpers/public-routes";
import { appOrigin } from "../lib/site-config";

test("public header shows the workspace button for an active session", async ({ page, baseURL }) => {
  let active = false;
  await page.route("**/api/auth/session-status", (route) => route.fulfill({
    status: active ? 204 : 401,
    headers: {
      "access-control-allow-origin": new URL(baseURL!).origin,
      "access-control-allow-credentials": "true",
    },
  }));
  const header = page.locator(".public-header");
  await page.goto("/");
  await expect(header.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Попробовать бесплатно", exact: false })).toBeVisible();

  active = true;
  await page.reload();
  await expect(header.getByRole("link", { name: "В кабинет", exact: false })).toHaveAttribute("href", appOrigin + "/app/dashboard");
  await expect(header.getByRole("link", { name: "Войти", exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Попробовать бесплатно", exact: false })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en", { waitUntil: "networkidle" });
  await header.getByRole("button", { name: "Open menu" }).click();
  await expect(header.getByRole("link", { name: "My workspace", exact: false })).toHaveAttribute("href", appOrigin + "/en/app/dashboard");
  await expect(header.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Start free", exact: false })).toHaveCount(0);
});

for (const locale of ["ru", "en"] as const) {
  test(`public registration links go directly to the workspace (${locale})`, async ({ page }) => {
    const prefix = locale === "en" ? "/en" : "";
    const authPrefetches: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes("/auth/") && url.searchParams.has("_rsc")) authPrefetches.push(url.href);
    });
    for (const path of ["/", "/features", "/marketplaces", "/marketplaces/wildberries", "/pricing"]) {
      await page.goto(prefix + (path === "/" ? "" : path) || "/", { waitUntil: "networkidle" });
      const links = page.locator('main a[href*="/auth/register"]');
      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute("href", `${appOrigin}${prefix}/auth/register?intent=connect-marketplace`);
      }
    }
    await mockDemoSession(page);
    await page.goto(`${prefix}/demo`, { waitUntil: "networkidle" });
    await expect(page.locator(".app-demo-banner a")).toHaveAttribute("href", `${appOrigin}${prefix}/auth/register`);
    expect(authPrefetches).toEqual([]);
  });
}

for (const route of PUBLIC_ROUTES) {
  test(`${route} renders a valid public page`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response, `Expected document response for ${route}`).not.toBeNull();
    expect(response?.ok(), `Expected ${route} to return success`).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1:visible"), `${route} must have exactly one visible h1`).toHaveCount(1);
  });
}

test("document language follows the route, not a client-supplied locale header", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-mpreply-locale": "ru" });
  await page.goto("/en/features", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.setExtraHTTPHeaders({ "x-mpreply-locale": "en" });
  await page.goto("/features", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("primary navigation reaches features and pricing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /возможност/i }).first().click();
  await expect(page).toHaveURL(/\/features$/);
  await page.goto("/");
  await page.getByRole("link", { name: /тариф|цен/i }).first().click();
  await expect(page).toHaveURL(/\/pricing$/);
});

test("tablet header uses only the mobile navigation mode", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Открыть меню" })).toBeVisible();
  await expect(page.locator(".public-nav")).toBeHidden();
  await expect(page.locator(".public-header-actions")).toBeHidden();
});

test("mobile navigation traps focus, locks scroll and restores focus on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });

  const trigger = page.locator(".public-header .public-mobile-menu-trigger");
  await expect(trigger).toHaveAccessibleName("Открыть меню");
  await trigger.click();

  const panel = page.locator(".public-mobile-menu-panel");
  const focusable = panel.locator('a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])');
  const firstFocusable = focusable.first();
  const lastFocusable = focusable.last();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(firstFocusable).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Shift+Tab");
  await expect(lastFocusable).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstFocusable).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("mobile navigation releases scroll lock when viewport becomes desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });

  const trigger = page.locator(".public-header .public-mobile-menu-trigger");
  await expect(trigger).toHaveAccessibleName("Открыть меню");
  await trigger.click();
  await expect(page.locator(".public-mobile-menu-panel")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(page.locator(".public-mobile-menu-panel")).toBeHidden();
  await expect(page.locator(".public-mobile-menu-backdrop")).toBeHidden();
  await expect(trigger).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("approved mockup pages stay light when the saved dashboard theme is dark", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mpreply-theme", "dark"));

  for (const route of VISUAL_ROUTES.filter((route) => route.path !== "/")) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".mockup-page")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".public-header")).toHaveCSS("background-color", /rgba?\(255, 255, 255/);
  }
});

test("auth mode links preserve only explicit safe navigation intent", async ({ page }) => {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Создать аккаунт" }).last()).toHaveAttribute("href", "/auth/register");

  await page.goto("/auth/login?intent=connect-marketplace", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Создать аккаунт" }).last()).toHaveAttribute(
    "href",
    "/auth/register?intent=connect-marketplace",
  );

  await page.goto("/auth/login?next=%2Fapp%2Finbox", { waitUntil: "domcontentloaded" });
  const safeNextLink = page.getByRole("link", { name: "Создать аккаунт" }).last();
  await expect(safeNextLink).toHaveAttribute("href", "/auth/register?next=%2Fapp%2Finbox");
  await expect(safeNextLink).not.toHaveAttribute("href", /intent=/);
});

test("homepage reflects the ready marketplace integrations", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const marketplaceList = page.locator(".homepage-marketplace-list");
  await expect(marketplaceList.locator("a")).toHaveCount(4);

  for (const marketplace of ["Wildberries", "Ozon", "Яндекс Маркет", "Авито"]) {
    await expect(marketplaceList.getByRole("link", { name: marketplace, exact: true })).toBeVisible();
  }

  const pageCopy = await page.locator("main").innerText();
  expect(pageCopy).not.toMatch(/3\s+маркетплейса/i);
  expect(pageCopy).not.toMatch(/интеграц(?:ия|ии).{0,24}(?:скоро|планиру|в разработке)/i);
  await expect(page.getByRole("group", { name: "Четыре нейросети", exact: true })).toBeVisible();
});

test("homepage keeps model and results sections and contains preview controls", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".homepage-model-card")).toHaveCount(4);
    await expect(page.locator(".homepage-model-card strong")).toHaveText([
      "GPT-6 Luna", "Claude Sonnet 5.5", "Gemini 3.8", "DeepSeek V4.1",
    ]);
    for (const card of await page.locator(".homepage-model-card").all()) {
      const logo = card.locator("img");
      await logo.scrollIntoViewIfNeeded();
      await expect(logo).toBeVisible();
      await expect.poll(() => logo.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
      const bounds = await card.evaluate((element) => {
        const cardRect = element.getBoundingClientRect();
        const description = element.querySelector(".homepage-model-description")!.getBoundingClientRect();
        return { left: cardRect.left, right: cardRect.right, bottom: cardRect.bottom, textLeft: description.left, textRight: description.right, textBottom: description.bottom };
      });
      expect(bounds.textLeft).toBeGreaterThanOrEqual(bounds.left);
      expect(bounds.textRight).toBeLessThanOrEqual(bounds.right);
      expect(bounds.textBottom).toBeLessThanOrEqual(bounds.bottom);
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    const capturePath = testInfo.outputPath(`restored-models-${viewport.width}px.png`);
    await page.screenshot({ path: capturePath, fullPage: true, animations: "disabled" });
    await testInfo.attach(`restored-models-${viewport.width}px.png`, {
      path: capturePath,
      contentType: "image/png",
    });
    if (viewport.width > 768) await expect(page.locator(".homepage-process-path")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Меньше рутины. Больше времени на развитие бизнеса." })).toBeVisible();
    await expect(page.locator(".homepage-result-card")).toHaveCount(4);
    await expect(page.locator(".homepage-result-card").nth(2)).toContainText("2режима: автоматически или после проверки");
    const layout = await page.evaluate(() => {
      const answer = document.querySelector(".homepage-workspace-answer")!.getBoundingClientRect();
      const action = document.querySelector(".homepage-workspace-answer-actions a")!.getBoundingClientRect();
      const stats = Array.from(document.querySelectorAll(".homepage-marketplace-facts strong"), (element) => element.getBoundingClientRect().top);
      const models = document.querySelector(".homepage-models-section")!.getBoundingClientRect();
      const process = document.querySelector(".homepage-approved-process")!.getBoundingClientRect();
      const results = document.querySelector(".homepage-results-section")!.getBoundingClientRect();
      return { answerRight: answer.right, answerBottom: answer.bottom, actionRight: action.right, actionBottom: action.bottom, stats, modelBottom: models.bottom, processTop: process.top, resultsTop: results.top };
    });
    expect(layout.actionRight).toBeLessThanOrEqual(layout.answerRight);
    expect(layout.actionBottom).toBeLessThanOrEqual(layout.answerBottom);
    await expect(page.locator(".homepage-workspace-answer-actions a")).toHaveAttribute("href", "/demo");
    expect(Math.max(...layout.stats) - Math.min(...layout.stats)).toBeLessThan(1);
    expect(layout.modelBottom).toBeLessThanOrEqual(layout.processTop);
    expect(layout.resultsTop).toBeGreaterThan(layout.processTop);
  }
});

test("public pages emit no uncaught page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of PUBLIC_ROUTES) await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(errors).toEqual([]);
});

test("public text remains readable on desktop and mobile", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/", "/pricing", "/marketplaces/ozon"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const unreadable = await page.locator(".public-root *").evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0
            && Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
          .map((element) => ({ text: element.textContent?.trim().slice(0, 36), size: Number(getComputedStyle(element).fontSize.replace("px", "")) }))
          .filter(({ size }) => size < 14),
      );
      expect(unreadable, `${route} at ${width}px has text below 14px`).toEqual([]);
    }
  }
});

test("help topics and FAQ work across viewports", async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".faq-question")).toHaveCount(10);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const first = page.locator(".faq-question-trigger").first();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#faq-answer-connect")).toHaveAttribute("inert", "");
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await page.locator('.faq-hero-shortcuts a[href="#pricing"]').click();
    await expect(page).toHaveURL(/\/help#pricing$/);
    await expect(page.locator(".faq-main h2")).toHaveText("Тарифы, пробный период и пакеты");
    await expect(page.locator(".faq-question")).toHaveCount(3);
    await page.getByRole("button", { name: "Все популярные вопросы" }).click();
    await expect(page.locator(".faq-question")).toHaveCount(10);
    if (width <= 760) {
      await expect(page.locator(".faq-category-list")).toBeHidden();
      const bounds = await page.locator(".faq-support-card").boundingBox();
      const questions = await page.locator(".faq-question-list").boundingBox();
      expect(bounds!.y).toBeGreaterThan(questions!.y + questions!.height);
    } else {
      await page.getByRole("tab", { name: "Интеграции", exact: true }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("tab", { name: "Работа с обращениями", exact: true })).toBeFocused();
      await expect(page.locator(".faq-main h2")).toHaveText("Отзывы, вопросы и сообщения");
    }
  }
});

test("public heroes share the same desktop geometry and section width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const heroes: readonly [string, string][] = [
    ["/", ".homepage-approved-hero"],
    ["/features", ".mockup-hero"],
    ["/marketplaces", ".mockup-hero"],
    ["/pricing", ".pricing-mockup-hero"],
    ["/help", ".help-approved-hero"],
    ["/contacts", ".contacts-render-hero"],
    ["/privacy", ".legal-approved-hero"],
  ];

  for (const [route, selector] of heroes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const geometry = await page.locator(selector).evaluate((hero) => ({
      height: hero.getBoundingClientRect().height,
      background: getComputedStyle(hero).backgroundImage,
      sharedHeight: parseFloat(getComputedStyle(hero).getPropertyValue("--public-hero-min-height")),
      containerWidth: hero.querySelector(".public-container")?.getBoundingClientRect().width,
    }));
    expect(geometry.height, `${route} hero height`).toBe(geometry.sharedHeight);
    expect(geometry.containerWidth, `${route} container width`).toBe(1240);
    expect(geometry.background, `${route} hero background`).toContain("241, 248, 255");
  }
});

test("public footer has unique destinations and opens on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing", { waitUntil: "networkidle" });

  await expect(page.locator("footer")).toHaveCount(1);
  await page.getByRole("button", { name: "Ресурсы" }).click();
  await expect(page.locator("footer .public-footer-disclosure[data-open='true'] a[href='/help']")).toBeVisible();
  await expect(page.locator("footer .public-footer-disclosure[data-open='true'] a[href='/contacts']")).toBeVisible();
  await expect(page.locator("footer a[href='/help#faq'], footer a[href='/help#start']")).toHaveCount(0);
  await page.getByRole("button", { name: "Документы" }).click();
  await expect(page.locator("footer a[href='/privacy']:visible")).toHaveCount(1);
  await expect(page.locator("footer a[href='/terms']:visible")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("demo links use the centered SVG play icon", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".homepage-demo-button")).toHaveCount(2);
  await expect(page.locator(".homepage-demo-button svg circle")).toHaveCount(2);
  await expect(page.locator(".homepage-demo-button svg path[fill='currentColor']")).toHaveCount(2);
});

async function mockDemoSession(page: Page) {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-csrf-token",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-origin": origin,
    "content-type": "application/json",
  };
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const timestamp = "2026-09-28T10:00:00Z";
  const user = {
    id: userId, email: "public-demo@demo.mpreply.ru", name: "Демо MPReply",
    status: "demo", is_superadmin: false, created_at: timestamp, updated_at: timestamp,
  };
  const period = { start: timestamp, end: timestamp, days: 30 };
  await page.route("**/api/**", (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, body: JSON.stringify(body) });
    if (path === "/api/auth/demo") return respond({ user });
    if (path === "/api/auth/me") return respond(user);
    if (path === "/api/organizations") return respond([{
      id: organizationId, name: "Демо MPReply", slug: "mpreply-public-demo",
      owner_user_id: userId, plan_id: null, default_response_mode: "semi_auto",
      status: "demo", current_user_role: "viewer", created_at: timestamp, updated_at: timestamp,
    }]);
    if (path === "/api/messages") return respond({ items: [], total: 0, page: 1, page_size: Number(url.searchParams.get("page_size") ?? 8) });
    if (path === "/api/replies/review-queue") return respond({ items: [], total: 0, page: 1, page_size: 1 });
    if (path === "/api/marketplace-accounts") return respond([]);
    if (path === "/api/automation-rules") return respond({ items: [], total: 0 });
    if (path === "/api/analytics/overview") return respond({
      period, total_messages: 0, new_messages: 0, unanswered_messages: 0,
      answered_messages: 0, negative_reviews: 0, replies_sent: 0,
      auto_replies_sent: 0, manual_replies_sent: 0, ai_drafts_generated: 0,
      average_response_seconds: null, ai_acceptance_rate: null,
    });
    if (path === "/api/analytics/marketplaces" || path === "/api/analytics/team") return respond({ period, items: [] });
    return respond({ detail: "Unexpected demo API request" }, 404);
  });
}

test("demo opens the real dashboard and keeps marketplace connections read-only", async ({ page }) => {
  await mockDemoSession(page);
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".app-demo-banner")).toContainText("Добавление ключей и отправка ответов отключены");
  await page.getByRole("link", { name: "Интеграции", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/integrations$/);
  await expect(page.locator(".integration-catalog-grid")).toBeVisible();
  await expect(page.locator(".integration-catalog-grid")).not.toContainText("Подключить");
});

test("real demo dashboard navigation works on a narrow mobile screen", async ({ page }) => {
  await mockDemoSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.getByRole("button", { name: "Открыть меню кабинета" }).click();
  await page.getByRole("link", { name: "Обращения", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expect(page.locator(".app-demo-banner")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("public examples omit invented customer identities and count badges", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".homepage-workspace-list-avatar, .homepage-workspace-filter small")).toHaveCount(0);
  await expect(page.locator(".homepage-workspace-list")).not.toContainText("Анна К.");
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".auth-preview, .auth-marketplaces")).toHaveCount(0);
});

test("login and registration fit common viewport heights", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/auth/login", "/auth/register"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".auth-card h1")).toBeVisible();
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(height, `${route} should fit ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(viewport.height);
    }
  }
});

for (const [marketplace, asset] of [
  ["ozon", "hero-ozon.avif"],
  ["yandex-market", "hero-yandex-market.avif"],
  ["avito", "hero-avito.avif"],
] as const) {
  test(`${marketplace} uses the supplied hero illustration`, async ({ page }) => {
    await page.goto(`/marketplaces/${marketplace}`, { waitUntil: "domcontentloaded" });
    const image = page.locator(".marketplace-detail-render img");
    await expect(image).toHaveAttribute("src", `/images/approved/${asset}`);
    await expect.poll(() => image.evaluate((element) => element instanceof HTMLImageElement && element.naturalWidth === 1000)).toBe(true);
  });
}

test("removed internal CTA strips and duplicate contact channels stay absent", async ({ page }) => {
  for (const prefix of ["", "/en"]) {
    for (const route of ["/features", "/marketplaces", "/pricing", "/contacts"]) {
      await page.goto(`${prefix}${route}`);
      await expect(page.locator(".features-cta-strip, .marketplace-cta-strip, .pricing-final-cta, .contacts-render-final, .contacts-render-channels")).toHaveCount(0);
    }
  }
});

test("process icons fit their rows and pricing calculators use the shared spacing", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const icon of await page.locator(".homepage-process-card-inbox .home-line-icon").all()) {
      const size = await icon.evaluate((image) => {
        const bounds = image.getBoundingClientRect();
        const parent = image.parentElement!.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height, parentWidth: parent.width, parentHeight: parent.height };
      });
      expect(size.width).toBeGreaterThan(0);
      expect(size.width).toBeLessThanOrEqual(size.parentWidth);
      expect(size.height).toBeLessThanOrEqual(size.parentHeight);
    }
    const border = await page.locator(".public-header-actions .public-language-link").evaluate(e => getComputedStyle(e).borderColor);
    await page.goto("/pricing");
    await expect(page.locator(".public-header-actions .public-language-link")).toHaveCSS("border-color", border);
    const spacing = await page.locator(".public-root").evaluate(e => getComputedStyle(e).getPropertyValue("--public-section-padding-block").trim());
    for (const section of await page.locator(".pricing-calculator-section").all()) {
      await expect(section).toHaveCSS("padding-top", spacing);
      await expect(section).toHaveCSS("padding-bottom", spacing);
    }
  }
});

test("four plans fit each viewport and only Corporate uses a sales enquiry", async ({ page }) => {
  for (const locale of ["ru", "en"] as const) {
    const pricingPath = locale === "ru" ? "/pricing" : "/en/pricing";
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pricingPath);
      const cards = page.locator(".pricing-card-grid .pricing-card");
      await expect(cards).toHaveCount(4);
      const business = cards.filter({ has: page.getByRole("heading", { name: locale === "ru" ? "Бизнес" : "Business", exact: true }) });
      await expect(business.getByRole("link")).toHaveAttribute("href", /\/auth\/register\?intent=connect-marketplace$/);
      const corporate = cards.filter({ has: page.getByRole("heading", { name: locale === "ru" ? "Корпоративный" : "Corporate", exact: true }) });
      await expect(corporate.getByRole("link")).toHaveAttribute("href", locale === "ru" ? "/contacts#contact-form" : "/en/contacts#contact-form");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.locator(".pricing-card").last().getByRole("link").click();
    await expect(page.locator("#contact-form")).toHaveCount(1);
    await expect(page.locator("#contact-form")).toBeVisible();
  }
});

test("pricing FAQ uses full-width rows and opening one answer does not stretch another", async ({ page }) => {
  for (const path of ["/pricing", "/en/pricing"]) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: "networkidle" });
      const section = page.locator(".pricing-approved-faq-layout");
      const rows = section.locator("details");
      const heading = await section.getByRole("heading", { level: 2 }).boundingBox();
      const container = await section.boundingBox();
      const firstBefore = await rows.nth(0).boundingBox();
      const nextBefore = await rows.nth(1).boundingBox();
      expect(heading && container && firstBefore && nextBefore).toBeTruthy();
      expect(heading!.y + heading!.height).toBeLessThan(firstBefore!.y);
      for (const row of await rows.all()) {
        const bounds = await row.boundingBox();
        expect(bounds!.x).toBeCloseTo(container!.x, 0);
        expect(bounds!.width).toBeCloseTo(container!.width, 0);
      }
      await rows.nth(0).locator("summary").click();
      await expect(rows.nth(0)).toHaveAttribute("open", "");
      const firstAfter = await rows.nth(0).boundingBox();
      const nextAfter = await rows.nth(1).boundingBox();
      expect(firstAfter!.height).toBeGreaterThan(firstBefore!.height);
      expect(nextAfter!.height).toBeCloseTo(nextBefore!.height, 0);
      expect(nextAfter!.y).toBeGreaterThan(firstAfter!.y + firstAfter!.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test("manager salary stays fixed and comparison volume stops at 3000", async ({ page }) => {
  await page.goto("/pricing");
  const benefit = page.locator(".pricing-benefit-section");
  const salary = benefit.locator(".pricing-benefit-results > div").first().locator("strong");
  const volume = benefit.getByRole("spinbutton", { name: "Точное количество ответов в месяц" });
  await expect(volume).toHaveAttribute("max", "3000");
  await expect(benefit.getByRole("button", { name: /20\s*000/ })).toHaveCount(0);
  for (const amount of [300, 800, 1600, 3000, 20000]) {
    await volume.fill(String(amount));
    await volume.blur();
    await expect(volume).toHaveValue(String(Math.min(amount, 3000)));
    await expect(salary).toHaveText(/50\s*000\s*₽/);
  }
  await benefit.getByText("Настроить зарплату и время работы", { exact: true }).click();
  await benefit.getByLabel("Зарплата одного менеджера, ₽/мес (от 50 000)").fill("65000");
  await volume.fill("300");
  await expect(salary).toHaveText(/65\s*000\s*₽/);
  await volume.fill("3000");
  await expect(salary).toHaveText(/65\s*000\s*₽/);
});
