import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");

const unsupportedDemoClaims = [
  "в реальном времени",
  "историю клиента",
  "история клиента",
  "формирует точный ответ",
  "Реальный пример",
  "Примеры из реальной практики",
  "Ожидаем поставку на следующей неделе",
  "Ответ успешно отправлен в Ozon",
  "Шаблоны ответов",
  "Убедитесь в эффективности",
] as const;

describe("public demo truth contract", () => {
  it("does not present the scripted demo as production evidence", () => {
    for (const claim of unsupportedDemoClaims) {
      expect(demo).not.toContain(claim);
    }
    expect(demo).not.toContain("Быстрое подключение");
  });

  it("labels the walkthrough as a demonstration", () => {
    expect(demo).toContain("Демонстрационный сценарий");
    expect(demo).toContain("Пример сценария");
  });

  it("keeps the sample answer grounded when stock timing is unknown", () => {
    expect(demo).toContain("Точная дата следующей поставки в доступном контексте не указана");
    expect(demo).not.toContain("следующей неделе. Мы сообщим");
  });

  it("uses observable trial and workflow mechanics in the hero trust row", () => {
    expect(demo).toContain("14 дней бесплатно");
    expect(demo).toContain("Контроль перед отправкой");
    expect(demo).toContain("ИИ-черновик с контекстом");
  });

  it("shows real product mechanics instead of template claims", () => {
    for (const capability of [
      "Единая очередь обращений",
      "Назначение обращений",
      "Автоматизация по правилам",
      "Аналитика",
    ]) {
      expect(demo).toContain(capability);
    }
  });
});
