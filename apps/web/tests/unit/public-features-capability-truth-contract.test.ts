import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const features = read("app/features/page.tsx");
const featuresEn = read("app/en/features/page.tsx");

describe("approved public features capability contract", () => {
  it("preserves the approved automatic-reply capability in both locales", () => {
    expect(features).toContain('title: "ИИ-автоответы"');
    expect(featuresEn).toContain('title: "AI auto-replies with context"');
    expect(features).toContain("Автоматически отвечайте на типовые вопросы");
    expect(features).toContain("обрабатывать автоматически по настроенным правилам");
    expect(features).toContain("оставить сотруднику перед отправкой ответа");
  });

  it("preserves approved template, quality and team capabilities for the implementation audit", () => {
    // These are owner-approved copy, not runtime certification. Gaps belong in the
    // implementation audit; a contract must not silently remove the approved scope.
    for (const capability of [
      "Единая очередь обращений", "Шаблоны ответов", "Создавайте и сохраняйте шаблоны",
      "Проверка тональности, грамотности и соответствия правилам маркетплейсов",
      "устанавливайте роли", "История действий", "Аналитика",
    ]) expect(features).toContain(capability);
  });

  it("keeps marketplace coverage, context and exception handling visible", () => {
    for (const name of ["Wildberries", "Ozon", "Яндекс Маркет", "Авито"]) expect(features).toContain(name);
    expect(features).toContain("Текст обращения и доступные сведения о товаре");
    expect(features).toContain("Неоднозначные обращения");
    expect(features).toContain("14 дней бесплатно");
    expect(features).not.toMatch(/Планируется|в разработке|worker-backed|application layer/i);
  });
});
