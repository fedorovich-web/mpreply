import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shell = readFileSync(join(root, "components/public-site/PublicShell.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const footerCss = readFileSync(join(root, "styles/public-compact-footer.css"), "utf8");

describe("approved public footer variants", () => {
  it("renders default, compact and pricing-specific footer structures from one shell", () => {
    expect(shell).toContain("public-footer-default");
    expect(shell).toContain("public-footer-compact");
    expect(shell).toContain("public-footer-pricing");
    expect(shell).toContain("Ближе к вашим клиентам");
    expect(shell).toContain("г. Майкоп, ул. Чкалова, 65,");
    expect(shell).toContain("помещение 17А");
    expect(shell).toContain("Ежедневно 09:00–18:00 МСК");
  });

  it("uses proper social glyphs instead of footer text placeholders", () => {
    expect(shell).toContain('name="send"');
    expect(shell).toContain('name="vk"');
    expect(shell).toContain('name="play"');
    expect(shell).not.toContain(">ТГ<");
    expect(shell).not.toContain(">VK<");
    expect(footerCss).toContain(".public-footer-socials > span > svg");
    expect(footerCss).toContain("font-size: 13px");
  });

  it("shows compact footer only on non-pricing mockup pages", () => {
    expect(footerCss).toContain(":has(.mockup-page)");
    expect(footerCss).toContain(":not(:has(.pricing-mockup-hero))");
    expect(footerCss).toContain(".public-footer-default");
    expect(footerCss).toContain(".public-footer-compact");
  });

  it("shows the dedicated large footer only on pricing", () => {
    expect(footerCss).toContain(":has(.pricing-mockup-hero)");
    expect(footerCss).toContain(".public-footer-pricing");
  });

  it("loads footer styling after the public fidelity layers", () => {
    expect(layout).toContain('import "../styles/public-compact-footer.css"');
  });
});
