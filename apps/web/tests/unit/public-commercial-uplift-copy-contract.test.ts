import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const features = read("app/features/page.tsx");
const marketplaces = read("app/marketplaces/page.tsx");
const publicCopy = [features, marketplaces, read("app/en/features/page.tsx"), read("app/en/marketplaces/page.tsx")].join("\n");

describe("public commercial copy evidence contract", () => {
  it("does not add fabricated quantified savings, customer counts or ratings", () => {
    expect(publicCopy).not.toMatch(/\d+\s*%[^\n]{0,80}(?:времен|продаж|рейтинг|time|sales)/i);
    expect(publicCopy).not.toMatch(/(?:более|свыше|over)\s+\d[\d\s]*\s*(?:клиент|компан|customer|compan)/i);
    expect(publicCopy).not.toMatch(/aggregateRating|reviewCount|testimonial|До 70% меньше времени/i);
  });

  it("keeps the approved seller workflow and exception controls beside the commercial headings", () => {
    for (const mechanism of ["Единая очередь обращений", "ИИ-автоответы", "Аналитика"]) expect(features).toContain(mechanism);
    expect(features).toContain("обрабатывать автоматически по настроенным правилам");
    expect(features).toContain("оставить сотруднику перед отправкой ответа");
    expect(features).toContain("Текст обращения и доступные сведения о товаре");
  });

  it("preserves the approved marketplace workflow and a usable product demo destination", () => {
    for (const mechanism of ["Единая очередь обращений", "Статусы и синхронизация", "ИИ-автоответы", "Командная работа"]) expect(marketplaces).toContain(mechanism);
    expect(marketplaces).toContain('href="/demo"');
    expect(marketplaces).toContain('href={appOrigin + "/auth/register?intent=connect-marketplace"}');
  });
});
