import { expect, test } from "@playwright/test";
import { mockIntegrationsApi } from "./helpers/integrations-api";

test("production pages enforce script nonces and keep working after navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("/", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace("</body>", "<script id='injected-test'>document.documentElement.dataset.injected = 'yes'</script></body>") });
  });
  const first = await page.goto("/");
  const headers = first!.headers();
  const csp = headers["content-security-policy"] ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(await page.locator("script:not(#injected-test)").evaluateAll((scripts) => scripts.every((script) => script.nonce !== ""))).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // Parser-inserted attack: privileged DevTools evaluation inherits script trust.
  await expect(page.locator("html")).not.toHaveAttribute("data-injected", "yes");
  const second = await page.reload();
  expect(second!.headers()["content-security-policy"]).not.toBe(csp);
  await page.goto("/auth/register");
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile homepage uses responsive approved images", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const hero = page.locator("img[alt='Интерфейс MPReply с общей очередью обращений и ответом с помощью ИИ']");
  await expect(hero).toHaveAttribute("srcset", /\/\_next\/image\?/);
  await expect(hero).toHaveAttribute("sizes", /100vw/);
  await expect.poll(() => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const width = await hero.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).searchParams.get("w"));
  expect(Number(width)).toBeLessThan(1481);
  const source = await hero.evaluate((image: HTMLImageElement) => image.currentSrc);
  const response = await page.request.get(source, { headers: { Accept: "image/webp" } });
  expect(response.headers()["content-type"]).toBe("image/webp");
  expect((await response.body()).length).toBeLessThan(133469);
});

test("homepage excludes dashboard CSS while private routes retain their styles", async ({ page }) => {
  await page.goto("/");
  const styleUrls = await page.locator("link[rel=stylesheet]").evaluateAll((links: HTMLLinkElement[]) => links.map((link) => link.href));
  const styles = await Promise.all(styleUrls.map(async (url) => (await page.request.get(url)).text()));
  expect(styles.some((style) => style.includes(".billing-order-status"))).toBe(false);
  expect(styles.some((style) => style.includes(".app-sidebar-workspace"))).toBe(false);
  await mockIntegrationsApi(page);
  await page.goto("/app/integrations");
  await expect(page.locator(".app-sidebar")).toBeVisible();
  await expect(page.locator(".app-nav")).toHaveCSS("display", "grid");
});
