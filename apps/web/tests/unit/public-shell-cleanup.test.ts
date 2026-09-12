import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shell = readFileSync(join(process.cwd(), "components/public-site/PublicShell.tsx"), "utf8");
const homepageCss = readFileSync(join(process.cwd(), "styles/homepage-approved.css"), "utf8");

describe("public shell cleanup", () => {
  it("does not render fake social controls or decorative social placeholders", () => {
    expect(shell).not.toContain("public-footer-socials");
    expect(shell).not.toContain("<span>➤</span>");
    expect(shell).not.toContain("<span>◉</span>");
    expect(shell).not.toContain("<span>VK</span>");
    expect(homepageCss).not.toContain(".public-footer-socials");
  });

  it("does not label contact fallbacks as company pages that do not exist", () => {
    expect(shell).not.toContain(">Компания<");
    expect(shell).not.toContain(">О нас<");
    expect(shell).not.toContain(">Партнёрам<");
  });

  it("sizes the desktop footer for the brand plus three real link columns", () => {
    expect(homepageCss).toMatch(/\.public-root \.public-footer-main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(15rem, 1\.45fr\) repeat\(3, minmax\(7rem, 0\.8fr\)\);/);
  });
});
