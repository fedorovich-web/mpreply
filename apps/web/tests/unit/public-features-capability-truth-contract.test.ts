import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const features = readFileSync(join(root, "app/features/page.tsx"), "utf8");

describe("public features capability truth contract", () => {
  it("does not advertise unsupported template, role-management or generic quality claims", () => {
    for (const unsupported of [
      "Шаблоны ответов",
      "Создавайте и сохраняйте шаблоны",
      "использует ваши шаблоны",
      "AI-черновики и шаблоны",
      "Контекст, шаблоны и правила",
      "устанавливайте роли",
      "Полная история обращений и действий сотрудников",
      "Проверка тональности, грамотности и соответствия правилам маркетплейсов",
      "точные и персонализированные ответы",
      "Следите за рейтингом, динамикой отзывов",
    ]) {
      expect(features).not.toContain(unsupported);
    }
  });

  it("describes capabilities that are present in the current product", () => {
    for (const supported of [
      "ИИ-черновики с контекстом",
      "Контроль перед отправкой",
      "Автоматизация по правилам",
      "Назначение обращений",
      "Аналитика",
      "Статусы обработки",
      "Поиск и фильтры",
      "Автоматизация",
      "На проверке",
    ]) {
      expect(features).toContain(supported);
    }
  });

  it("keeps the verified operational workflow intact", () => {
    expect(features).toContain("После проверки или по правилам автоматизации ответ отправляется в маркетплейс.");
    expect(features).toContain("Типовые случаи можно автоматизировать, а неоднозначные оставить на проверку сотруднику.");
    expect(features).toContain("14 дней бесплатно");
  });
});
