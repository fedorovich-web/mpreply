import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const help = readFileSync(join(root, "app/help/page.tsx"), "utf8");
const contacts = readFileSync(join(root, "app/contacts/page.tsx"), "utf8");
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const product = readFileSync(join(root, "../../PRODUCT.md"), "utf8");

describe("public support truth contract", () => {
  it("uses the single verified support email through siteConfig", () => {
    expect(siteConfig).toContain('contactEmail: configuredContactEmail || "support@mpreply.ru"');
    expect(product).toContain("support@mpreply.ru");

    for (const source of [help, contacts, shell]) {
      expect(source).toContain("siteConfig.contactEmail");
      expect(source).not.toContain("help@mpreply.ru");
    }
  });

  it("does not publish unverified office or support hours", () => {
    for (const value of [
      "г. Майкоп",
      "ул. Чкалова",
      "помещение 17А",
      "09:00–18:00",
      "Ответ в рабочее время",
      "Наш офис",
      "Режим работы",
    ]) {
      expect(contacts + shell).not.toContain(value);
    }
  });

  it("keeps support to the verified public channel", () => {
    for (const value of ["Telegram", "VK", "YouTube", "WhatsApp", "MAX"]) {
      expect(help + contacts + shell).not.toContain(value);
    }
  });

  it("does not overstate marketplace connection readiness on help", () => {
    expect(help).not.toContain("После подключения обращения собираются");
    expect(help).not.toContain("4 маркетплейса");
    expect(help).not.toContain("Подключённые кабинеты работают");
    expect(help).toContain("Доступность конкретного подключения зависит от текущей версии сервиса");
  });

  it("keeps help task-oriented", () => {
    for (const marker of [
      "Быстрый старт",
      "Диагностика",
      "FAQ",
      "Не отправляйте в письме секретные ключи доступа",
    ]) {
      expect(help).toContain(marker);
    }
  });
});
