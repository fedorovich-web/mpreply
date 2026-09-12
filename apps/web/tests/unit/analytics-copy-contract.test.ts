import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "components/analytics/AnalyticsWorkspace.tsx"), "utf8");

describe("analytics seller-facing copy", () => {
  it("focuses on operational outcomes rather than provider implementation details", () => {
    expect(source).toContain("Обращения и ответы по дням");
    expect(source).toContain("Маркетплейсы");
    expect(source).toContain("Товары с наибольшим потоком");

    for (const forbidden of [
      "Использование моделей ИИ",
      "Оценочная стоимость",
      "Среднее время подготовки",
      "formatUsd",
      "formatLatency",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
