import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const plannedRoutes = [
  {
    path: "app/app/integrations/ozon/page.tsx",
    name: "Ozon",
  },
  {
    path: "app/app/integrations/yandex-market/page.tsx",
    name: "Яндекс Маркет",
  },
  {
    path: "app/app/integrations/avito/page.tsx",
    name: "Авито",
  },
] as const;

describe("marketplace dashboard routes", () => {
  for (const route of plannedRoutes) {
    it(`keeps ${route.name} informational until the integration is available`, () => {
      const filePath = resolve(process.cwd(), route.path);
      expect(existsSync(filePath), `${route.path} should exist`).toBe(true);

      const source = readFileSync(filePath, "utf8");
      expect(source).toContain("PlannedMarketplaceIntegrationPage");
      expect(source).toContain(route.name);
      expect(source).not.toContain("MarketplaceIntegrationWorkspace");
      expect(source).not.toContain("credentialLabel");
      expect(source).not.toMatch(/Подключить .+|запускайте синхронизацию|Интеграция готова/i);
    });
  }

  it("keeps the Wildberries route in seller-facing language", () => {
    const source = readFileSync(resolve(process.cwd(), "app/app/integrations/wildberries/page.tsx"), "utf8");

    expect(source).toContain("Интеграция готова");
    expect(source).toContain("WildberriesIntegrationWorkspace");
    expect(source).not.toMatch(/marketplace accounts|credentials|raw secret|MVP adapter/i);
  });
});
