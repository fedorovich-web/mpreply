import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const englishPages = [
  "app/en/page.tsx",
  "app/en/features/page.tsx",
  "app/en/marketplaces/page.tsx",
  "app/en/marketplaces/wildberries/page.tsx",
  "app/en/marketplaces/ozon/page.tsx",
  "app/en/marketplaces/yandex-market/page.tsx",
  "app/en/marketplaces/avito/page.tsx",
  "app/en/pricing/page.tsx",
  "app/en/demo/page.tsx",
  "app/en/help/page.tsx",
  "app/en/contacts/page.tsx",
  "app/en/privacy/page.tsx",
  "app/en/terms/page.tsx",
];

describe("public RU/EN separation", () => {
  it("keeps every public English route in its own /en tree", () => {
    for (const path of englishPages) {
      const source = read(path);
      expect(source).toContain('locale: "en"');
      expect(source).toContain("localized: true");
    }
  });

  it("keeps English page copy free of accidental Cyrillic text", () => {
    for (const path of englishPages) {
      expect(read(path), path).not.toMatch(/[А-Яа-яЁё]/);
    }
    expect(read("lib/marketplace-detail-content-en.ts")).not.toMatch(/[А-Яа-яЁё]/);
  });

  it("keeps the public shell locale-aware instead of mixing languages in one route", () => {
    const header = read("components/public-site/PublicHeader.tsx");
    const shell = read("components/public-site/PublicShell.tsx");
    const homeShell = read("components/public-site/HomeApprovedShell.tsx");

    expect(header).toContain('locale = "ru"');
    expect(header).toContain("getSiteConfig(locale)");
    expect(header).toContain("basePathFromLocalizedPath(pathname)");
    expect(header).toContain("localizedPath(otherLocale");
    expect(shell).toContain('<PublicHeader locale={locale} />');
    expect(homeShell).toContain("homeNavigation[locale]");
  });

  it("keeps English pricing marketplace links inside the /en tree", () => {
    const pricing = read("app/en/pricing/page.tsx");
    for (const slug of ["wildberries", "ozon", "yandex-market", "avito"]) {
      expect(pricing).toContain(`path: "/en/marketplaces/${slug}"`);
      expect(pricing).not.toContain(`path: "/marketplaces/${slug}"`);
    }
  });

  it("emits both locale URLs and language alternates in the sitemap", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toContain('localizedPath("ru", path)');
    expect(sitemap).toContain('localizedPath("en", path)');
    expect(sitemap).toContain('"ru-RU"');
    expect(sitemap).toContain('"x-default"');
    expect(sitemap).toContain("flatMap");
  });
});
