import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "components/analytics/AnalyticsWorkspace.tsx"), "utf8");

describe("analytics seller-facing copy", () => {
  it("focuses on business outcomes rather than implementation details", () => {
    expect(source).toContain("Обращения и ответы по дням");
    expect(source).toContain("Где больше обращений");
    expect(source).toContain("Товары с наибольшим числом обращений");
    expect(source).toContain("Ответы за выбранный период");

    for (const forbidden of [
      "Ошибки синхронизации",
      "Использование моделей ИИ",
      "Оценочная стоимость",
      "Среднее время подготовки",
      "SafetyGate",
      "request id",
      "formatUsd",
      "formatLatency",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
