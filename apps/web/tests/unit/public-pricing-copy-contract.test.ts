import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");

describe("public pricing copy contract", () => {
  it("keeps the approved tariff and trial presentation exact", () => {
    for (const fact of ["1 290 ₽", "3 490 ₽", "6 990 ₽", "скидка 20%", "14 дней", "350 ИИ-ответов"]) {
      expect(pricing).toContain(fact);
    }
  });

  it("does not invent trial, billing, refund, document or extra-tariff conditions", () => {
    for (const unsupportedClaim of [
      "Есть ли возврат средств?",
      "Условия возврата зависят",
      "Предоставляете ли вы закрывающие документы?",
      "закрывающие документы",
      "Можно ли поменять тариф позже?",
      "перейти на другой тариф",
      "индивидуальный тариф",
      "персональное предложение",
      "Полный доступ",
      "ко всем возможностям",
      "Никаких рисков",
    ]) {
      expect(pricing).not.toContain(unsupportedClaim);
    }
  });

  it("preserves approved automatic-reply and team-control copy", () => {
    expect(pricing).not.toContain("Больше заказов");
    expect(pricing).toContain("ИИ-автоответы");
    expect(pricing).toContain("Проверка ответов перед отправкой");
    expect(pricing).toContain("Правила автоматической обработки");
    expect(pricing).toContain("Роли и права доступа");
  });
});
