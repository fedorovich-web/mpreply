import { describe, expect, it } from "vitest";
import { authorizationUrlSchema, billingOrderSchema } from "../../lib/api/schemas";

const order = { id: "44444444-4444-4444-8444-444444444444", organization_id: "33333333-3333-4333-8333-333333333333", kind: "plan", amount_minor: 129000, currency: "RUB", state: "pending", monthly_credits: 300, addon_credits: 0, created_at: "2026-10-01T12:00:00Z", paid_at: null, last_error: null };
describe("provider redirect boundaries", () => {
  it.each(["javascript:alert(1)", "https://lava.top.evil.test/pay", "http://lava.top/pay", "https://user@lava.top/pay", "https://lava.top:444/pay"])("rejects an unsafe payment URL %s", (payment_url) => {
    expect(billingOrderSchema.safeParse({ ...order, payment_url }).success).toBe(false);
  });
  it("accepts the Lava HTTPS checkout and a missing URL", () => {
    expect(billingOrderSchema.safeParse({ ...order, payment_url: "https://app.lava.top/pay" }).success).toBe(true);
    expect(billingOrderSchema.safeParse({ ...order, payment_url: null }).success).toBe(true);
  });
  it.each(["https://oauth.yandex.ru.evil.test/authorize", "https://oauth.yandex.ru/other", "http://oauth.yandex.ru/authorize", "https://user@oauth.yandex.ru/authorize"])("rejects an unsafe OAuth URL %s", (authorization_url) => {
    expect(authorizationUrlSchema.safeParse({ authorization_url }).success).toBe(false);
  });
});
