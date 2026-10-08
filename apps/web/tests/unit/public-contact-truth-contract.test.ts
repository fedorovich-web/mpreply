import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const publicShell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const footer = readFileSync(join(root, "components/public-site/PublicFooter.tsx"), "utf8");
const siteConfig = readFileSync(join(root, "lib/site-config.ts"), "utf8");
const publicSources = `${footer}\n${publicShell}\n${siteConfig}`;

describe("public contact truth contract", () => {
  it("uses support@mpreply.ru as the only public contact email", () => {
    expect(siteConfig).toContain('contactEmail: configuredContactEmail || "support@mpreply.ru"');
    expect(publicSources).not.toContain("help@mpreply.ru");
    expect(publicSources).not.toContain("hello@mpreply.ru");
    expect(publicSources).not.toContain("info@mpreply.ru");
  });

  it("does not advertise social networks or Telegram", () => {
    for (const unsupportedContact of [
      "Написать в Telegram",
      "Социальные сети",
      "FooterSocials",
      'PublicIcon name="send"',
      'PublicIcon name="vk"',
      'PublicIcon name="play"',
    ]) {
      expect(publicSources).not.toContain(unsupportedContact);
    }
  });

  it("renders the configured support email in the shared footer", () => {
    expect(publicShell).toContain("<PublicFooter locale={locale} />");
    expect(footer).toContain("config.contactEmail");
  });
});
