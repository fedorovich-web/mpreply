import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/integrations/IntegrationsWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/integrations/page.tsx"), "utf8");
const wildberriesPage = readFileSync(join(root, "app/app/integrations/wildberries/page.tsx"), "utf8");
const ozonPage = readFileSync(join(root, "app/app/integrations/ozon/page.tsx"), "utf8");
const yandexPage = readFileSync(join(root, "app/app/integrations/yandex-market/page.tsx"), "utf8");
const avitoPage = readFileSync(join(root, "app/app/integrations/avito/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-integrations-approved.css"), "utf8");

describe("integrations dashboard", () => {
  it("keeps all four ready integrations on the existing marketplace accounts API", () => {
    expect(workspace).toContain('buildApiQuery("/api/marketplace-accounts"');
    expect(workspace).toContain("Интеграция готова");
    expect(workspace).toContain("Wildberries");
    expect(workspace).toContain("Ozon");
    expect(workspace).toContain("Яндекс Маркет");
    expect(workspace).toContain("Авито");
    expect(workspace).not.toContain("Планируется");
    expect(workspace).not.toContain("Подключение и отправка пока недоступны");
  });

  it("keeps every marketplace page operational", () => {
    expect(wildberriesPage).toContain("WildberriesIntegrationWorkspace");
    expect(ozonPage).toContain("MarketplaceIntegrationWorkspace");
    expect(yandexPage).toContain("MarketplaceIntegrationWorkspace");
    expect(avitoPage).toContain("MarketplaceIntegrationWorkspace");
    for (const marketplacePage of [wildberriesPage, ozonPage, yandexPage, avitoPage]) {
      expect(marketplacePage).toContain("Интеграция готова");
      expect(marketplacePage).not.toContain("Подключение пока недоступно");
    }
  });

  it("states that all supported marketplaces are available for connection", () => {
    expect(page).toContain("Wildberries, Ozon, Яндекс Маркет и Авито доступны для подключения");
    expect(page).toContain("4 маркетплейса");
    expect(page).not.toContain("находятся в плане интеграций");
  });

  it("uses the scoped responsive integrations layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-integrations-approved.css"');
    expect(styles).toContain(".integrations-page");
    expect(styles).toContain(".integration-market-card");
    expect(styles).toContain(".wildberries-integration-page");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
