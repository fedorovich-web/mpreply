import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const siteConfig = readFileSync(join(process.cwd(), "lib/site-config.ts"), "utf8");
const publicShell = readFileSync(join(process.cwd(), "components/public-site/PublicShell.tsx"), "utf8");
const rootLayout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const contacts = readFileSync(join(process.cwd(), "app/contacts/page.tsx"), "utf8");
const w3cValidator = readFileSync(join(process.cwd(), "scripts/validate-w3c-html.mjs"), "utf8");

describe("public site without a blog", () => {
  it("removes the blog route and navigation references", () => {
    expect(siteConfig).not.toContain('href: "/resources"');
    expect(siteConfig).not.toContain('"/resources"');
    expect(siteConfig).not.toContain('label: "Блог"');
    expect(publicShell).not.toContain('href="/resources"');
    expect(publicShell).not.toContain(">Блог<");
    expect(w3cValidator).not.toContain('"/resources"');
    expect(existsSync(join(process.cwd(), "app/resources/page.tsx"))).toBe(false);
  });

  it("keeps only contact-specific styles for the contact page", () => {
    expect(rootLayout).toContain('import "../styles/contacts-approved.css";');
    expect(rootLayout).not.toContain('resources-contacts-approved.css');
    expect(existsSync(join(process.cwd(), "styles/contacts-approved.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "styles/resources-contacts-approved.css"))).toBe(false);
  });

  it("publishes the real office, single support email and daily schedule", () => {
    expect(siteConfig).toContain('contactEmail: configuredContactEmail || "support@mpreply.ru"');
    expect(contacts).toContain("г. Майкоп");
    expect(contacts).toContain("ул. Чкалова, 65");
    expect(contacts).toContain("помещение 17А");
    expect(contacts).toContain("Ежедневно");
    expect(contacts).toContain("09:00–18:00");
    expect(contacts).not.toContain("sales@mpreply.ru");
    expect(contacts).not.toContain("demo@mpreply.ru");
    expect(contacts).not.toContain("partners@mpreply.ru");
  });
});
