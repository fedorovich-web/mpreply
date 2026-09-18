import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(join(root, "app/pricing/page.tsx"), "utf8");

describe("public pricing truth contract", () => {
  it("keeps the approved commercial presentation", () => {
    for (const value of [
      'price: "490 ₽"',
      'price: "990 ₽"',
      'price: "1 990 ₽"',
      "Ежегодно · -20%",
      "14 дней бесплатно",
    ]) {
      expect(pricing).toContain(value);
    }
  });

  it("keeps the approved plan limits", () => {
    for (const value of [
      "До 500 сообщений в месяц",
      "До 2 000 сообщений в месяц",
      "До 10 000 сообщений в месяц",
      "1 пользователь",
      "До 3 пользователей",
      "Неограниченное число пользователей",
      "Подключение до 2 маркетплейсов",
      "Подключение до 4 маркетплейсов",
      "Подключение всех 4 маркетплейсов",
    ]) {
      expect(pricing).toContain(value);
    }
  });

  it("does not invent unapproved plan entitlements or support tiers", () => {
    for (const value of [
      "Шаблоны ответов",
      "API-доступ",
      "Персональный менеджер",
      "Базовые AI-ответы",
      "Расширенные AI-ответы",
      "Продвинутые",
      "Стандартная поддержка",
      "Приоритетная поддержка",
      "Персональная",
    ]) {
      expect(pricing).not.toContain(value);
    }
  });

  it("does not present all marketplace runtimes as already certified", () => {
    expect(pricing).not.toContain("четыре готовые интеграции");
    expect(pricing).not.toContain("уже готовы к подключению");
    expect(pricing).toContain("4 площадки в MPReply");
  });

  it("uses approved pricing CTA language", () => {
    expect(pricing).not.toContain("Начать бесплатно");
    expect(pricing).toContain("Попробовать бесплатно");
  });

  it("keeps real product mechanics in the comparison", () => {
    for (const capability of [
      "ИИ-черновики с контекстом",
      "Контроль перед отправкой",
      "Автоматизация по правилам",
      "Аналитика",
    ]) {
      expect(pricing).toContain(capability);
    }
  });
});
