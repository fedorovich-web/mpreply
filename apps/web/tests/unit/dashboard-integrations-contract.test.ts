import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/integrations/IntegrationsWorkspace.tsx"), "utf8");
const page = readFileSync(join(root, "app/app/integrations/page.tsx"), "utf8");
const ozonPage = readFileSync(join(root, "app/app/integrations/ozon/page.tsx"), "utf8");
const yandexPage = readFileSync(join(root, "app/app/integrations/yandex-market/page.tsx"), "utf8");
const avitoPage = readFileSync(join(root, "app/app/integrations/avito/page.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const styles = readFileSync(join(root, "styles/dashboard-integrations-approved.css"), "utf8");

describe("integrations readiness workspace", () => {
  it("keeps the live account summary on the existing marketplace accounts API", () => {
    expect(workspace).toContain('buildApiQuery("/api/marketplace-accounts"');
    expect(workspace).toContain("Доступно сейчас");
    expect(workspace).toContain("Планируется");
    expect(workspace).toContain("Подключение и отправка пока недоступны");
  });

  it("does not expose planned marketplaces as connectable integrations", () => {
    expect(workspace).not.toContain("`Подключить ${marketplace.name}`");
    expect(ozonPage).not.toContain("MarketplaceIntegrationWorkspace");
    expect(yandexPage).not.toContain("MarketplaceIntegrationWorkspace");
    expect(avitoPage).not.toContain("MarketplaceIntegrationWorkspace");
    for (const plannedPage of [ozonPage, yandexPage, avitoPage]) {
      expect(plannedPage).toContain("Планируется");
      expect(plannedPage).toContain("Подключение пока недоступно");
    }
  });

  it("states the actual MVP coverage on the integrations page", () => {
    expect(page).toContain("Wildberries доступен сейчас");
    expect(page).toContain("Ozon, Яндекс Маркет и Авито находятся в плане интеграций");
    expect(page).not.toContain("4 маркетплейса");
  });

  it("uses a scoped responsive dashboard layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-integrations-approved.css"');
    expect(styles).toContain(".integrations-page");
    expect(styles).toContain(".integration-market-card-live");
    expect(styles).toContain(".integration-market-card-planned");
    expect(styles).toContain(".planned-integration-page");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
