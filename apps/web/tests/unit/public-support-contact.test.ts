import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supportEmail = "support@mpreply.ru";

function read(relativeUrl: string): string {
  return readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
}

describe("public support contact contract", () => {
  it("uses the support mailbox as the only public contact email", () => {
    const siteConfig = read("../../lib/site-config.ts");

    expect(siteConfig).toContain(`|| "${supportEmail}"`);
    expect(siteConfig).not.toContain("info@mpreply.ru");
  });

  it("shows a clickable support email in the public footer", () => {
    const shell = read("../../components/public-site/PublicShell.tsx");

    expect(shell).toContain("mailto:${siteConfig.contactEmail}");
    expect(shell).toContain("{siteConfig.contactEmail}");
  });

  it("shows the clickable support email on contacts without launch placeholders", () => {
    const contacts = read("../../app/contacts/page.tsx");

    expect(contacts).toContain("mailto:${siteConfig.contactEmail}");
    expect(contacts).toContain("{siteConfig.contactEmail}");
    expect(contacts).not.toContain("Публичный контактный email появится перед открытым запуском");
    expect(contacts).not.toContain("Пока контакт не опубликован");
  });
});
