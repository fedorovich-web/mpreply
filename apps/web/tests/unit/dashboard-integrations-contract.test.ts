import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/integrations/IntegrationsWorkspace.tsx"), "utf8");
const plannedPage = readFileSync(join(root, "components/integrations/PlannedMarketplaceIntegrationPage.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/integrations/page.tsx"), "utf8");
const wildberriesPage = readFileSync(join(root, "app/app/integrations/wildberries/page.tsx"), "utf8");
const ozonPage = readFileSync(join(root, "app/app/integrations/ozon/page.tsx"), "utf8");
const yandexPage = readFileSync(join(root, "app/app/integrations/yandex-market/page.tsx"), "utf8");
const avitoPage = readFileSync(join(root, "app/app/integrations/avito/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-integrations-approved.css"), "utf8");

describe("integrations dashboard", () => {
  it("keeps Wildberries operational and marks the other marketplaces as planned", () => {
    expect(workspace).toContain('buildApiQuery("/api/marketplace-accounts"');
    expect(workspace).toContain('status: "supported"');
    expect(workspace).toContain('status: "planned"');
    expect(workspace).toContain("Интеграция готова");
    expect(workspace).toContain("Планируется");
    expect(workspace).toContain("Подключение пока недоступно");
    expect(workspace).toContain("Wildberries");
    expect(workspace).toContain("Ozon");
    expect(workspace).toContain("Яндекс Маркет");
    expect(workspace).toContain("Авито");
  });

  it("keeps only the Wildberries route operational", () => {
    expect(wildberriesPage).toContain("WildberriesIntegrationWorkspace");
    expect(wildberriesPage).toContain("Интеграция готова");

    for (const marketplacePage of [ozonPage, yandexPage, avitoPage]) {
      expect(marketplacePage).toContain("PlannedMarketplaceIntegrationPage");
      expect(marketplacePage).not.toContain("MarketplaceIntegrationWorkspace");
      expect(marketplacePage).not.toContain("credentialLabel");
    }

    expect(plannedPage).toContain("Планируется");
    expect(plannedPage).toContain("Подключение пока недоступно");
    expect(plannedPage).not.toContain("apiRequest");
  });

  it("states the current marketplace availability without fake connection claims", () => {
    expect(page).toContain("Wildberries доступен для подключения");
    expect(page).toContain("Ozon, Яндекс Маркет и Авито — в плане интеграций");
    expect(page).toContain("1 доступен");
    expect(page).toContain("3 в плане");
    expect(page).not.toContain("Wildberries, Ozon, Яндекс Маркет и Авито доступны для подключения");
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
