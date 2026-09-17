import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");

describe("public pricing copy contract", () => {
  it("keeps the approved tariff and trial presentation exact", () => {
    for (const fact of ["490 ₽", "990 ₽", "1 990 ₽", "-20%", "14 дней"]) {
      expect(pricing).toContain(fact);
    }
  });

  it("does not invent trial, billing, refund or document conditions", () => {
    for (const unsupportedClaim of [
      "Без карты",
      "Есть ли возврат средств?",
      "Условия возврата зависят",
      "Предоставляете ли вы закрывающие документы?",
      "закрывающие документы",
      "Можно ли поменять тариф позже?",
      "перейти на другой тариф",
    ]) {
      expect(pricing).not.toContain(unsupportedClaim);
    }
  });

  it("uses grounded workflow outcomes instead of unsupported commercial uplift claims", () => {
    expect(pricing).not.toContain("Больше заказов");
    expect(pricing).toContain("Меньше переключений");
    expect(pricing).toContain("автоматически или после проверки");
  });
});
