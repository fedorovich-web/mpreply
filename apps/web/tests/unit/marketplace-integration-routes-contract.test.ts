import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = [
  {
    path: "app/app/integrations/ozon/page.tsx",
    name: "Ozon",
    marketplace: "ozon",
  },
  {
    path: "app/app/integrations/yandex-market/page.tsx",
    name: "Яндекс Маркет",
    marketplace: "yandex_market",
  },
  {
    path: "app/app/integrations/avito/page.tsx",
    name: "Авито",
    marketplace: "avito",
  },
] as const;

describe("ready marketplace dashboard routes", () => {
  for (const route of routes) {
    it(`provides a real connection workspace for ${route.name}`, () => {
      const filePath = resolve(process.cwd(), route.path);
      expect(existsSync(filePath), `${route.path} should exist`).toBe(true);

      const source = readFileSync(filePath, "utf8");
      expect(source).toContain("MarketplaceIntegrationWorkspace");
      expect(source).toContain(`marketplace=\"${route.marketplace}\"`);
      expect(source).toContain(route.name);
      expect(source).not.toMatch(/planned|coming soon|в разработке|пока недоступно|MVP adapter/i);
    });
  }
});
