import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");

describe("marketplace public configuration", () => {
  it("uses neutral MPReply integration labels instead of unsupported readiness certification", () => {
    expect(siteConfig).toContain('const marketplaceStatusLabel = "Интеграция MPReply"');
    expect(siteConfig).toContain('const marketplaceStatusLabelEn = "MPReply integration"');
    expect(siteConfig).not.toContain("Интеграция готова");
    expect(siteConfig).not.toContain("Integration ready");
    expect(siteConfig).not.toContain('status: "supported"');
  });

  it("localizes marketplace paths from one route definition", () => {
    expect(siteConfig).toContain("path: localizedPath(locale, definition.path)");
    expect(siteConfig).toContain('localizeMarketplace(marketplace, "ru", marketplaceStatusLabel)');
    expect(siteConfig).toContain('localizeMarketplace(marketplace, "en", marketplaceStatusLabelEn)');
  });

  it("keeps Ozon and Yandex summaries inside the runtime-truth boundary in both locales", () => {
    expect(siteConfig).toContain("Поддерживаемые обращения Ozon");
    expect(siteConfig).toContain("Поддерживаемые обращения Яндекс Маркета");
    expect(siteConfig).toContain("supported Ozon customer messages");
    expect(siteConfig).toContain("supported Yandex Market customer messages");
    expect(siteConfig).not.toContain("Yandex Market reviews, questions, and chats");
  });
});
