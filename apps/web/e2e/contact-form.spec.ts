import { expect, test } from "@playwright/test";

test("contact form sends from the site, preserves failed input and retries without duplicates", async ({ page }) => {
  const submissions: Array<{ idempotency_key: string; consent: boolean; message: string }> = [];
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-csrf-token",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    "content-type": "application/json",
  };
  await page.route("**/api/contact", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    expect(route.request().headers()["x-csrf-token"]).toBe("1");
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: submissions.length === 1 ? 503 : 202, headers, body: JSON.stringify(submissions.length === 1 ? { detail: "Unable to send contact message" } : { message: "Message sent" }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contacts");
  const form = page.locator("#contact-form");
  await form.getByLabel("Ваше имя *").fill("Анна");
  await form.getByLabel("Рабочая почта *").fill("anna@example.com");
  const message = form.getByLabel("Ваше сообщение *");
  await message.fill("Как подключить ещё один магазин к общей очереди?");
  await form.getByLabel("Я согласен на обработку персональных данных").check();
  await form.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(form.getByRole("alert")).toContainText("Не удалось отправить");
  await expect(message).toHaveValue("Как подключить ещё один магазин к общей очереди?");
  await expect(form.getByRole("status")).toHaveCount(0);
  await form.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(form.getByRole("status")).toHaveText("Сообщение отправлено.");
  await expect(message).toHaveValue("");
  expect(submissions).toHaveLength(2);
  expect(submissions[1].idempotency_key).toBe(submissions[0].idempotency_key);
  expect(submissions[0].consent).toBe(true);
  await expect(page).toHaveURL(/\/contacts$/);
});

test("English contact form has localized fields and policy link", async ({ page }) => {
  await page.goto("/en/contacts");
  await expect(page.locator("#contact-form").getByLabel("Your name *")).toBeVisible();
  await expect(page.locator("#contact-form").getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/en/privacy");
  await expect(page.locator(".contacts-render-final, .contacts-render-channels")).toHaveCount(0);
});
