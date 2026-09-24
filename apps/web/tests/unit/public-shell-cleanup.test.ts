import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const header = readFileSync(join(root, "components/public-site/PublicHeader.tsx"), "utf8");
const brandMark = readFileSync(join(root, "components/public-site/PublicBrandMark.tsx"), "utf8");

describe("public shell cleanup", () => {
  it("uses one shared brand mark in header and footer", () => {
    expect(brandMark).toContain('className="public-brand-mark"');
    expect(header).toContain('import { PublicBrandMark } from "./PublicBrandMark"');
    expect(shell).toContain('import { PublicBrandMark } from "./PublicBrandMark"');
    expect(header).toContain("<PublicBrandMark />");
    expect(shell).toContain("<PublicBrandMark />");
  });

  it("keeps navigation and footer links locale-aware", () => {
    expect(header).toContain("getSiteConfig(locale)");
    expect(header).toContain("localizedPath(otherLocale");
    expect(shell).toContain("localizedPath(locale, value)");
    expect(shell).toContain('locale === "ru" ? "Демо" : "Demo"');
  });

  it("keeps the verified support email and avoids invented company/social links", () => {
    expect(shell).toContain('href={`mailto:${config.contactEmail}`}');
    expect(shell).not.toContain("public-footer-socials");
    expect(shell).not.toContain('name="vk"');
    expect(shell).not.toContain(">Компания<");
    expect(shell).not.toContain(">О нас<");
  });

  it("does not keep unreachable hash-specific header routing logic", () => {
    expect(header).not.toContain('href.includes("#")');
  });
});
