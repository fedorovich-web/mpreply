import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const routes = [
  "dashboard",
  "inbox",
  "review-queue",
  "ai-assistant",
  "automation-rules",
  "integrations",
  "integrations/wildberries",
  "integrations/ozon",
  "integrations/yandex-market",
  "integrations/avito",
  "analytics",
  "billing",
  "admin",
] as const;

describe("private RU/EN route parity", () => {
  it("provides an English counterpart for every authenticated product route", () => {
    for (const route of routes) {
      expect(existsSync(join(root, "app/app", route, "page.tsx")), `missing RU route: ${route}`).toBe(true);
      expect(existsSync(join(root, "app/en/app", route, "page.tsx")), `missing EN route: ${route}`).toBe(true);
    }
  });

  it("keeps English route files free of accidental Cyrillic copy", () => {
    for (const route of routes) {
      const source = readFileSync(join(root, "app/en/app", route, "page.tsx"), "utf8");
      expect(source, route).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
});
