import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspace = readFileSync(join(root, "components/integrations/IntegrationsWorkspace.tsx"), "utf8");
const detailWorkspace = readFileSync(join(root, "components/integrations/WildberriesIntegrationWorkspace.tsx"), "utf8");
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
    expect(workspace).toContain("Подключение доступно");
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
      expect(marketplacePage).toContain("Подключение доступно");
      expect(marketplacePage).not.toContain("Подключение пока недоступно");
    }
  });

  it("keeps the account detail section named even when no account is selected", () => {
    expect(detailWorkspace).toContain("aria-labelledby={selectedAccount ? detailTitleId : undefined}");
    expect(detailWorkspace).toContain('aria-label={selectedAccount ? undefined : `Состояние подключения ${marketplaceName}`}');
  });

  it("uses the same detail page and header layout for every ready marketplace", () => {
    for (const marketplacePage of [wildberriesPage, ozonPage, yandexPage, avitoPage]) {
      expect(marketplacePage).toContain("marketplace-integration-page");
      expect(marketplacePage).toContain("marketplace-integration-header");
      expect(marketplacePage).not.toContain("wildberries-integration-page");
      expect(marketplacePage).not.toContain("wildberries-integration-header");
    }
    expect(styles).toContain(".marketplace-integration-page");
    expect(styles).toContain(".marketplace-integration-header");
    expect(styles).not.toContain(".wildberries-integration-page");
    expect(styles).not.toContain(".wildberries-integration-header");
  });

  it("does not retain stale roadmap-only styling for ready integrations", () => {
    expect(styles).not.toMatch(/planned-integration|market-card-planned|roadmap/i);
  });

  it("states that all supported marketplaces are available for connection", () => {
    expect(page).toContain("Подключите Wildberries, Ozon, Яндекс Маркет и Авито");
    expect(page).toContain("4 маркетплейса");
    expect(page).not.toContain("находятся в плане интеграций");
  });

  it("uses seller-facing connection language instead of implementation terms", () => {
    expect(detailWorkspace).toContain("Ключ доступа Wildberries");
    expect(detailWorkspace).toContain("Идентификатор продавца");
    expect(detailWorkspace).toContain("Обновить данные");
    expect(detailWorkspace).toContain("Последнее успешное обновление");
    expect(detailWorkspace).toContain("Последняя ошибка");
    expect(detailWorkspace).not.toContain(">Seller ID <");
    expect(detailWorkspace).not.toContain("Синхронизировать сейчас");
    expect(detailWorkspace).not.toContain("Ошибки синхронизации");
    expect(detailWorkspace).not.toContain("текущего рабочего пространства");
    expect(detailWorkspace).toContain("function userErrorMessage");
  });

  it("keeps loaded connections visible through refresh failures and supports compact selection", () => {
    expect(workspace).toContain("accountsQuery.error && accountsQuery.data");
    expect(detailWorkspace).toContain("accountsQuery.error && accountsQuery.data");
    expect(detailWorkspace).toContain("integration-refresh-error");
    expect(detailWorkspace).toContain("const detailPanelRef = useRef");
    expect(detailWorkspace).toContain("function selectAccount");
    expect(detailWorkspace).toContain('window.matchMedia("(max-width: 1000px)")');
    expect(detailWorkspace).toContain("detailPanelRef.current?.scrollIntoView");
    expect(styles).toContain("scroll-margin-top:");
  });

  it("uses the scoped responsive integrations layer without a second palette", () => {
    expect(layout).toContain('import "../styles/dashboard-integrations-approved.css"');
    expect(styles).toContain(".integrations-page");
    expect(styles).toContain(".integration-market-card");
    expect(styles).toContain(".marketplace-integration-page");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});