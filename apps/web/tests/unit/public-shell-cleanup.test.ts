import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shell = readFileSync(join(process.cwd(), "components/public-site/PublicShell.tsx"), "utf8");

describe("public shell cleanup", () => {
  it("does not render fake social controls or decorative social placeholders", () => {
    expect(shell).not.toContain("public-footer-socials");
    expect(shell).not.toContain("<span>➤</span>");
    expect(shell).not.toContain("<span>◉</span>");
    expect(shell).not.toContain("<span>VK</span>");
  });
});
