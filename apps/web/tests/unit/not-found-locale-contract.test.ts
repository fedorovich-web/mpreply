import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/not-found.tsx"), "utf8");

describe("locale-aware not found page", () => {
  it("selects the 404 language from the request locale and keeps equivalent localized links", () => {
    expect(source).toContain("localeFromRequestHeader");
    expect(source).toContain("localeRequestHeader");
    expect(source).toContain("localizedPath(locale, value)");
    expect(source).toContain("<PublicShell locale={locale}>");
  });

  it("keeps independent RU and EN 404 copy", () => {
    expect(source).toContain('title: "Страница не найдена"');
    expect(source).toContain('title: "Page not found"');
    expect(source).toContain('finalTitle: "Не нашли, что искали?"');
    expect(source).toContain('finalTitle: "Still looking for something?"');
  });

  it("keeps the approved raster 404 illustration", () => {
    expect(source).toContain('src="/images/mpreply-404-illustration.webp"');
    expect(source).toContain('className="not-found-render-code"');
    expect(source).not.toContain("<svg");
  });
});
