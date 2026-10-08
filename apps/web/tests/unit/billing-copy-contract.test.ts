import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "components/billing/BillingWorkspace.tsx"), "utf8");

describe("billing product copy", () => {
  it("shows plan and usage without product-development or provider commentary", () => {
    expect(source).toContain("Текущий тариф");
    expect(source).toContain("Использование лимитов");
    expect(source).toContain("Без отдельного лимита");

    for (const forbidden of [
      "Стоимость уточняется",
      "ещё не утверждена",
      "выдуманную цену",
      "после их публикации",
      "пока не задан",
      "payment provider",
      "провайдер оплаты",
      "API",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
