import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");
const marketplaces = readFileSync(join(root, "app/marketplaces/page.tsx"), "utf8");
const combined = `${features}\n${marketplaces}`;

describe("public commercial uplift copy contract", () => {
  it("does not promise unverified sales, rating, recommendation or satisfaction uplift", () => {
    for (const unsupportedClaim of [
      "Больше продаж",
      "Выше рейтинг товаров",
      "больше положительных отзывов",
      "чаще возвращаются",
      "рекомендуют ваши товары",
      "Больше возможностей — больше довольных клиентов",
      "От обращения до довольного клиента",
      "Довольный клиент",
      "сделать ваших клиентов счастливее",
    ]) {
      expect(combined).not.toContain(unsupportedClaim);
    }
  });

  it("describes feature outcomes through observable workflow mechanics", () => {
    for (const groundedCopy of [
      "От обращения до отправленного ответа",
      "Меньше ручного набора",
      "Единый стандарт ответов",
      "Понятная работа команды",
      "Контроль исключений",
    ]) {
      expect(features).toContain(groundedCopy);
    }
  });

  it("keeps the marketplace hero annotation operational rather than commercial", () => {
    expect(marketplaces).toContain("Одна очередь");
    expect(marketplaces).toContain("для команды");
  });
});
