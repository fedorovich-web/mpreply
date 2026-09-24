import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const overview = readFileSync(join(root, "components/integrations/IntegrationsWorkspace.tsx"), "utf8");
const detail = readFileSync(join(root, "components/integrations/WildberriesIntegrationWorkspace.tsx"), "utf8");
const enOverview = readFileSync(join(root, "app/en/app/integrations/page.tsx"), "utf8");
const enWildberries = readFileSync(join(root, "app/en/app/integrations/wildberries/page.tsx"), "utf8");
const enOzon = readFileSync(join(root, "app/en/app/integrations/ozon/page.tsx"), "utf8");
const enYandex = readFileSync(join(root, "app/en/app/integrations/yandex-market/page.tsx"), "utf8");
const enAvito = readFileSync(join(root, "app/en/app/integrations/avito/page.tsx"), "utf8");

describe("private integrations locale separation", () => {
  it("keeps a shared live connection overview", () => {
    expect(overview).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(overview).toContain('buildApiQuery("/api/marketplace-accounts"');
    expect(overview).toContain("localizedPath(locale, marketplace.href)");
    expect(overview).toContain('name: "Yandex Market"');
    expect(overview).toContain('name: "Яндекс Маркет"');
  });

  it("keeps connection CRUD and operational actions shared across locales", () => {
    for (const endpoint of [
      "/api/marketplace-accounts",
      "/validate",
      "/sync",
      "/rotate-credentials",
      "/revoke-credentials",
    ]) {
      expect(detail).toContain(endpoint);
    }
    expect(detail).toContain("const { activeOrganization, locale } = useWorkspace()");
    expect(detail).toContain('locale === "en" ? "en-US" : "ru-RU"');
  });

  it("provides English routes for all connected marketplace screens", () => {
    for (const source of [enOverview, enWildberries, enOzon, enYandex, enAvito]) {
      expect(source).not.toMatch(/[А-Яа-яЁё]/);
    }
    expect(enWildberries).toContain("<WildberriesIntegrationWorkspace />");
    expect(enOzon).toContain('marketplace="ozon"');
    expect(enYandex).toContain('marketplace="yandex_market"');
    expect(enAvito).toContain('marketplace="avito"');
  });
});
