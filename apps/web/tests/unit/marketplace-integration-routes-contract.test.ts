import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = [
  {
    path: "app/app/integrations/ozon/page.tsx",
    name: "Ozon",
    marketplace: "ozon",
    workspace: "OzonIntegrationWorkspace",
  },
  {
    path: "app/app/integrations/yandex-market/page.tsx",
    name: "Яндекс Маркет",
    marketplace: "yandex_market",
    workspace: "YandexMarketIntegrationWorkspace",
  },
  {
    path: "app/app/integrations/avito/page.tsx",
    name: "Авито",
    marketplace: "avito",
    workspace: "AvitoIntegrationWorkspace",
  },
] as const;

describe("ready marketplace dashboard routes", () => {
  it("does not keep the superseded generic connection screen", () => {
    expect(existsSync(resolve(process.cwd(), "app/app/integrations/[marketplace]/page.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "components/integrations/MarketplaceIntegrationWorkspace.tsx"))).toBe(false);
  });

  for (const route of routes) {
    it(`provides a real connection workspace for ${route.name}`, () => {
      const filePath = resolve(process.cwd(), route.path);
      expect(existsSync(filePath), `${route.path} should exist`).toBe(true);

      const source = readFileSync(filePath, "utf8");
      expect(source).toContain(route.workspace);
      const wrapper = readFileSync(resolve(process.cwd(), `components/integrations/${route.workspace}.tsx`), "utf8");
      expect(wrapper).toContain(`marketplace=\"${route.marketplace}\"`);
      expect(source).toContain(route.name);
      expect(source).not.toMatch(/planned|coming soon|в разработке|пока недоступно|MVP adapter/i);
    });
  }

  it("keeps the Wildberries route in seller-facing language", () => {
    const source = readFileSync(resolve(process.cwd(), "app/app/integrations/wildberries/page.tsx"), "utf8");

    expect(source).toContain("Подключение доступно");
    expect(source).not.toMatch(/marketplace accounts|credentials|raw secret|MVP adapter/i);
  });

  it("describes both supported Avito streams on the connection page", () => {
    const source = readFileSync(resolve(process.cwd(), "app/app/integrations/avito/page.tsx"), "utf8");

    expect(source).toContain("чаты и доступные для ответа отзывы");
  });
});
